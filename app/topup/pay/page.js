"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  XCircle,
} from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function msToClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function PayPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const method = sp.get("method") || "qris";
  const amount = Number(sp.get("amount") || "0");
  const order_id = sp.get("order_id") || "";

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [leftMs, setLeftMs] = useState(0);

  const payUrl = useMemo(() => {
    // fallback hosted page (kalau user mau buka halaman pakasir langsung)
    const base = "https://app.pakasir.com";
    const project = "PROJECT_SLUG_DI_ENV"; // cuma label; bukan dipakai
    const redirect = typeof window !== "undefined" ? `${window.location.origin}/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${amount}` : "";
    if (method === "paypal") {
      return `${base}/paypal/${project}/${amount}?order_id=${encodeURIComponent(order_id)}&redirect=${encodeURIComponent(redirect)}`;
    }
    return `${base}/pay/${project}/${amount}?order_id=${encodeURIComponent(order_id)}&redirect=${encodeURIComponent(redirect)}${method === "qris" ? "&qris_only=1" : ""}`;
  }, [method, amount, order_id]);

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/pakasir/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount, order_id }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.message || "Gagal create transaksi");

      const p = data.payment;
      setPayment(p);

      // countdown
      const exp = Date.parse(p?.expired_at || "");
      if (Number.isFinite(exp)) {
        setLeftMs(exp - Date.now());
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!order_id || !amount) {
      router.replace("/topup");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  useEffect(() => {
    if (!payment?.expired_at) return;

    const t = setInterval(() => {
      const exp = Date.parse(payment.expired_at);
      if (!Number.isFinite(exp)) return;
      setLeftMs(exp - Date.now());
    }, 1000);

    return () => clearInterval(t);
  }, [payment?.expired_at]);

  const copy = async (txt) => {
    try {
      await navigator.clipboard.writeText(String(txt || ""));
    } catch {}
  };

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/pakasir/detail?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`);
      const data = await res.json();
      const status = data?.transaction?.status;

      if (status === "completed") {
        // demo update saldo (sementara)
        if (typeof window !== "undefined") {
          const cur = Number(String(localStorage.getItem("yinnotp_balance") || "0").replace(/[^\d]/g, "")) || 0;
          localStorage.setItem("yinnotp_balance", String(cur + amount));
        }
        router.push(`/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${amount}`);
        return;
      }

      alert(`Status: ${status || "pending"}`);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setChecking(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Batalkan transaksi ini?")) return;
    try {
      const res = await fetch("/api/pakasir/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id, amount }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error("Gagal cancel");
      router.push("/topup");
    } catch (e) {
      alert(String(e?.message || e));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <Link
            href="/topup"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            aria-label="Kembali"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight">Payment</div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {order_id}
            </div>
          </div>

          <button
            onClick={load}
            className="ms-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
            Memuat transaksi...
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
            <div className="text-sm font-extrabold">Gagal</div>
            <div className="mt-2 text-sm text-[var(--yinn-muted)]">{err}</div>
            <div className="mt-3">
              <a
                href={payUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
              >
                Buka halaman pembayaran <ExternalLink size={16} />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-[var(--yinn-muted)]">Waktu Kadaluarsa</div>
                  <div className="mt-1 text-sm font-extrabold">
                    {payment?.expired_at ? new Date(payment.expired_at).toLocaleString("id-ID") : "-"}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold">
                  {msToClock(leftMs)}
                </div>
              </div>
              <div className="mt-2 text-xs text-[var(--yinn-muted)]">
                Harap membayar sebelum kadaluarsa agar saldo dapat diproses.
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {/* QR/VA Card */}
              <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
                <div className="text-sm font-extrabold">Instruksi Pembayaran</div>

                {payment?.payment_method === "qris" ? (
                  <div className="mt-3 grid place-items-center">
                    <div className="rounded-2xl border border-[var(--yinn-border)] bg-white p-3">
                      <img
                        alt="QRIS"
                        width={260}
                        height={260}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                          payment.payment_number || ""
                        )}`}
                      />
                    </div>
                    <div className="mt-3 text-sm font-bold">Scan QRIS untuk bayar</div>
                  </div>
                ) : payment?.payment_method === "paypal" ? (
                  <div className="mt-3">
                    <div className="text-sm text-[var(--yinn-muted)]">
                      Metode PayPal: lanjutkan via halaman pembayaran.
                    </div>
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                      }}
                    >
                      Buka PayPal <ExternalLink size={16} />
                    </a>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="text-xs text-[var(--yinn-muted)]">Nomor Virtual Account</div>
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-2xl border border-[var(--yinn-border)] p-3">
                      <div className="min-w-0 break-all text-sm font-extrabold">
                        {payment?.payment_number || "-"}
                      </div>
                      <button
                        onClick={() => copy(payment?.payment_number)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
                        aria-label="Copy VA"
                        title="Copy VA"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-[var(--yinn-muted)]">
                      Transfer sesuai total pembayaran.
                    </div>
                  </div>
                )}

                <a
                  href={payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-4 py-3 text-sm font-extrabold"
                >
                  Buka halaman pembayaran (opsional) <ExternalLink size={16} />
                </a>
              </div>

              {/* Detail card */}
              <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
                <div className="text-sm font-extrabold">Detail Pembayaran</div>

                <div className="mt-3 grid gap-2 text-sm">
                  <Row label="Payment ID" value={payment?.order_id} copyFn={copy} />
                  <Row label="Metode" value={payment?.payment_method} />
                  <Row label="Nominal" value={formatIDR(payment?.amount)} />
                  <Row label="Biaya Admin" value={formatIDR(payment?.fee)} />
                  <Row label="Total Pembayaran" value={formatIDR(payment?.total_payment)} strong />
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--yinn-border)] p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">Gateway pembayaran oleh Pakasir</div>
                    <div className="text-xs text-[var(--yinn-muted)]">
                      Status deposit diverifikasi via API.
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={cancel}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-4 py-3 text-sm font-extrabold"
                  >
                    <XCircle size={18} /> Batalkan
                  </button>
                  <button
                    disabled={checking}
                    onClick={checkStatus}
                    className="rounded-2xl px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    {checking ? "Mengecek..." : "Saya sudah membayar ✓"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, strong, copyFn }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[var(--yinn-muted)]">{label}</div>
      <div className={strong ? "font-extrabold" : "font-semibold"}>
        <span className="break-all">{value || "-"}</span>
        {copyFn && value ? (
          <button
            onClick={() => copyFn(value)}
            className="ms-2 inline-flex items-center justify-center rounded-lg border border-[var(--yinn-border)] px-2 py-1 text-xs"
          >
            copy
          </button>
        ) : null}
      </div>
    </div>
  );
}