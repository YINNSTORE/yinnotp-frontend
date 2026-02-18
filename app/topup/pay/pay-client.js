"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import QRCode from "qrcode";
import Link from "next/link";

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function normBackend(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function getAuth() {
  const last = safeJson(localStorage.getItem("yinnotp:last_session"));

  const username =
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    last?.username ||
    "";

  const token =
    // ✅ paling penting: token global
    localStorage.getItem("yinnotp_token") ||
    // ✅ token aktif
    localStorage.getItem("yinnotp_token_active") ||
    // ✅ token per-user
    (username ? localStorage.getItem(`yinnotp_token:${username}`) : "") ||
    // ✅ fallback remember session
    last?.token ||
    "";

  return { username, token };
}

function authHeaders(username, token) {
  const h = {};
  if (!token) return h;
  h["Authorization"] = `Bearer ${token}`;
  h["X-Token"] = token;
  h["X-User-Id"] = username;
  return h;
}

async function fetchTextWithTimeout(url, options = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await r.text();
    return { r, text };
  } finally {
    clearTimeout(t);
  }
}

async function syncMeToStorage(backend, user_id, token) {
  try {
    const headers = authHeaders(user_id, token);
    const { r, text } = await fetchTextWithTimeout(
      `${backend}/deposit/me?user_id=${encodeURIComponent(user_id)}`,
      { cache: "no-store", headers },
      15000
    );
    const j = safeJson(text);
    if (r.ok && j?.ok) {
      localStorage.setItem(`yinnotp_balance:${user_id}`, String(j.balance || 0));
      localStorage.setItem(`yinnotp_deposit_history:${user_id}`, JSON.stringify(j.history || []));
      localStorage.setItem(`yinnotp_deposit_last_sync:${user_id}`, String(Date.now()));
      // legacy (kalau masih dipakai di tempat lain)
      localStorage.setItem("yinnotp_balance", String(j.balance || 0));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(j.history || []));
    }
  } catch {
    // silent
  }
}

function markPendingLocalDone(user_id, order_id) {
  try {
    const key = `yinnotp_pending_deposits:${user_id}`;
    const arr = safeJson(localStorage.getItem(key));
    const list = Array.isArray(arr) ? arr : [];
    const next = list.filter((x) => String(x?.order_id || "") !== String(order_id || ""));
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const backend = normBackend(process.env.NEXT_PUBLIC_BACKEND_URL);
  const order_id = sp.get("order_id") || "";
  const method = sp.get("method") || "qris";
  const amount = Number(sp.get("amount") || 0) || 0;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrRaw, setQrRaw] = useState("");
  const [payment, setPayment] = useState(null);

  const pollingRef = useRef(null);
  const shownLoginToast = useRef(false);

  useEffect(() => {
    if (!order_id || !amount) {
      router.replace("/topup");
      return;
    }
    if (!backend) {
      setErr("NEXT_PUBLIC_BACKEND_URL belum di set");
      setLoading(false);
      return;
    }

    const { username, token } = getAuth();
    if (!username || !token) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu ya.");
      if (!shownLoginToast.current) {
        shownLoginToast.current = true;
        toast.error("Session user tidak ketemu. Login dulu.");
      }
      return;
    }

    let cancelled = false;

    async function createOrResume() {
      setLoading(true);
      setErr("");
      setQrDataUrl("");
      setPayment(null);

      try {
        const headers = {
          "Content-Type": "application/json",
          ...authHeaders(username, token),
        };

        const { r, text } = await fetchTextWithTimeout(
          `${backend}/deposit/create`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ user_id: username, order_id, amount, method }),
          },
          25000
        );

        const j = safeJson(text);

        if (!r.ok || !j.ok) {
          const msg = j?.message || `Gagal membuat transaksi (HTTP ${r.status})`;
          if (!cancelled) setErr(msg);
          return;
        }

        const pay = j.payment || j.data?.payment || null;
        if (!pay) {
          if (!cancelled) setErr("Response payment kosong dari backend");
          return;
        }

        if (!cancelled) setPayment(pay);

        // QR bisa datang di payment_number / qr_string / dll
        const maybeQr =
          String(pay.payment_number || pay.qr_string || pay.qr || "").trim();

        if (String(pay.payment_method || method) === "qris") {
          if (!maybeQr) {
            if (!cancelled) setErr("QR string kosong (payment_number kosong)");
            return;
          }

          setQrRaw(maybeQr);

          // kalau backend ngasih link gambar QR, tampilkan langsung
          if (/^https?:\/\//i.test(maybeQr)) {
            if (!cancelled) setQrDataUrl(maybeQr);
          } else {
            // generate image dari string QR
            const dataUrl = await QRCode.toDataURL(maybeQr, { margin: 1, width: 340 });
            if (!cancelled) setQrDataUrl(dataUrl);
          }
        }
      } catch (e) {
        const msg =
          e?.name === "AbortError"
            ? "Request timeout saat membuat pembayaran (coba lagi)."
            : "Koneksi / server error saat membuat pembayaran.";
        if (!cancelled) setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function checkLoop() {
      try {
        const headers = authHeaders(username, token);

        // ✅ query dibuat aman (tanpa project= kosong)
        const url =
          `${backend}/deposit/detail?` +
          `order_id=${encodeURIComponent(order_id)}` +
          `&user_id=${encodeURIComponent(username)}` +
          (amount ? `&amount=${encodeURIComponent(amount)}` : "");

        const { r, text } = await fetchTextWithTimeout(url, { cache: "no-store", headers }, 15000);
        const j = safeJson(text);

        if (!r.ok) return;

        const tx = j.transaction || j.data?.transaction || j;
        const status = String(tx?.status || "").toLowerCase();

        if (status === "completed" || status === "success" || status === "paid") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;

          toast.success("Pembayaran sukses ✅");

          // sync saldo + riwayat
          await syncMeToStorage(backend, username, token);
          markPendingLocalDone(username, order_id);

          router.replace(
            `/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`
          );
        }

        if (status === "expired" || status === "failed" || status === "canceled") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setErr(`Transaksi ${status}. Silakan buat deposit baru.`);
        }
      } catch {
        // jangan spam toast tiap 3 detik
      }
    }

    (async () => {
      await createOrResume();

      // start polling tiap 3 detik
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          checkLoop().catch(() => {});
        }, 3000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [backend, order_id, amount, method, router]);

  const copyQr = async () => {
    try {
      if (!qrRaw) return toast.error("QR belum ada");
      await navigator.clipboard.writeText(qrRaw);
      toast.success("QR disalin ✅");
    } catch {
      toast.error("Gagal menyalin QR");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">
            Deposit via {String(method).toUpperCase()}
          </div>

          <div className="mt-1 text-sm text-[var(--yinn-muted)] break-words">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">Rp {amount.toLocaleString("id-ID")}</span>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
              <div className="text-sm font-extrabold">Error</div>
              <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>

              <div className="mt-4 flex gap-2">
                {String(err).toLowerCase().includes("login") ? (
                  <Link
                    href="/login"
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    Login
                  </Link>
                ) : (
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    Coba lagi
                  </button>
                )}

                <Link
                  href="/topup"
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Balik
                </Link>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 text-sm text-[var(--yinn-muted)]">
              Menyiapkan pembayaran... jangan tutup halaman ini.
            </div>
          ) : null}

          {!loading && !err && String(payment?.payment_method || method) === "qris" ? (
            <div className="mt-4">
              {qrDataUrl ? (
                // kalau qrDataUrl link http, <img> juga aman
                <div className="grid place-items-center rounded-2xl border border-[var(--yinn-border)] p-4">
                  <img
                    src={qrDataUrl}
                    alt="QRIS"
                    className="h-[320px] w-[320px] rounded-xl bg-white p-2"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                  QR belum tersedia
                </div>
              )}

              <div className="mt-3 text-sm text-[var(--yinn-muted)]">
                Scan QR di atas, sistem auto-check tiap 3 detik.
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    toast("Cek status...");
                    // cek sekali manual
                    // polling tetep jalan juga
                  }}
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Cek sekarang
                </button>

                <button
                  onClick={copyQr}
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Salin QR
                </button>
              </div>

              <div className="mt-3">
                <Link
                  href="/topup"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] py-3 text-sm font-bold"
                >
                  Balik ke Deposit
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}