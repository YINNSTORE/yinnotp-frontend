"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const amount = useMemo(() => {
    const raw = sp.get("amount") || sp.get("nominal") || "";
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [sp]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payment, setPayment] = useState(null);
  const [qrImg, setQrImg] = useState("");
  const [checking, setChecking] = useState(false);
  const [ttl, setTtl] = useState(""); // countdown string

  // create transaksi + generate QR image
  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr("");

      if (!amount || amount < 1000) {
        setErr("Nominal tidak valid. Balik dan pilih nominal.");
        setLoading(false);
        return;
      }

      // biar reload gak bikin order baru terus
      const key = `yinnotp_order_${amount}`;
      let order_id = "";
      try {
        order_id = sessionStorage.getItem(key) || "";
        if (!order_id) {
          order_id = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          sessionStorage.setItem(key, order_id);
        }
      } catch {
        order_id = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      }

      try {
        const r = await fetch("/api/deposit/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, order_id, method: "qris" }),
        });

        const data = await r.json();
        if (!r.ok || !data?.ok) throw new Error(data?.message || "Gagal create transaksi");

        const p = data.payment;
        if (!alive) return;

        setPayment(p);

        // Generate QR image dari payment_number (QR string)
        const dataUrl = await QRCode.toDataURL(p.payment_number, {
          margin: 1,
          width: 280,
        });

        if (!alive) return;
        setQrImg(dataUrl);
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [amount]);

  // countdown expired
  useEffect(() => {
    if (!payment?.expired_at) return;

    const tick = () => {
      const end = new Date(payment.expired_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);

      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTtl(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      if (diff <= 0) setTtl("00:00");
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment?.expired_at]);

  async function checkStatus() {
    if (!payment?.order_id || !payment?.amount) return;
    setChecking(true);
    try {
      const r = await fetch(
        `/api/deposit/detail?order_id=${encodeURIComponent(payment.order_id)}&amount=${encodeURIComponent(
          String(payment.amount)
        )}`,
        { cache: "no-store" }
      );
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.message || "Gagal cek status");

      const status = data.transaction?.status;
      if (status === "completed") {
        router.replace(`/topup/success?order_id=${encodeURIComponent(payment.order_id)}&amount=${encodeURIComponent(String(payment.amount))}`);
        return;
      }

      alert(`Status masih: ${status || "unknown"}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit via QRIS</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Scan QR di bawah, lalu tekan <b>Saya sudah membayar</b>.
          </div>

          {amount ? (
            <div className="mt-2 text-sm">
              Nominal: <span className="font-extrabold">{formatIDR(amount)}</span>
            </div>
          ) : null}

          {payment?.total_payment ? (
            <div className="mt-1 text-sm text-[var(--yinn-muted)]">
              Total bayar: <span className="font-bold">{formatIDR(Number(payment.total_payment))}</span>
              {ttl ? <span className="ms-2">• Exp: <b>{ttl}</b></span> : null}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-[var(--yinn-muted)]">Menyiapkan QR...</div>
          ) : null}

          {err ? (
            <div className="mt-4 rounded-xl border border-[var(--yinn-border)] p-3 text-sm">
              <div className="font-bold">Error</div>
              <div className="mt-1 text-[var(--yinn-muted)]">{err}</div>
              <button
                onClick={() => router.replace("/topup")}
                className="mt-3 rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                Balik ke Deposit
              </button>
            </div>
          ) : null}

          {!loading && !err && qrImg ? (
            <div className="mt-5 grid place-items-center">
              <img
                src={qrImg}
                alt="QRIS"
                className="rounded-2xl border border-[var(--yinn-border)] bg-white p-3"
                style={{ width: 320, maxWidth: "100%", boxShadow: "var(--yinn-soft)" }}
              />
              <div className="mt-3 text-xs text-[var(--yinn-muted)] text-center">
                Order ID: <span className="font-semibold">{payment?.order_id}</span>
              </div>
            </div>
          ) : null}

          {!loading && !err ? (
            <div className="mt-5 flex gap-2">
              <button
                onClick={checkStatus}
                disabled={checking}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-70"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                {checking ? "Mengecek..." : "Saya sudah membayar"}
              </button>

              <button
                onClick={() => router.replace("/topup")}
                className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-sm font-bold"
              >
                Batal
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}