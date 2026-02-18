"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [info, setInfo] = useState({ order_id: "", amount: "" });

  useEffect(() => {
    const order_id = sp.get("order_id") || "";
    const amount = sp.get("amount") || "";

    if (!order_id) {
      router.replace("/topup");
      return;
    }

    setInfo({ order_id, amount });

    // ✅ kalau mau, panggil backend buat cek status transaksi
    // fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/deposit/detail?order_id=${order_id}&amount=${amount}`)
  }, [sp, router]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <div className="mx-auto max-w-[520px]">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
             style={{ boxShadow: "var(--yinn-soft)" }}>
          <div className="text-lg font-extrabold">Pembayaran diproses</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{info.order_id}</span>
          </div>
          {info.amount ? (
            <div className="text-sm text-[var(--yinn-muted)]">Nominal: {info.amount}</div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
            >
              Kembali ke Dashboard
            </Link>
            <Link
              href="/topup"
              className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
            >
              Topup lagi
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}