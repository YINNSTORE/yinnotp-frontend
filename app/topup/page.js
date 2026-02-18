"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import ThemeMenu from "../components/ThemeMenu";
import BottomNav from "../components/BottomNav";
import {
  ArrowLeft,
  Plus,
  Wallet,
  Clock,
  RefreshCw,
  QrCode,
  CreditCard,
  Landmark,
  ChevronRight,
} from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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
  const h = {};
  if (!token) return h;
  h["Authorization"] = `Bearer ${token}`;
  h["X-Token"] = token;
  h["X-User-Id"] = uid;
  return h;
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stepper({ step }) {
  const steps = ["Jumlah", "Metode", "Konfirmasi"];
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        {steps.map((s, idx) => {
          const i = idx + 1;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s} className="flex-1">
              <div className="flex items-center">
                <div
                  className="grid h-9 w-9 place-items-center rounded-full border"
                  style={{
                    borderColor: done || active ? "rgba(67,97,238,.55)" : "var(--yinn-border)",
                    background: done || active ? "rgba(67,97,238,.12)" : "transparent",
                    color: done || active ? "var(--yinn-text)" : "var(--yinn-muted)",
                    fontWeight: 800,
                  }}
                >
                  {i}
                </div>
                {i !== 3 && (
                  <div
                    className="mx-2 h-[3px] flex-1 rounded-full"
                    style={{
                      background: i < step ? "rgba(67,97,238,.45)" : "var(--yinn-border)",
                    }}
                  />
                )}
              </div>
              <div
                className="mt-2 text-center text-[12px] font-semibold"
                style={{ color: active ? "var(--yinn-text)" : "var(--yinn-muted)" }}
              >
                {s}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0" style={{ background: "rgba(2,6,23,.55)" }} onClick={onClose} />
      <div className="absolute inset-x-0 top-14 mx-auto max-w-[520px] px-4">
        <div
          className="rounded-2xl border p-4"
          style={{
            background: "var(--yinn-surface)",
            borderColor: "var(--yinn-border)",
            boxShadow: "0 22px 60px rgba(2,6,23,.32)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TopupPage() {
  const router = useRouter();
  const backend = normBackend(process.env.NEXT_PUBLIC_BACKEND_URL);

  const [user, setUser] = useState({ name: "User", balance: 0 });
  const [history, setHistory] = useState([]);
  const [lastSync, setLastSync] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [amount, setAmount] = useState(2000);
  const [method, setMethod] = useState("qris");
  const [loadingGo, setLoadingGo] = useState(false);

  const presets = useMemo(() => [2000, 20000, 50000, 70000, 100000, 200000], []);

  const methods = useMemo(
    () => [
      {
        title: "Pembayaran Indonesia",
        items: [{ key: "qris", label: "QRIS", desc: "Pembayaran instan", Icon: QrCode }],
      },
      {
        title: "Virtual Account",
        items: [
          { key: "bri_va", label: "BRI VA", desc: "Virtual Account", Icon: Landmark },
          { key: "bni_va", label: "BNI VA", desc: "Virtual Account", Icon: Landmark },
          { key: "cimb_niaga_va", label: "CIMB Niaga VA", desc: "Virtual Account", Icon: Landmark },
          { key: "permata_va", label: "Permata VA", desc: "Virtual Account", Icon: Landmark },
          { key: "maybank_va", label: "Maybank VA", desc: "Virtual Account", Icon: Landmark },
          { key: "sampoerna_va", label: "Sampoerna VA", desc: "Virtual Account", Icon: Landmark },
          { key: "bnc_va", label: "BNC VA", desc: "Virtual Account", Icon: Landmark },
          { key: "atm_bersama_va", label: "ATM Bersama VA", desc: "Virtual Account", Icon: Landmark },
          { key: "artha_graha_va", label: "Artha Graha VA", desc: "Virtual Account", Icon: Landmark },
        ],
      },
      {
        title: "Paypal",
        items: [{ key: "paypal", label: "PayPal", desc: "Pembayaran PayPal", Icon: CreditCard }],
      },
    ],
    []
  );

  function pendingKey(uid) {
    return `yinnotp_pending_deposits:${uid}`;
  }
  function historyKey(uid) {
    return `yinnotp_deposit_history:${uid}`;
  }
  function balanceKey(uid) {
    return `yinnotp_balance:${uid}`;
  }
  function lastSyncKey(uid) {
    return `yinnotp_deposit_last_sync:${uid}`;
  }

  function loadLocal(uid) {
    const bal = Number(String(localStorage.getItem(balanceKey(uid)) || "0").replace(/[^\d]/g, "")) || 0;
    const hist = safeJson(localStorage.getItem(historyKey(uid)));
    const pending = safeJson(localStorage.getItem(pendingKey(uid)));
    const last = Number(localStorage.getItem(lastSyncKey(uid)) || "0") || 0;

    const histArr = Array.isArray(hist) ? hist : [];
    const pendingArr = Array.isArray(pending) ? pending : [];

    // merge pending yang belum ada di history server
    const existingIds = new Set(histArr.map((x) => String(x?.order_id || x?.id || "")));
    const merged = [...pendingArr.filter((p) => !existingIds.has(String(p?.order_id || ""))), ...histArr];

    setUser((u) => ({ ...u, balance: bal }));
    setHistory(merged);
    setLastSync(last);
  }

  async function syncDeposit(showToast = true) {
    const uid = getActiveUserId();
    const token = getTokenForUser(uid);

    if (!backend) {
      if (showToast) toast.error("Backend URL belum diset");
      return;
    }
    if (!uid || !token) {
      if (showToast) toast.error("Session user tidak ketemu. Login dulu.");
      return;
    }

    setSyncing(true);
    try {
      const headers = authHeaders(uid, token);
      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers,
      });
      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j?.ok) {
        if (showToast) toast.error(j?.message || `Gagal sync (HTTP ${r.status})`);
        return;
      }

      // simpan server history
      localStorage.setItem(balanceKey(uid), String(j.balance || 0));
      localStorage.setItem(historyKey(uid), JSON.stringify(j.history || []));
      localStorage.setItem(lastSyncKey(uid), String(Date.now()));

      // legacy (kalau masih dipakai tempat lain)
      localStorage.setItem("yinnotp_balance", String(j.balance || 0));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(j.history || []));

      // bersihin pending yang udah completed di server
      try {
        const pending = safeJson(localStorage.getItem(pendingKey(uid)));
        const pendingArr = Array.isArray(pending) ? pending : [];
        const serverIds = new Set((j.history || []).map((x) => String(x?.order_id || x?.id || "")));
        const nextPending = pendingArr.filter((p) => !serverIds.has(String(p?.order_id || "")));
        localStorage.setItem(pendingKey(uid), JSON.stringify(nextPending));
      } catch {}

      loadLocal(uid);

      if (showToast) toast.success("Sync berhasil ✅");
    } catch {
      if (showToast) toast.error("Koneksi / server error saat sync");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedName =
      localStorage.getItem("yinnotp_name") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("username") ||
      "User";

    setUser((u) => ({ ...u, name: storedName }));

    const uid = getActiveUserId();
    if (uid) loadLocal(uid);

    // sync silent pas buka halaman
    syncDeposit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDeposit = () => {
    // biar popup gak delay
    setOpen(true);
    setAmount(2000);
    setMethod("qris");
    setStep(1);
  };

  const goNext = () => setStep((s) => clamp(s + 1, 1, 3));
  const goBack = () => setStep((s) => clamp(s - 1, 1, 3));

  const createOrderId = () => {
    const r = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `YINN-${Date.now()}-${r}`;
  };

  function addPendingLocal(uid, item) {
    try {
      const arr = safeJson(localStorage.getItem(pendingKey(uid)));
      const list = Array.isArray(arr) ? arr : [];
      localStorage.setItem(pendingKey(uid), JSON.stringify([item, ...list]));
    } catch {}
  }

  const onConfirm = async () => {
    const uid = getActiveUserId();
    const a = clamp(Number(amount) || 0, 2000, 1000000);

    setLoadingGo(true);
    try {
      const order_id = createOrderId();

      // simpan pending lokal dulu (biar “menunggu” pasti tampil)
      if (uid) {
        const pendingItem = {
          order_id,
          amount: a,
          method,
          status: "pending",
          created_at: Date.now(),
        };
        addPendingLocal(uid, pendingItem);
        // update state cepat
        setHistory((h) => [pendingItem, ...(Array.isArray(h) ? h : [])]);
      }

      setOpen(false);
      router.push(
        `/topup/pay?method=${encodeURIComponent(method)}&amount=${a}&order_id=${encodeURIComponent(order_id)}`
      );
    } finally {
      setLoadingGo(false);
    }
  };

  function statusLabel(s) {
    const v = String(s || "").toLowerCase();
    if (v.includes("success") || v.includes("completed") || v.includes("paid")) return "Sukses";
    if (v.includes("pending") || v.includes("wait")) return "Menunggu";
    return v ? v : "—";
  }

  function isPending(s) {
    const v = String(s || "").toLowerCase();
    return v.includes("pending") || v.includes("wait");
  }

  function openHistoryItem(it) {
    const oid = String(it?.order_id || it?.id || "");
    const amt = Number(it?.amount || it?.price || 0) || 0;
    const m = String(it?.method || it?.payment_method || "qris");
    if (!oid || !amt) return;

    // pending -> buka halaman QR
    if (isPending(it?.status)) {
      router.push(`/topup/pay?method=${encodeURIComponent(m)}&amount=${amt}&order_id=${encodeURIComponent(oid)}&resume=1`);
    } else {
      toast("Status: " + statusLabel(it?.status));
    }
  }

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      {/* TOP BAR */}
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
            <div className="truncate text-sm font-extrabold leading-tight">Deposit</div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">Isi saldo untuk beli OTP</div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {/* 2 cards row */}
        <section className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{ background: "var(--yinn-surface)", borderColor: "var(--yinn-border)", boxShadow: "var(--yinn-soft)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wide text-[var(--yinn-muted)]">ACCOUNT</div>
                <div className="text-sm font-extrabold">Balance Summary</div>
              </div>
              <button
                onClick={() => syncDeposit(true)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)]"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs text-[var(--yinn-muted)]">Saldo akun kamu</div>
              <div className="mt-1 text-xl font-extrabold">{formatIDR(user.balance)}</div>
              <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                Updated: {lastSync ? formatDateTime(lastSync) : "Belum sync"}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/dashboard/activity"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-bold"
              >
                <Clock size={16} /> Aktifitas
              </Link>
              <button
                onClick={openDeposit}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
              >
                <Plus size={16} /> Deposit
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ background: "var(--yinn-surface)", borderColor: "var(--yinn-border)", boxShadow: "var(--yinn-soft)" }}
          >
            <div className="flex items-start justify-between">
              <div className="text-sm font-extrabold">Riwayat pembayaran</div>
              <div className="text-[11px] text-[var(--yinn-muted)]">Updated: {lastSync ? formatDateTime(lastSync) : "—"}</div>
            </div>

            {history.length ? (
              <div className="mt-3 space-y-2">
                {history.slice(0, 3).map((it) => {
                  const oid = String(it?.order_id || it?.id || "");
                  const amt = Number(it?.amount || it?.price || 0) || 0;
                  const st = statusLabel(it?.status);
                  const pend = isPending(it?.status);

                  return (
                    <button
                      key={oid || Math.random()}
                      onClick={() => openHistoryItem(it)}
                      className="w-full rounded-2xl border border-[var(--yinn-border)] p-3 text-left"
                      style={{ background: "var(--yinn-surface)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold break-words">{oid || "—"}</div>
                          <div className="mt-1 text-[12px] text-[var(--yinn-muted)]">
                            {String(it?.method || it?.payment_method || "qris")}{" "}
                            {it?.created_at ? `• ${formatDateTime(it.created_at)}` : ""}
                            {pend ? " • klik untuk buka" : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold">Rp {amt.toLocaleString("id-ID")}</div>
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
                    </button>
                  );
                })}

                <button
                  onClick={() => syncDeposit(true)}
                  className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] py-2 text-sm font-bold text-[var(--yinn-muted)]"
                >
                  {syncing ? "Sync..." : "sync lagi ›"}
                </button>
              </div>
            ) : (
              <div className="mt-4 grid place-items-center rounded-2xl border border-[var(--yinn-border)] p-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)]">
                  <Wallet size={18} />
                </div>
                <div className="mt-2 text-sm font-bold">Belum ada riwayat deposit</div>
                <button
                  onClick={openDeposit}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-bold"
                >
                  <Plus size={16} /> Deposit
                </button>
              </div>
            )}
          </div>
        </section>

        {/* trending */}
        <section className="mt-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Sedang trending</div>
            <Link href="/order" className="text-sm font-semibold text-[var(--yinn-muted)]">
              lihat semua <ChevronRight className="inline" size={16} />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { name: "Any Other", price: 700, icon: "https://assets.rumahotp.com/apps/go.png" },
              { name: "WhatsApp", price: 1300, icon: "https://assets.rumahotp.com/apps/wa.png" },
            ].map((it) => (
              <div
                key={it.name}
                className="rounded-2xl border p-3"
                style={{ background: "var(--yinn-surface)", borderColor: "var(--yinn-border)", boxShadow: "var(--yinn-soft)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--yinn-border)] overflow-hidden">
                    <img src={it.icon} alt={it.name} width={28} height={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">{it.name}</div>
                    <div className="text-xs text-[var(--yinn-muted)]">Harga terbaru {formatIDR(it.price)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />

      {/* MODAL */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setStep(1);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold">Payment Deposit</div>
          <button
            onClick={() => {
              setOpen(false);
              setStep(1);
            }}
            className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-bold"
          >
            Tutup
          </button>
        </div>

        <div className="mt-1 text-xs text-[var(--yinn-muted)]">Isi nominal deposit yang diinginkan</div>

        <Stepper step={step} />

        {/* STEP 1 */}
        {step === 1 && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className="rounded-2xl border px-3 py-3 text-left"
                  style={{
                    borderColor: amount === p ? "rgba(67,97,238,.55)" : "var(--yinn-border)",
                    background: amount === p ? "rgba(67,97,238,.10)" : "transparent",
                  }}
                >
                  <div className="text-sm font-extrabold">{formatIDR(p)}</div>
                  <div className="text-[11px] text-[var(--yinn-muted)]">Pilihan cepat</div>
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">Masukkan nominal</div>
                <div className="text-[11px] text-[var(--yinn-muted)]">MIN 2.000 | MAX 1.000.000</div>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-3">
                <span className="text-sm font-extrabold">Rp</span>
                <input
                  value={String(amount)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setAmount(raw ? clamp(Number(raw), 2000, 1000000) : 2000);
                  }}
                  inputMode="numeric"
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Masukkan nominal"
                />
              </div>
            </div>

            <button
              onClick={goNext}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
            >
              Lanjutkan →
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="mt-4">
            {methods.map((group) => (
              <div key={group.title} className="mb-3">
                <div className="mb-2 text-sm font-extrabold">{group.title}</div>
                <div className="grid gap-2">
                  {group.items.map(({ key, label, desc, Icon }) => (
                    <button
                      key={key}
                      onClick={() => setMethod(key)}
                      className="flex items-center gap-3 rounded-2xl border p-3 text-left"
                      style={{
                        borderColor: method === key ? "rgba(67,97,238,.55)" : "var(--yinn-border)",
                        background: method === key ? "rgba(67,97,238,.10)" : "transparent",
                      }}
                    >
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--yinn-border)]">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold">{label}</div>
                        <div className="text-xs text-[var(--yinn-muted)]">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={goBack} className="rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold">
                ← Kembali
              </button>
              <button
                onClick={goNext}
                className="rounded-2xl py-3 text-sm font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
              >
                Lanjutkan →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="mt-4">
            <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
              <div className="text-sm font-extrabold">Konfirmasi Pembayaran</div>
              <div className="mt-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Nominal</span>
                  <span className="font-extrabold">{formatIDR(amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[var(--yinn-muted)]">Metode</span>
                  <span className="font-extrabold">{method}</span>
                </div>
                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Fee & total akan muncul di halaman payment setelah transaksi dibuat.
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={goBack} className="rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold">
                ← Kembali
              </button>
              <button
                disabled={loadingGo}
                onClick={onConfirm}
                className="rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
              >
                {loadingGo ? "Memproses..." : "Konfirmasi ⚙️"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}