"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function makeOrderId() {
  // contoh: DEP-1700000000000-AB12CD
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEP-${Date.now()}-${rand}`;
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");

  const amount = useMemo(() => {
    const raw = sp.get("amount") || sp.get("nominal") || "";
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [sp]);

  useEffect(() => {
    // Wajib ada amount
    if (!amount || amount < 1000) {
      setStatus("error");
      setError("Nominal tidak valid. Balik ke halaman deposit dan pilih nominal.");
      return;
    }

    const project =
      process.env.NEXT_PUBLIC_PAKASIR_PROJECT ||
      process.env.NEXT_PUBLIC_PAKASIR_SLUG ||
      "";

    if (!project) {
      setStatus("error");
      setError("ENV Pakasir belum diisi: NEXT_PUBLIC_PAKASIR_PROJECT (slug proyek).");
      return;
    }

    // Biar kalau reload gak bikin order_id baru terus
    const key = `yinnotp_depo_${amount}`;
    let orderId = "";
    try {
      orderId = sessionStorage.getItem(key) || "";
      if (!orderId) {
        orderId = makeOrderId();
        sessionStorage.setItem(key, orderId);
      }
    } catch {
      orderId = makeOrderId();
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const successUrl = `${origin}/topup/success?order_id=${encodeURIComponent(
      orderId
    )}&amount=${encodeURIComponent(String(amount))}`;

    // Pakasir hosted page (langsung QRIS), ini yang harus kebuka:
    const url =
      `https://app.pakasir.com/pay/${encodeURIComponent(project)}/${encodeURIComponent(
        String(amount)
      )}` +
      `?order_id=${encodeURIComponent(orderId)}` +
      `&qris_only=1` +
      `&redirect=${encodeURIComponent(successUrl)}`;

    setPaymentUrl(url);
    setStatus("ready");

    // ✅ Redirect external HARUS pakai window.location (router.push suka gak jalan buat external)
    const t = setTimeout(() => {
      try {
        window.location.replace(url);
      } catch (e) {
        setStatus("error");
        setError("Gagal redirect otomatis. Silakan klik tombol Lanjut.");
      }
    }, 400);

    return () => clearTimeout(t);
  }, [amount]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-10">
      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          {status === "loading" ? (
            <>
              <div className="text-base font-extrabold">Menyiapkan pembayaran...</div>
              <div className="mt-1 text-sm text-[var(--yinn-muted)]">
                Jangan tutup halaman ini.
              </div>
            </>
          ) : null}

          {status === "ready" ? (
            <>
              <div className="text-base font-extrabold">Menyiapkan pembayaran...</div>
              <div className="mt-1 text-sm text-[var(--yinn-muted)]">
                Kalau tidak pindah otomatis, klik tombol di bawah.
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={paymentUrl}
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Lanjut ke QRIS
                </a>

                <button
                  onClick={() => router.replace("/topup")}
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Batal
                </button>
              </div>
            </>
          ) : null}

          {status === "error" ? (
            <>
              <div className="text-base font-extrabold">Gagal menyiapkan pembayaran</div>
              <div className="mt-2 text-sm text-[var(--yinn-muted)]">{error}</div>

              <div className="mt-4 flex gap-2">
                <Link
                  href="/topup"
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Balik ke Deposit
                </Link>

                {paymentUrl ? (
                  <a
                    href={paymentUrl}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Coba buka QRIS
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}