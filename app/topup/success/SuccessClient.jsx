"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

function applyDepositOnce(order_id, amount) {
  if (typeof window === "undefined") return false;
  const flagKey = `yinnotp_deposit_applied_${order_id}`;
  if (localStorage.getItem(flagKey) === "1") return false;

  const amt = Number(String(amount).replace(/[^\d]/g, "")) || 0;
  if (amt <= 0) return false;

  const balRaw =
    localStorage.getItem("yinnotp_balance") ||
    localStorage.getItem("balance") ||
    "0";
  const bal = Number(String(balRaw).replace(/[^\d]/g, "")) || 0;
  const newBal = bal + amt;

  localStorage.setItem("yinnotp_balance", String(newBal));
  localStorage.setItem("balance", String(newBal));

  const histKey = "yinnotp_deposit_history";
  let hist = [];
  try {
    hist = JSON.parse(localStorage.getItem(histKey) || "[]");
    if (!Array.isArray(hist)) hist = [];
  } catch {
    hist = [];
  }

  hist.unshift({
    order_id,
    amount: amt,
    method: "qris",
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  localStorage.setItem(histKey, JSON.stringify(hist));
  localStorage.setItem(flagKey, "1");
  return true;
}

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [info, setInfo] = useState({ order_id: "", amount: "" });
  const [note, setNote] = useState("");

  useEffect(() => {
    const order_id = sp.get("order_id") || "";
    const amount = sp.get("amount") || "";

    if (!order_id) {
      router.replace("/topup");
      return;
    }

    setInfo({ order_id, amount });

    // optional: pastikan completed (kalau mau lebih strict)
    (async () => {
      try {
        const res = await fetch(
          `/api/pakasir/detail?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}`,
          { cache: "no-store" }
        );
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        const st = (json?.data?.transaction?.status || "").toLowerCase();

        if (st === "completed") {
          const applied = applyDepositOnce(order_id, amount);
          setNote(applied ? "Saldo berhasil ditambahkan." : "Saldo sudah pernah ditambahkan.");
        } else {
          setNote(`Status transaksi: ${st || "pending"}`);
        }
      } catch {
        // kalau gagal cek, tetap coba apply (biar UX enak)
        const applied = applyDepositOnce(order_id, amount);
        setNote(applied ? "Saldo berhasil ditambahkan." : "Saldo sudah pernah ditambahkan.");
      }
    })();
  }, [sp, router]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit diproses</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{info.order_id}</span>
          </div>
          {info.amount ? (
            <div className="text-sm text-[var(--yinn-muted)]">Nominal: {info.amount}</div>
          ) : null}

          {note ? <div className="mt-2 text-sm text-[var(--yinn-muted)]">{note}</div> : null}

          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{
                background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Kembali ke Dashboard
            </Link>
            <Link
              href="/topup"
              className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
            >
              Deposit lagi
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}