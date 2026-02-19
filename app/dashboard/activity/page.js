"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThemeMenu from "../../components/ThemeMenu";
import BottomNav from "../../components/BottomNav";
import { ArrowLeft, Trash2, Copy } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { activityClear, activityList } from "../../_lib/activityStore";

function copyText(t) {
  const s = String(t || "");
  if (!s) return false;
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(s);
    return true;
  }
  const el = document.createElement("textarea");
  el.value = s;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  return true;
}

function fmt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badge(type) {
  const t = String(type || "");
  if (t === "order_create") return { label: "ORDER", bg: "rgba(67,97,238,.14)" };
  if (t === "order_status") return { label: "STATUS", bg: "rgba(34,197,94,.14)" };
  return { label: "LOG", bg: "rgba(245,158,11,.14)" };
}

export default function ActivityPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(activityList());
  }, []);

  const grouped = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr;
  }, [items]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            style={{ boxShadow: "var(--yinn-soft)" }}
            aria-label="Kembali"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight">Activity</div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">{grouped.length} items</div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => {
                activityClear();
                setItems([]);
                toast.success("Cleared");
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Clear"
              title="Clear"
            >
              <Trash2 size={18} />
            </button>
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {grouped.length ? (
          <div className="grid gap-3">
            {grouped.map((it, idx) => {
              const b = badge(it?.type);
              const oid = String(it?.order_id || "");
              const otp = String(it?.otp_code || "");
              const phone = String(it?.phone_number || "");
              const st = String(it?.status || "");
              const service = String(it?.service || "");
              const country = String(it?.country || "");
              const operator = String(it?.operator || "");
              const price = Number(it?.price || 0) || 0;

              return (
                <div
                  key={`${oid}-${idx}-${it?.ts || idx}`}
                  className="rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{ background: "var(--yinn-surface)", boxShadow: "var(--yinn-soft)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="inline-flex rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ background: b.bg }}>
                        {b.label}
                      </div>
                      <div className="mt-2 text-sm font-extrabold break-all">{oid || "—"}</div>
                      <div className="mt-1 text-[12px] text-[var(--yinn-muted)]">{fmt(it?.ts)}</div>
                    </div>

                    <button
                      onClick={() => {
                        copyText(oid);
                        toast.success("Copied");
                      }}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
                      title="Copy Order ID"
                      aria-label="Copy"
                    >
                      <Copy size={18} />
                    </button>
                  </div>

                  {it?.type === "order_create" ? (
                    <div className="mt-3 grid gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Service</span>
                        <span className="font-extrabold">{service || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Country</span>
                        <span className="font-extrabold">{country || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Operator</span>
                        <span className="font-extrabold">{operator || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Phone</span>
                        <span className="font-extrabold">{phone || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Price</span>
                        <span className="font-extrabold">Rp {price.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Status</span>
                        <span className="font-extrabold">{st || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">OTP</span>
                        <span className="font-extrabold">{otp || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]"
            style={{ background: "var(--yinn-surface)", boxShadow: "var(--yinn-soft)" }}
          >
            Belum ada activity.
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}