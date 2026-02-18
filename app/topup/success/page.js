"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export default function TopupSuccessPage() {
  const sp = useSearchParams();
  const order_id = sp.get("order_id") || "-";
  const amount = Number(sp.get("amount") || "0");

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <Link
            href="/topup"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="text-sm font-extrabold">Deposit berhasil</div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-6">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={28} />
            <div>
              <div className="text-base font-extrabold">Pembayaran terkonfirmasi</div>
              <div className="text-xs text-[var(--yinn-muted)]">Order ID: {order_id}</div>
            </div>
          </div>

          <div className="mt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--yinn-muted)]">Nominal</span>
              <span className="font-extrabold">{formatIDR(amount)}</span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
            }}
          >
            Balik ke Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}