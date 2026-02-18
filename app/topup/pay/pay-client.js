"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import QRCode from "qrcode";
import Link from "next/link";

function safeJson(text) {
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

function getAuth() {
  const lastRaw = localStorage.getItem("yinnotp:last_session");
  const last = safeJson(lastRaw);

  const username =
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    last?.username ||
    "";

  const token =
    localStorage.getItem("yinnotp_token_active") ||
    (username ? localStorage.getItem(`yinnotp_token:${username}`) : "") ||
    last?.token ||
    "";

  return { username, token };
}

async function syncMeToStorage(backend, user_id, token) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Token"] = token;
    headers["X-User-Id"] = user_id;
  }

  const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(user_id)}`, {
    cache: "no-store",
    headers,
  });

  const t = await r.text();
  const j = safeJson(t);

  if (j?.ok) {
    localStorage.setItem(`yinnotp_balance:${user_id}`, String(j.balance || 0));
    localStorage.setItem(`yinnotp_deposit_history:${user_id}`, JSON.stringify(j.history || []));
    localStorage.setItem(`yinnotp_deposit_last_sync:${user_id}`, String(Date.now()));
  }
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const order_id = sp.get("order_id") || "";
  const method = sp.get("method") || "qris";
  const amount = Number(sp.get("amount") || 0) || 0;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [payment, setPayment] = useState(null);

  const pollingRef = useRef(null);
  const shownLoginToast = useRef(false);

  const auth = useMemo(() => {
    if (typeof window === "undefined") return { username: "", token: "" };
    return getAuth();
  }, []);

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

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Token": token,
        "X-User-Id": username,
      };

      // 1) CREATE / RESUME di backend
      // backend lo sebaiknya kalau order_id sama -> balikin transaksi yg sama, bukan bikin baru
      const r = await fetch(`${backend}/deposit/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: username, order_id, amount, method }),
      });

      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j.ok) {
        const msg = j?.message || "Gagal membuat transaksi deposit";
        if (!cancelled) setErr(msg);
        setLoading(false);
        return;
      }

      const pay = j.payment || j.data?.payment || null;
      if (!pay) {
        if (!cancelled) setErr("Response payment kosong");
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setPayment(pay);
      }

      // 2) generate QR image (kalau qris)
      if (String(pay.payment_method || method) === "qris") {
        const qrString = pay.payment_number || "";
        if (!qrString) {
          if (!cancelled) setErr("QR string kosong");
          setLoading(false);
          return;
        }
        const dataUrl = await QRCode.toDataURL(qrString, { margin: 1, width: 320 });
        if (!cancelled) setQrDataUrl(dataUrl);
      }

      setLoading(false);
    }

    async function checkLoop() {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "X-Token": token,
        "X-User-Id": username,
      };

      const r = await fetch(
        `${backend}/deposit/detail?project=&amount=${encodeURIComponent(amount)}&order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(username)}`,
        { cache: "no-store", headers }
      );

      const t = await r.text();
      const j = safeJson(t);

      // support format docs transactiondetail
      const tx = j.transaction || j.data?.transaction || j;

      const status = String(tx?.status || "").toLowerCase();
      if (status === "completed") {
        clearInterval(pollingRef.current);
        pollingRef.current = null;

        toast.success("Pembayaran sukses ✅");

        // sync saldo + riwayat
        await syncMeToStorage(backend, username, token);

        router.replace(`/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`);
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

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[520px]">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
             style={{ boxShadow: "var(--yinn-soft)" }}>

          <div className="text-lg font-extrabold">Deposit via {String(method).toUpperCase()}</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">Nominal: <b>Rp {amount.toLocaleString("id-ID")}</b></div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
              <div className="font-extrabold">Belum login</div>
              <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>
              <div className="mt-4 flex gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
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
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-[var(--yinn-muted)]">Menyiapkan pembayaran... jangan tutup halaman ini.</div>
          ) : null}

          {!loading && !err && String(payment?.payment_method || method) === "qris" ? (
            <div className="mt-5">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QRIS" className="mx-auto rounded-xl" />
                ) : (
                  <div className="text-sm text-[var(--yinn-muted)]">QR belum tersedia</div>
                )}
                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Scan QR di atas, lalu sistem akan auto-check tiap 3 detik.
                </div>

                <button
                  onClick={() => toast("Auto-check aktif...")}
                  className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                >
                  Saya sudah membayar ✅
                </button>

                <Link
                  href="/topup"
                  className="mt-2 block w-full rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold text-center"
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