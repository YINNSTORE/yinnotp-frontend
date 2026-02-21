"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThemeMenu from "../../components/ThemeMenu";
import BottomNav from "../../components/BottomNav";
import { ArrowLeft, Trash2, Copy, RefreshCcw, Wallet } from "lucide-react";
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
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function extractTokenFromUnknown(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    return v.token || v.access_token || v.accessToken || v.jwt || v.sessionToken || "";
  }
  return "";
}

function getTokenFromStorage() {
  if (typeof window === "undefined") return "";

  const candidates = [
    localStorage.getItem("yinnotp_token"),
    localStorage.getItem("token"),
    localStorage.getItem("access_token"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("jwt"),
    localStorage.getItem("sessionToken"),
    localStorage.getItem("auth_token"),
    localStorage.getItem("yinnotp_auth"),
    localStorage.getItem("auth"),
    localStorage.getItem("session"),
    sessionStorage.getItem("yinnotp_token"),
    sessionStorage.getItem("token"),
    sessionStorage.getItem("access_token"),
    sessionStorage.getItem("yinnotp_auth"),
  ].filter(Boolean);

  for (const raw of candidates) {
    if (typeof raw === "string" && raw.length > 20 && !raw.trim().startsWith("{")) return raw.trim();
    try {
      const obj = JSON.parse(raw);
      const t = extractTokenFromUnknown(obj);
      if (t && typeof t === "string" && t.length > 20) return t.trim();
    } catch (_) {}
  }

  const cookieToken =
    readCookie("yinnotp_token") || readCookie("token") || readCookie("access_token") || readCookie("accessToken");

  if (cookieToken && cookieToken.length > 20) return cookieToken.trim();

  return "";
}

function isDepositPaid(d) {
  const s = String(d?.status || d?.gateway_status || "").toLowerCase();
  return s === "paid" || s === "completed" || s.includes("paid") || s.includes("completed") || s.includes("settled");
}

function badge(type) {
  const t = String(type || "");

  // ORDER
  if (t === "order_create") return { label: "ORDER", bg: "rgba(67,97,238,.14)" };
  if (t === "order_status") return { label: "STATUS", bg: "rgba(34,197,94,.14)" };

  // DEPOSIT
  if (t === "deposit_paid") return { label: "DEPOSIT", bg: "rgba(168,85,247,.16)" };

  return { label: "LOG", bg: "rgba(245,158,11,.14)" };
}

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all"); // all | order | deposit
  const [loading, setLoading] = useState(false);

  async function loadDepositPaid() {
    const token = getTokenFromStorage();
    if (!token) return [];

    try {
      const r = await fetch("/api/deposit/me.php", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await r.json();

      const list = Array.isArray(j?.history) ? j.history : Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const paid = list.filter(isDepositPaid);

      // mapping jadi activity item
      return paid.map((d) => {
        const orderId = String(d?.order_id || d?.orderId || d?.reference || "");
        const ts = d?.paid_at || d?.completed_at || d?.updated_at || d?.created_at || null;

        return {
          type: "deposit_paid",
          ts,
          order_id: orderId,
          deposit_id: d?.id,
          amount: Number(d?.amount || 0) || 0,
          fee: Number(d?.fee || 0) || 0,
          total_payment: Number(d?.total_payment || 0) || 0,
          payment_method: d?.payment_method || d?.method || "—",
          reference: d?.reference || "—",
        };
      });
    } catch {
      return [];
    }
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const local = activityList();
      const deposits = await loadDepositPaid();

      // gabung + sort desc by ts
      const merged = [...(Array.isArray(local) ? local : []), ...deposits].sort((a, b) => {
        const ta = new Date(a?.ts || 0).getTime() || 0;
        const tb = new Date(b?.ts || 0).getTime() || 0;
        return tb - ta;
      });

      setItems(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    if (tab === "order") return arr.filter((x) => String(x?.type || "").startsWith("order_"));
    if (tab === "deposit") return arr.filter((x) => String(x?.type || "") === "deposit_paid");
    return arr;
  }, [items, tab]);

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
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {filtered.length} items {loading ? "• syncing..." : ""}
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => {
                refreshAll();
                toast.success("Synced");
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCcw size={18} />
            </button>

            <button
              onClick={() => {
                activityClear();
                // deposit remote gak dihapus, jadi kita refresh ulang
                refreshAll();
                toast.success("Cleared (order logs)");
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

        {/* filter chips */}
        <div className="mx-auto max-w-[520px] px-4 pb-3">
          <div className="flex items-center gap-2">
            {[
              { k: "all", label: "Semua" },
              { k: "order", label: "Order" },
              { k: "deposit", label: "Deposit" },
            ].map((c) => (
              <button
                key={c.k}
                onClick={() => setTab(c.k)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-extrabold",
                  tab === c.k ? "border-transparent text-white" : "border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
                ].join(" ")}
                style={
                  tab === c.k
                    ? { background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }
                    : { boxShadow: "var(--yinn-soft)" }
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {filtered.length ? (
          <div className="grid gap-3">
            {filtered.map((it, idx) => {
              const b = badge(it?.type);

              // shared
              const oid = String(it?.order_id || "");
              const ts = it?.ts;

              // order fields
              const otp = String(it?.otp_code || "");
              const phone = String(it?.phone_number || "");
              const st = String(it?.status || "");
              const service = String(it?.service || "");
              const country = String(it?.country || "");
              const operator = String(it?.operator || "");
              const price = Number(it?.price || 0) || 0;

              // deposit fields
              const amount = Number(it?.amount || 0) || 0;
              const fee = Number(it?.fee || 0) || 0;
              const total = Number(it?.total_payment || (amount + fee) || 0) || 0;
              const method = String(it?.payment_method || "—");
              const reference = String(it?.reference || "—");

              const isDeposit = String(it?.type || "") === "deposit_paid";

              return (
                <div
                  key={`${oid}-${idx}-${ts || idx}`}
                  className="rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{ background: "var(--yinn-surface)", boxShadow: "var(--yinn-soft)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ background: b.bg }}>
                          {b.label}
                        </div>

                        {isDeposit ? (
                          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--yinn-border)] px-2 py-1 text-[11px] font-extrabold">
                            <Wallet size={14} />
                            <span className="uppercase">{method}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 text-sm font-extrabold break-all">{oid || "—"}</div>
                      <div className="mt-1 text-[12px] text-[var(--yinn-muted)]">{fmt(ts)}</div>
                    </div>

                    <button
                      onClick={() => {
                        copyText(oid);
                        toast.success("Copied");
                      }}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
                      title="Copy ID"
                      aria-label="Copy"
                    >
                      <Copy size={18} />
                    </button>
                  </div>

                  {/* BODY */}
                  {isDeposit ? (
                    <div className="mt-3 grid gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Nominal</span>
                        <span className="font-extrabold">Rp {amount.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Fee</span>
                        <span className="font-extrabold">Rp {fee.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--yinn-muted)]">Total</span>
                        <span className="font-extrabold">Rp {total.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="mt-2 rounded-xl border border-[var(--yinn-border)] p-3 text-[12px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--yinn-muted)]">Reference</span>
                          <span className="font-extrabold break-all">{reference}</span>
                        </div>
                      </div>
                    </div>
                  ) : it?.type === "order_create" ? (
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