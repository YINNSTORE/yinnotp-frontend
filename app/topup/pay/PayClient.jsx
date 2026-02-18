"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function makeOrderId() {
  const ts = Date.now();
  const rnd = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `YINN-${ts}-${rnd}`;
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

function getUserId() {
  if (typeof window === "undefined") return "";
  // pakai yang udah ada di storage kamu
  return (
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("username") ||
    ""
  );
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const didInit = useRef(false);
  const timerRef = useRef(null);

  const amount = useMemo(() => {
    const raw = sp.get("amount") || "";
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [sp]);

  const [orderId, setOrderId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [statusText, setStatusText] = useState("Menyiapkan pembayaran...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const creditConfirm = async (oid, amt) => {
    const user_id = getUserId();
    if (!user_id) return { ok: false, error: "user_id kosong (belum login?)" };

    const res = await fetch(`${backend}/deposit/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": user_id,
      },
      body: JSON.stringify({ user_id, order_id: oid, amount: amt }),
      cache: "no-store",
    });

    const json = await safeJson(res);
    if (!res.ok || !json?.ok) return { ok: false, error: json?.error || "confirm gagal" };

    // sync localStorage balance biar dashboard langsung update
    if (typeof window !== "undefined" && typeof json.balance === "number") {
      localStorage.setItem("yinnotp_balance", String(json.balance));
      localStorage.setItem("balance", String(json.balance));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(json.history || []));
    }

    return { ok: true };
  };

  const checkStatus = async (oid, amt) => {
    try {
      const res = await fetch(
        `${backend}/deposit/detail?order_id=${encodeURIComponent(oid)}&amount=${encodeURIComponent(String(amt))}`,
        { cache: "no-store" }
      );
      const json = await safeJson(res);
      if (!res.ok || !json?.ok) return;

      const st = String(json?.transaction?.status || "").toLowerCase();

      if (st === "completed") {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;

        setStatusText("Pembayaran terdeteksi ✅ Memproses saldo...");

        const confirmed = await creditConfirm(oid, amt);
        if (!confirmed.ok) {
          setError(confirmed.error || "Gagal credit saldo");
          return;
        }

        router.replace(`/topup/success?order_id=${encodeURIComponent(oid)}&amount=${encodeURIComponent(String(amt))}`);
      } else {
        setStatusText(`Status: ${st || "pending"} (auto-check 3 detik)`);
      }
    } catch {
      // diem
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (!backend) {
      setError("NEXT_PUBLIC_BACKEND_URL belum di set di Vercel ENV");
      setLoading(false);
      return;
    }

    if (!amount || amount <= 0) {
      router.replace("/topup");
      return;
    }

    const user_id = getUserId();
    if (!user_id) {
      router.replace("/login");
      return;
    }

    const oid = sp.get("order_id") || makeOrderId();
    setOrderId(oid);

    (async () => {
      try {
        setLoading(true);
        setError("");
        setStatusText("Membuat transaksi QRIS...");

        const res = await fetch(`${backend}/deposit/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": user_id,
          },
          body: JSON.stringify({ user_id, amount, method: "qris", order_id: oid }),
          cache: "no-store",
        });

        const json = await safeJson(res);
        if (!res.ok || !json?.ok) {
          setError(json?.error || `Gagal buat transaksi (status ${res.status})`);
          setLoading(false);
          return;
        }

        const qrString = json?.payment?.payment_number;
        if (!qrString) {
          setError("QR string kosong dari Pakasir.");
          setLoading(false);
          return;
        }

        const dataUrl = await QRCode.toDataURL(qrString, { width: 320, margin: 1 });
        setQrDataUrl(dataUrl);

        setLoading(false);
        setStatusText("Silakan scan QR. Auto-check aktif tiap 3 detik.");

        timerRef.current = setInterval(() => checkStatus(oid, amount), 3000);
      } catch (e) {
        setError(e?.message || "Terjadi error saat menyiapkan QR");
        setLoading(false);
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, backend, router, sp]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <div className="mx-auto max-w-[520px]">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5" style={{ boxShadow: "var(--yinn-soft)" }}>
          <div className="text-lg font-extrabold">Deposit via QRIS</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">{formatIDR(amount)}</span>
          </div>
          <div className="text-xs text-[var(--yinn-muted)] mt-1">
            Order ID: <span className="font-semibold">{orderId}</span>
          </div>

          {loading ? <div className="mt-4 text-sm text-[var(--yinn-muted)]">{statusText}</div> : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
              <div className="font-bold">Error</div>
              <div className="text-sm text-[var(--yinn-muted)]">{error}</div>
              <div className="mt-3">
                <Link
                  href="/topup"
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white inline-block"
                  style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                >
                  Balik ke Deposit
                </Link>
              </div>
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-2xl border border-[var(--yinn-border)] bg-white p-3">
                <img src={qrDataUrl} alt="QRIS" className="h-[320px] w-[320px] max-w-full" />
              </div>

              <div className="mt-3 text-sm text-[var(--yinn-muted)] text-center">
                Scan QR di atas, lalu tunggu. <br />
                <span className="font-semibold">{statusText}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => checkStatus(orderId, amount)}
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                >
                  Saya sudah membayar
                </button>
                <Link
                  href="/topup"
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Batal
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}