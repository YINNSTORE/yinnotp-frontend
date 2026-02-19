"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import ThemeMenu from "../../components/ThemeMenu";
import BottomNav from "../../components/BottomNav";
import { ArrowLeft, RefreshCw, Wallet, ChevronRight, Copy } from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function normBackend(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function getActiveUserId() {
  return (
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("yinnotp_username") ||
    localStorage.getItem("username") ||
    ""
  );
}

function getTokenForUser(uid) {
  const last = safeJson(localStorage.getItem("yinnotp:last_session"));
  return (
    localStorage.getItem("yinnotp_token") ||
    localStorage.getItem("yinnotp_token_active") ||
    (uid ? localStorage.getItem(`yinnotp_token:${uid}`) : "") ||
    last?.token ||
    ""
  );
}

function authHeaders(uid, token) {
  const h = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
    h["X-Token"] = token;
  }
  return h;
}

function formatDateTime(ts) {
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

function statusLabel(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("success") || v.includes("completed") || v.includes("paid")) return "Sukses";
  if (v.includes("pending") || v.includes("wait")) return "Menunggu";
  if (v.includes("failed") || v.includes("cancel")) return "Gagal";
  return v ? v : "—";
}

function isPending(s) {
  const v = String(s || "").toLowerCase();
  return v.includes("pending") || v.includes("wait");
}

export default function ActivityPage() {
  const backend = normBackend(process.env.NEXT_PUBLIC_BACKEND_URL);

  const [uid, setUid] = useState("");
  const [tab, setTab] = useState("deposit");
  const [balance, setBalance] = useState(0);

  const [items, setItems] = useState([]);
  const [lastSync, setLastSync] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const sessionToastOnceRef = useRef(false);

  const pendingKey = (u) => `yinnotp_pending_deposits:${u}`;
  const historyKey = (u) => `yinnotp_deposit_history:${u}`;
  const balanceKey = (u) => `yinnotp_balance:${u}`;
  const lastSyncKey = (u) => `yinnotp_deposit_last_sync:${u}`;

  function loadLocal(u) {
    const b =
      Number(String(localStorage.getItem(balanceKey(u)) || "0").replace(/[^\d]/g, "")) ||
      Number(String(localStorage.getItem("yinnotp_balance") || "0").replace(/[^\d]/g, "")) ||
      0;

    const hist = safeJson(localStorage.getItem(historyKey(u)));
    const pending = safeJson(localStorage.getItem(pendingKey(u)));
    const last = Number(localStorage.getItem(lastSyncKey(u)) || "0") || 0;

    const histArr = Array.isArray(hist) ? hist : [];
    const pendingArr = Array.isArray(pending) ? pending : [];

    const existingIds = new Set(histArr.map((x) => String(x?.order_id || x?.id || "")));
    const merged = [
      ...pendingArr.filter((p) => !existingIds.has(String(p?.order_id || ""))),
      ...histArr,
    ];

    setBalance(b);
    setItems(merged);
    setLastSync(last);
  }

  async function syncDeposit(showToast = true) {
    const u = getActiveUserId();
    const token = getTokenForUser(u);

    if (!backend) {
      if (showToast) toast.error("Backend URL belum diset");
      return;
    }
    if (!u || !token) {
      if (showToast && !sessionToastOnceRef.current) {
        sessionToastOnceRef.current = true;
        toast.error("Session user tidak ketemu. Login dulu.");
      }
      return;
    }

    setSyncing(true);
    try {
      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(u)}`, {
        cache: "no-store",
        headers: authHeaders(u, token),
      });
      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j?.ok) {
        if (showToast) toast.error(j?.message || `Gagal sync (HTTP ${r.status})`);
        return;
      }

      localStorage.setItem(balanceKey(u), String(j.balance || 0));
      localStorage.setItem(historyKey(u), JSON.stringify(j.history || []));
      localStorage.setItem(lastSyncKey(u), String(Date.now()));

      localStorage.setItem("yinnotp_balance", String(j.balance || 0));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(j.history || []));

      try {
        const pending = safeJson(localStorage.getItem(pendingKey(u)));
        const pendingArr = Array.isArray(pending) ? pending : [];
        const serverIds = new Set((j.history || []).map((x) => String(x?.order_id || x?.id || "")));
        const nextPending = pendingArr.filter((p) => !serverIds.has(String(p?.order_id || "")));
        localStorage.setItem(pendingKey(u), JSON.stringify(nextPending));
      } catch {}

      loadLocal(u);
      if (showToast) toast.success("Sync berhasil ✅");
    } catch {
      if (showToast) toast.error("Koneksi / server error saat sync");
    } finally {
      setSyncing(false);
    }
  }

  async function copyText(text) {
    const s = String(text || "");
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s);
      toast.success("Copied");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = s;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Copied");
      } catch {
        toast.error("Gagal copy");
      }
    }
  }

  const list = useMemo(() => {
    if (tab === "deposit") return items;
    return [];
  }, [items, tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = getActiveUserId();
    setUid(u);
    if (u) loadLocal(u);
    syncDeposit(false);
  }, []);

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
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">{uid ? `ID: ${uid}` : "—"}</div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <div
              className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              style={{ boxShadow: "var(--yinn-soft)" }}
            >
              <span className="text-[11px] font-semibold text-[var(--yinn-muted)]">Saldo </span>
              {formatIDR(balance)}
            </div>

            <button
              onClick={() => syncDeposit(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              style={{ boxShadow: "var(--yinn-soft)" }}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
            </button>

            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("deposit")}
            className={[
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold",
              tab === "deposit"
                ? "border-transparent text-white"
                : "border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
            ].join(" ")}
            style={
              tab === "deposit"
                ? { background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }
                : { boxShadow: "var(--yinn-soft)" }
            }
          >
            Deposit
          </button>

          <button
            onClick={() => toast("Order activity nyusul")}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-extrabold"
            style={{ boxShadow: "var(--yinn-soft)" }}
          >
            Orders
          </button>

          <div className="ms-auto text-[11px] text-[var(--yinn-muted)]">
            {lastSync ? `Updated: ${formatDateTime(lastSync)}` : "Belum sync"}
          </div>
        </div>

        {list.length ? (
          <div className="mt-4 space-y-2">
            {list.map((it, idx) => {
              const oid = String(it?.order_id || it?.id || "");
              const amt = Number(it?.amount || it?.price || 0) || 0;
              const st = statusLabel(it?.status);
              const pend = isPending(it?.status);
              const method = String(it?.method || it?.payment_method || "qris");
              const created = it?.created_at ? formatDateTime(it.created_at) : "—";

              return (
                <div
                  key={oid || `row-${idx}`}
                  className="w-full rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3"
                  style={{ boxShadow: "var(--yinn-soft)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-extrabold break-words">{oid || "—"}</div>
                          <div className="mt-1 text-[12px] text-[var(--yinn-muted)]">
                            {method} • {created}
                          </div>
                        </div>
                        <button
                          onClick={() => copyText(oid)}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)]"
                          title="Copy"
                          aria-label="Copy"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold">{amt ? formatIDR(amt) : "—"}</div>
                      <div
                        className="mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-bold"
                        style={{
                          background: pend ? "rgba(245,158,11,.15)" : "rgba(34,197,94,.12)",
                          color: pend ? "rgb(180,83,9)" : "rgb(22,163,74)",
                        }}
                      >
                        {st}
                      </div>
                    </div>
                  </div>

                  {pend ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--yinn-border)] px-3 py-2">
                      <div className="text-xs text-[var(--yinn-muted)]">Klik buat lanjut pembayaran</div>
                      <Link
                        href={`/topup/pay?order_id=${encodeURIComponent(oid)}&method=${encodeURIComponent(
                          method || "qris"
                        )}&resume=1${amt ? `&amount=${amt}` : ""}`}
                        className="text-sm font-extrabold"
                      >
                        Buka <ChevronRight className="inline" size={16} />
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="mt-4 grid place-items-center rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-6"
            style={{ boxShadow: "var(--yinn-soft)" }}
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)]">
              <Wallet size={18} />
            </div>
            <div className="mt-2 text-sm font-extrabold">Belum ada activity</div>
            <button
              onClick={() => syncDeposit(true)}
              className="mt-3 rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold"
            >
              Sync
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}