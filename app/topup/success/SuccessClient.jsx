"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

function getActiveUserId() {
  if (typeof window === "undefined") return "";
  const direct =
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("yinnotp_username") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("username") ||
    "";
  if (direct) return direct;

  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    const obj = raw ? JSON.parse(raw) : null;
    return obj?.username || "";
  } catch {
    return "";
  }
}

function ensureActiveUser(uid) {
  if (typeof window === "undefined") return;
  if (!uid) return;
  localStorage.setItem("yinnotp_active_user", uid);
  localStorage.setItem("yinnotp_user_id", uid);
  localStorage.setItem("yinnotp_username", uid);
}

function k(uid, name) {
  return `yinnotp:${uid}:${name}`;
}

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text };
  }
}

export default function SuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const uid = useMemo(() => getActiveUserId(), []);
  const order_id = sp.get("order_id") || "";
  const amount = sp.get("amount") || "";

  const [status, setStatus] = useState("checking");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }
    if (!backend) {
      setErr("Backend URL belum diset");
      return;
    }

    ensureActiveUser(uid);

    let alive = true;

    const syncMe = async () => {
      if (!uid) return;
      const res = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers: { "x-user-id": uid },
      });
      const j = await readJsonSafe(res);
      if (!res.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      const hist = Array.isArray(j.history) ? j.history : [];

      localStorage.setItem(k(uid, "balance"), String(bal));
      localStorage.setItem(k(uid, "deposit_history"), JSON.stringify(hist));
      localStorage.setItem("yinnotp_balance", String(bal));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(hist));
    };

    const tick = async () => {
      try {
        const res = await fetch(
          `${backend}/deposit/detail?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(
            amount
          )}`,
          {
            cache: "no-store",
            headers: uid ? { "x-user-id": uid } : {},
          }
        );
        const j = await readJsonSafe(res);

        const st = String(j?.status || j?.data?.status || "").toLowerCase();

        if (!alive) return;

        if (st === "completed" || st === "success" || st === "paid") {
          setStatus("success");

          // confirm (idempotent) + sync
          if (uid) {
            await fetch(`${backend}/deposit/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-user-id": uid },
              body: JSON.stringify({ order_id }),
            }).catch(() => {});
            await syncMe().catch(() => {});
          }

          toast.success("Deposit sukses ✅");
          return;
        }

        if (st === "failed" || st === "canceled" || st === "cancel") {
          setStatus("failed");
          setErr("Pembayaran gagal / dibatalkan");
          return;
        }

        setStatus(st || "pending");
      } catch (e) {
        if (!alive) return;
        setStatus("pending");
      }
    };

    tick();
    const timer = setInterval(tick, 3000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [order_id, amount, backend, uid, router]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">
            {status === "success"
              ? "Deposit sukses ✅"
              : status === "failed"
              ? "Deposit gagal ❌"
              : "Memeriksa pembayaran..."}
          </div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)] break-all">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>

          {amount ? (
            <div className="text-sm text-[var(--yinn-muted)]">Nominal: {amount}</div>
          ) : null}

          {err ? (
            <div className="mt-3 rounded-xl border border-[var(--yinn-border)] p-3 text-sm">
              <div className="font-extrabold">Info</div>
              <div className="text-[var(--yinn-muted)]">{err}</div>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Ke Dashboard
            </Link>

            <Link
              href="/topup"
              className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
            >
              Ke Deposit
            </Link>
          </div>

          {status !== "success" ? (
            <div className="mt-3 text-xs text-[var(--yinn-muted)]">
              Auto check tiap 3 detik. Jangan tutup halaman ini.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}