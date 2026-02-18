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
  // Samain semua kunci biar pay/sync gak “nyasar”
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

// ❌ Jangan pakai ellipsis “YINN…”, bikin kelihatan aneh.
// ✅ Tampil full tapi wrap.
function displayOrderId(orderId) {
  const s = String(orderId || "").trim();
  return s || "Order";
}

function fmtTime(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function StatusPill({ status }) {
  const st = String(status || "").toLowerCase();
  const label =
    st === "completed" || st === "success" || st === "paid"
      ? "Sukses"
      : st === "failed" || st === "cancel" || st === "canceled"
      ? "Gagal"
      : "Menunggu";

  const bg =
    label === "Sukses"
      ? "rgba(34,197,94,.12)"
      : label === "Gagal"
      ? "rgba(239,68,68,.12)"
      : "rgba(245,158,11,.14)";

  const fg =
    label === "Sukses"
      ? "rgb(34,197,94)"
      : label === "Gagal"
      ? "rgb(239,68,68)"
      : "rgb(245,158,11)";

  return (
    <span
      className="rounded-full px-2 py-1 text-[11px] font-extrabold"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
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
                    borderColor:
                      done || active
                        ? "rgba(67,97,238,.55)"
                        : "var(--yinn-border)",
                    background:
                      done || active ? "rgba(67,97,238,.12)" : "transparent",
                    color:
                      done || active
                        ? "var(--yinn-text)"
                        : "var(--yinn-muted)",
                    fontWeight: 800,
                  }}
                >
                  {i}
                </div>
                {i !== 3 && (
                  <div
                    className="mx-2 h-[3px] flex-1 rounded-full"
                    style={{
                      background:
                        i < step ? "rgba(67,97,238,.45)" : "var(--yinn-border)",
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

// ✅ modal anti-delay: selalu mounted, cuma toggle visibilitas
function Modal({ open, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[80]"
      style={{
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 140ms ease",
      }}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(2,6,23,.55)" }}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 top-14 mx-auto max-w-[520px] px-4">
        <div
          className="rounded-2xl border p-4"
          style={{
            background: "var(--yinn-surface)",
            borderColor: "var(--yinn-border)",
            boxShadow: "0 22px 60px rgba(2,6,23,.32)",
            transform: open ? "translateY(0)" : "translateY(6px)",
            transition: "transform 140ms ease",
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
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const uid = useMemo(() => getActiveUserId(), []);
  const [user, setUser] = useState({ name: "User", balance: 0 });
  const [history, setHistory] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
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

  // load cache per user
  useEffect(() => {
    if (typeof window === "undefined") return;

    ensureActiveUser(uid);

    const storedName =
      localStorage.getItem("yinnotp_name") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("username") ||
      localStorage.getItem("name") ||
      "User";

    const balKey = uid ? k(uid, "balance") : "yinnotp_balance";
    const storedBalRaw =
      localStorage.getItem(balKey) ||
      localStorage.getItem("yinnotp_balance") ||
      localStorage.getItem("balance") ||
      "0";

    const storedBal = Number(String(storedBalRaw).replace(/[^\d]/g, "")) || 0;
    setUser({ name: storedName, balance: storedBal });

    try {
      const hk = uid ? k(uid, "deposit_history") : "yinnotp_deposit_history";
      const raw =
        localStorage.getItem(hk) ||
        localStorage.getItem("yinnotp_deposit_history") ||
        "[]";
      const arr = JSON.parse(raw);
      setHistory(Array.isArray(arr) ? arr : []);
    } catch {
      setHistory([]);
    }
  }, [uid]);

  const syncDeposit = async (withToast = true) => {
    if (!backend) {
      withToast && toast.error("Backend URL belum diset");
      return;
    }
    if (!uid) {
      withToast && toast.error("Session user tidak ketemu. Login dulu.");
      return;
    }

    ensureActiveUser(uid);

    let tid = null;
    if (withToast) tid = toast.loading("Sync saldo & riwayat...");
    setSyncing(true);

    try {
      const res = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers: { "x-user-id": uid },
      });
      const j = await readJsonSafe(res);

      if (!res.ok || !j?.ok) {
        const msg =
          j?.message ||
          j?.error ||
          (j?.__raw ? "Respon backend bukan JSON" : "") ||
          "Gagal sync";
        throw new Error(msg);
      }

      const bal = Number(j?.balance || 0) || 0;
      const hist = Array.isArray(j?.history) ? j.history : [];

      setUser((u) => ({ ...u, balance: bal }));
      setHistory(hist);
      setUpdatedAt(Date.now());

      // cache per user
      localStorage.setItem(k(uid, "balance"), String(bal));
      localStorage.setItem(k(uid, "deposit_history"), JSON.stringify(hist));

      // legacy (biar page lain gak blank)
      localStorage.setItem("yinnotp_balance", String(bal));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(hist));

      withToast && toast.success("Sync berhasil ✅", { id: tid });
    } catch (e) {
      withToast && toast.error(String(e?.message || e), { id: tid });
    } finally {
      setSyncing(false);
    }
  };

  const openDeposit = () => {
    // ✅ set state dulu, baru open (biar gak “delay”)
    setAmount(2000);
    setMethod("qris");
    setStep(1);
    setOpen(true);
  };

  const goNext = () => setStep((s) => clamp(s + 1, 1, 3));
  const goBack = () => setStep((s) => clamp(s - 1, 1, 3));

  const createOrderId = () => {
    const r = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `YINN-${Date.now()}-${r}`;
  };

  const onConfirm = async () => {
    const a = clamp(Number(amount) || 0, 2000, 1000000);
    setLoadingGo(true);
    try {
      const order_id = createOrderId();
      setOpen(false);
      router.push(
        `/topup/pay?method=${encodeURIComponent(method)}&amount=${encodeURIComponent(
          String(a)
        )}&order_id=${encodeURIComponent(order_id)}`
      );
    } finally {
      setLoadingGo(false);
    }
  };

  const openFromHistory = (it) => {
    const st = String(it?.status || "").toLowerCase();
    const isPending = !(st === "completed" || st === "success" || st === "paid");
    if (!isPending) return;

    const oid = it?.order_id || it?.orderId;
    const amt = it?.amount || it?.nominal;
    const m = (it?.method || it?.payment_method || "qris").toLowerCase();

    if (!oid || !amt) return;

    router.push(
      `/topup/pay?method=${encodeURIComponent(m)}&amount=${encodeURIComponent(
        String(amt)
      )}&order_id=${encodeURIComponent(oid)}&resume=1`
    );
  };

  const updatedLabel = updatedAt ? fmtTime(updatedAt) : "Belum sync";

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
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              Isi saldo untuk beli OTP
            </div>
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
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wide text-[var(--yinn-muted)]">
                  ACCOUNT
                </div>
                <div className="text-sm font-extrabold">Balance Summary</div>
              </div>
              <button
                onClick={() => syncDeposit(true)}
                disabled={syncing}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)] disabled:opacity-60"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs text-[var(--yinn-muted)]">Saldo akun kamu</div>
              <div className="mt-1 text-xl font-extrabold">{formatIDR(user.balance)}</div>
              <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                Updated: {updatedLabel}
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
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                <Plus size={16} /> Deposit
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="flex items-start justify-between">
              <div className="text-sm font-extrabold">Riwayat pembayaran</div>
              <div className="text-[11px] text-[var(--yinn-muted)]">Updated: {updatedLabel}</div>
            </div>

            {history?.length ? (
              <>
                <div className="mt-3 grid gap-2">
                  {history.slice(0, 3).map((it, idx) => {
                    const oid = it?.order_id || it?.orderId || "";
                    const amt = Number(it?.amount || 0) || 0;
                    const m = (it?.method || it?.payment_method || "qris").toLowerCase();
                    const ts = it?.created_at || it?.createdAt || it?.ts;
                    const st = String(it?.status || "").toLowerCase();
                    const isPending = !(st === "completed" || st === "success" || st === "paid");

                    return (
                      <button
                        key={`${oid}-${idx}`}
                        onClick={() => openFromHistory(it)}
                        className="w-full rounded-2xl border border-[var(--yinn-border)] p-3 text-left"
                        style={{
                          background: "var(--yinn-surface)",
                          cursor: isPending ? "pointer" : "default",
                        }}
                        title={isPending ? "Klik untuk buka QR" : "Transaksi selesai"}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold break-all">
                              {displayOrderId(oid)}
                            </div>
                            <div className="mt-1 text-[12px] text-[var(--yinn-muted)]">
                              {m} • {ts ? fmtTime(ts) : ""}
                              {isPending ? " • klik untuk buka QR" : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-extrabold">{formatIDR(amt)}</div>
                            <div className="mt-1">
                              <StatusPill status={st} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => syncDeposit(true)}
                  className="mt-3 w-full rounded-xl border border-[var(--yinn-border)] py-2 text-sm font-extrabold text-[var(--yinn-muted)] disabled:opacity-60"
                  disabled={syncing}
                >
                  {syncing ? "Sync..." : "sync lagi ›"}
                </button>
              </>
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
                style={{
                  background: "var(--yinn-surface)",
                  borderColor: "var(--yinn-border)",
                  boxShadow: "var(--yinn-soft)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--yinn-border)] overflow-hidden">
                    <img src={it.icon} alt={it.name} width={28} height={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">{it.name}</div>
                    <div className="text-xs text-[var(--yinn-muted)]">
                      Harga terbaru {formatIDR(it.price)}
                    </div>
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

        <div className="mt-1 text-xs text-[var(--yinn-muted)]">
          Isi nominal deposit yang diinginkan
        </div>

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
              style={{
                background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
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
              <button
                onClick={goBack}
                className="rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold"
              >
                ← Kembali
              </button>
              <button
                onClick={goNext}
                className="rounded-2xl py-3 text-sm font-extrabold text-white"
                style={{
                  background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
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
              <button
                onClick={goBack}
                className="rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold"
              >
                ← Kembali
              </button>
              <button
                disabled={loadingGo}
                onClick={onConfirm}
                className="rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
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