"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(text) {
  try {
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readLastSession() {
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = Number(obj?.ts || 0);
    if (!ts || Date.now() - ts > TTL) return null;
    if (!obj?.token) return null;
    return obj;
  } catch {
    return null;
  }
}

function getActiveUserId() {
  try {
    return (
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("username") ||
      readLastSession()?.username ||
      ""
    );
  } catch {
    return "";
  }
}

function getToken() {
  try {
    const s = readLastSession();
    if (s?.token) return String(s.token);
    return String(localStorage.getItem("yinnotp_token") || "");
  } catch {
    return "";
  }
}

function authHeaders(uid) {
  const token = getToken();
  const h = { "Content-Type": "application/json", "x-user-id": uid };
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
    h["x-token"] = token;
    h["x-auth-token"] = token;
  }
  return h;
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const method = sp.get("method") || "qris";
  const amount = sp.get("amount") || "0";
  const order_id = sp.get("order_id") || "";
  const resume = sp.get("resume") === "1";

  const uid = useMemo(() => (typeof window === "undefined" ? "" : getActiveUserId()), []);
  const token = useMemo(() => (typeof window === "undefined" ? "" : getToken()), []);

  const isLoggedIn = Boolean(uid && token);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState(""); // dataUrl / image url
  const [status, setStatus] = useState("pending"); // pending / completed
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(Number(amount || 0));

  const confirmedRef = useRef(false);
  const toastErrOnceRef = useRef(false);

  const cacheKey = useMemo(() => (uid && order_id ? `deposit_qr:${uid}:${order_id}` : ""), [uid, order_id]);

  async function syncMeAfterSuccess() {
    if (!backend || !uid) return;
    try {
      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers: authHeaders(uid),
      });
      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      const hist = Array.isArray(j.history) ? j.history : [];

      localStorage.setItem(`yinnotp_balance:${uid}`, String(bal));
      localStorage.setItem(`yinnotp_deposit_history:${uid}`, JSON.stringify(hist));
      localStorage.setItem(`yinnotp_last_sync:${uid}`, String(Date.now()));

      // legacy
      localStorage.setItem("yinnotp_balance", String(bal));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(hist));
    } catch {}
  }

  async function createTx() {
    if (!backend) throw new Error("Backend URL belum diset");
    const r = await fetch(`${backend}/deposit/create`, {
      method: "POST",
      headers: authHeaders(uid),
      body: JSON.stringify({
        user_id: uid,
        order_id,
        method,
        amount: Number(amount || 0),
      }),
    });
    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j?.ok) throw new Error(String(j?.message || "Gagal buat transaksi"));

    // fleksibel: backend lo mungkin return qr berbeda key
    const qrValue =
      j.qr ||
      j.qr_image ||
      j.qr_url ||
      j.data?.qr ||
      j.data?.qr_image ||
      j.data?.qr_url ||
      "";

    const feeValue = Number(j.fee || j.data?.fee || 0) || 0;
    const totalValue = Number(j.total || j.data?.total || Number(amount || 0)) || Number(amount || 0);

    setQr(String(qrValue || ""));
    setFee(feeValue);
    setTotal(totalValue);

    // cache QR supaya kalau pending dipencet bisa kebuka lagi tanpa bikin order baru
    if (cacheKey && qrValue) {
      try {
        localStorage.setItem(cacheKey, String(qrValue));
      } catch {}
    }

    return j;
  }

  async function getDetail() {
    if (!backend) return null;
    const r = await fetch(
      `${backend}/deposit/detail?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`,
      { cache: "no-store", headers: authHeaders(uid) }
    );
    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j) return null;
    return j;
  }

  async function confirmIfCompleted() {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    try {
      const r = await fetch(`${backend}/deposit/confirm`, {
        method: "POST",
        headers: authHeaders(uid),
        body: JSON.stringify({ user_id: uid, order_id }),
      });
      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j?.ok) {
        confirmedRef.current = false;
        throw new Error(String(j?.message || "Gagal konfirmasi deposit"));
      }

      await syncMeAfterSuccess();
      toast.success("Deposit sukses ✅", { id: "dep-ok" });
      router.replace(`/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`);
    } catch (e) {
      toast.error(String(e?.message || "Gagal konfirmasi deposit"), { id: "dep-confirm-fail" });
    }
  }

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    // kalau belum login, jangan spam toast
    if (!isLoggedIn) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu ya.");
      return;
    }

    // load cache QR kalau resume / pending dibuka lagi
    if (resume && cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) setQr(cached);
      } catch {}
    }

    let stop = false;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        // 1) coba detail dulu
        const d = await getDetail();
        const st = String(d?.status || d?.data?.status || "pending").toLowerCase();
        if (st) setStatus(st);

        const qrValue =
          d?.qr || d?.qr_image || d?.qr_url || d?.data?.qr || d?.data?.qr_image || d?.data?.qr_url || "";
        if (qrValue) {
          setQr(String(qrValue));
          if (cacheKey) localStorage.setItem(cacheKey, String(qrValue));
        }

        // 2) kalau belum ada, create transaksi
        if (!qrValue && !qr) {
          await createTx();
        }

        setLoading(false);

        // 3) polling status tiap 3 detik
        const timer = setInterval(async () => {
          if (stop) return;
          const dd = await getDetail();
          const st2 = String(dd?.status || dd?.data?.status || "pending").toLowerCase();
          if (st2) setStatus(st2);

          if (st2 === "completed" || st2 === "success" || st2 === "paid") {
            await confirmIfCompleted();
          }
        }, 3000);

        return () => clearInterval(timer);
      } catch (e) {
        setLoading(false);
        setErr(String(e?.message || "Error"));
        if (!toastErrOnceRef.current) {
          toastErrOnceRef.current = true;
          toast.error(String(e?.message || "Gagal memuat pembayaran"), { id: "pay-load-fail" });
        }
      }
    })();

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit via QRIS</div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">Rp {amount}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-semibold">Rp {total}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
            {err ? (
              <>
                <div className="text-sm font-extrabold">Belum login</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{
                      background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    Login
                  </Link>
                  <Link
                    href="/topup"
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Balik
                  </Link>
                </div>
              </>
            ) : loading ? (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">Menyiapkan pembayaran…</div>
            ) : qr ? (
              <div className="grid place-items-center gap-3">
                <div className="text-sm font-bold">Scan QR di bawah</div>
                <div className="rounded-2xl border border-[var(--yinn-border)] bg-white p-3">
                  <img src={qr} alt="QRIS" className="h-[240px] w-[240px]" />
                </div>
                <div className="text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-semibold">{status}</span>
                </div>

                <button
                  onClick={confirmIfCompleted}
                  className="mt-2 w-full rounded-2xl py-3 text-sm font-extrabold text-white"
                  style={{
                    background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Saya sudah membayar
                </button>

                <Link
                  href="/topup"
                  className="w-full rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] py-3 text-center text-sm font-bold"
                >
                  Balik ke Deposit
                </Link>
              </div>
            ) : (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">
                QR belum tersedia. Coba refresh.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}