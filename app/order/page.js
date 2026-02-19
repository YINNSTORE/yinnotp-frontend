"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import ThemeMenu from "../components/ThemeMenu";
import BottomNav from "../components/BottomNav";
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  SignalHigh,
  SignalLow,
  X,
  Check,
  RotateCcw,
  Search,
  ChevronRight,
  HelpCircle,
  Bell,
} from "lucide-react";
import {
  ping,
  roCountries,
  roOperators,
  roOrder,
  roServices,
  roStatusGet,
  roStatusSet,
} from "../_lib/rumahotpClient";
import { activityAdd } from "../_lib/activityStore";

/** ========= helpers ========= */
const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

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

function statusLabel(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("received")) return "OTP Masuk";
  if (s.includes("completed") || s.includes("done")) return "Selesai";
  if (s.includes("canceled") || s.includes("cancel")) return "Dibatalkan";
  if (s.includes("expiring")) return "Hampir Habis";
  if (s.includes("waiting") || s.includes("pending")) return "Menunggu";
  return s || "—";
}

function isFinalStatus(v) {
  const s = String(v || "").toLowerCase();
  return (
    s.includes("completed") ||
    s.includes("done") ||
    s.includes("canceled") ||
    s.includes("cancel")
  );
}

function msLabel(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)}ms`;
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,-]/gu, "")
    .trim();
}

/** ========= UI bits ========= */
function Shimmer({ className = "", style = {} }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
        className
      )}
      style={{ boxShadow: "var(--yinn-soft)", ...style }}
    >
      <div className="h-full w-full opacity-40" />
      <div className="yinn-shimmer absolute inset-0" />
    </div>
  );
}

function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Tutup"
      />
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[520px] rounded-t-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4 shadow-[0_-20px_60px_rgba(0,0,0,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/10" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">{title}</div>
            <div className="truncate text-xs text-[var(--yinn-muted)]">
              YinnOTP
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
            onClick={onClose}
            aria-label="Tutup"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ========= constants (popular + FAQ) ========= */
const POPULAR_APPS = [
  { name: "WhatsApp", img: "https://assets.rumahotp.com/apps/wa.png" },
  { name: "Kredito", img: "https://assets.rumahotp.com/apps/bdp.png" },
  { name: "Any Other", img: "https://assets.rumahotp.com/apps/ot.png" },
  { name: "Telegram", img: "https://assets.rumahotp.com/apps/tg.png" },
  { name: "Grab", img: "https://assets.rumahotp.com/apps/jg.png" },
  { name: "DANA", img: "https://assets.rumahotp.com/apps/fr.png" },
];

const FAQS = [
  {
    q: "OTP gak masuk-masuk",
    a: "Tunggu sampai beberapa menit. Kalau tetap kosong, coba tombol Resend. Kalau masih gagal, Cancel lalu buat pesanan baru (stok/route operator bisa berubah).",
  },
  {
    q: "Cancel tapi saldo kepotong",
    a: "Biasanya refund mengikuti status order di provider. Pastikan status sudah 'canceled' / 'cancel'. Kalau sudah tapi saldo belum balik, tunggu beberapa menit lalu cek lagi.",
  },
  {
    q: "Lupa cancel active order",
    a: "Kalau order masih 'waiting' kamu bisa Cancel kapan saja. Kalau sudah menerima OTP dan selesai dipakai, tekan Done biar status beres.",
  },
  {
    q: "Syarat refund",
    a: "Umumnya order yang belum menerima OTP dan dibatalkan sebelum expired bisa refund (tergantung aturan provider). Order yang sudah 'received' biasanya tidak refundable.",
  },
];

/** ========= page ========= */
export default function OrderPage() {
  /** server status */
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastPingTs, setLastPingTs] = useState(0);
  const [liveAgo, setLiveAgo] = useState(0);

  /** modal state */
  const [openBuy, setOpenBuy] = useState(false);
  const [step, setStep] = useState(1); // 1 app, 2 country/provider/operator

  /** services */
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [q, setQ] = useState("");

  const [serviceId, setServiceId] = useState("");
  const pickedService = useMemo(() => {
    const s = services.find((x) => String(x?.service_code) === String(serviceId));
    return s || null;
  }, [services, serviceId]);

  /** countries/providers/operators */
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [countryId, setCountryId] = useState("");
  const pickedCountry = useMemo(() => {
    const c = countries.find((x) => String(x?.number_id) === String(countryId));
    return c || null;
  }, [countries, countryId]);

  const [providerId, setProviderId] = useState("");
  const pickedProvider = useMemo(() => {
    const p = (pickedCountry?.pricelist || []).find(
      (x) => String(x?.provider_id) === String(providerId)
    );
    return p || null;
  }, [pickedCountry, providerId]);

  const displayPrice = useMemo(() => {
    const p = pickedProvider?.price;
    return Number.isFinite(Number(p)) ? Number(p) : 0;
  }, [pickedProvider]);

  const [operators, setOperators] = useState([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [operatorId, setOperatorId] = useState("");

  /** order + polling */
  const [ordering, setOrdering] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  /** faq ui */
  const [openFaq, setOpenFaq] = useState(null);

  /** ========= ping (real-time ms) ========= */
  async function refreshPing() {
    setChecking(true);
    const t0 = performance.now();
    try {
      const r = await ping();
      const t1 = performance.now();
      setLatencyMs(t1 - t0);
      setLastPingTs(Date.now());
      setOnline(!!(r?.json?.ok));
    } catch {
      setLatencyMs(null);
      setLastPingTs(Date.now());
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }

  /** live "ago" ticker without refresh */
  useEffect(() => {
    const id = setInterval(() => {
      if (!lastPingTs) return;
      setLiveAgo(Math.max(0, Math.floor((Date.now() - lastPingTs) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [lastPingTs]);

  /** ========= data loaders ========= */
  async function loadServices() {
    setLoadingServices(true);
    try {
      const r = await roServices();
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal load services");
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setServices(list);
    } catch {
      toast.error("Server error");
    } finally {
      setLoadingServices(false);
    }
  }

  async function loadCountries(sid) {
    setLoadingCountries(true);
    try {
      const r = await roCountries(sid);
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal load countries");
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setCountries(list);

      // default pick
      const firstCountryId = list?.[0]?.number_id ? String(list[0].number_id) : "";
      const firstProviderId = list?.[0]?.pricelist?.[0]?.provider_id
        ? String(list[0].pricelist[0].provider_id)
        : "";

      setCountryId(firstCountryId);
      setProviderId(firstProviderId);
      setOperators([]);
      setOperatorId("");
    } catch {
      toast.error("Server error");
    } finally {
      setLoadingCountries(false);
    }
  }

  async function loadOperators(countryName, pid) {
    setLoadingOperators(true);
    try {
      const r = await roOperators(countryName, pid);
      if (!r.ok || !r.json?.status) {
        toast.error("Gagal load operator");
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setOperators(list);
      setOperatorId(list?.[0]?.id ? String(list[0].id) : "");
    } catch {
      toast.error("Server error");
    } finally {
      setLoadingOperators(false);
    }
  }

  /** ========= polling ========= */
  function stopPolling() {
    setPolling(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollOnce(order_id) {
    const r = await roStatusGet(order_id);
    if (!r.ok || !r.json?.success) return null;
    return r.json?.data || null;
  }

  async function startPolling(order_id) {
    stopPolling();
    setPolling(true);

    const first = await pollOnce(order_id);
    if (first) {
      setActiveOrder((o) =>
        o ? { ...o, status: first.status, otp_code: first.otp_code } : o
      );
      activityAdd({
        type: "order_status",
        order_id,
        status: first.status,
        otp_code: first.otp_code,
        ts: Date.now(),
      });
      if (isFinalStatus(first.status)) {
        stopPolling();
        return;
      }
    }

    pollRef.current = setInterval(async () => {
      const data = await pollOnce(order_id);
      if (!data) return;

      setActiveOrder((o) => {
        if (!o) return o;
        return { ...o, status: data.status, otp_code: data.otp_code };
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: data.status,
        otp_code: data.otp_code,
        ts: Date.now(),
      });

      if (isFinalStatus(data.status)) stopPolling();
    }, 2000);
  }

  /** ========= order actions ========= */
  async function createOrder() {
    const sid = String(serviceId || "");
    const cid = String(countryId || "");
    const pid = String(providerId || "");
    const oid = String(operatorId || "");

    if (!sid || !cid || !pid || !oid) {
      toast.error("Lengkapi pilihan dulu");
      return;
    }

    setOrdering(true);
    try {
      const r = await roOrder(cid, pid, oid);
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal buat order");
        return;
      }

      const data = r.json?.data || null;
      if (!data?.order_id) {
        toast.error("Order id kosong");
        return;
      }

      const row = {
        order_id: data.order_id,
        phone_number: data.phone_number || "",
        service: data.service || pickedService?.service_name || "",
        country: data.country || pickedCountry?.name || "",
        operator: data.operator || "",
        expires_in_minute: data.expires_in_minute || 0,
        price: Number(data.price || 0) || 0,
        created_at: Date.now(),
        status: "waiting",
        otp_code: "-",
      };

      setActiveOrder(row);
      activityAdd({
        type: "order_create",
        order_id: row.order_id,
        phone_number: row.phone_number,
        service: row.service,
        country: row.country,
        operator: row.operator,
        price: row.price,
        ts: Date.now(),
      });

      toast.success("Pesanan dibuat");
      setOpenBuy(false);
      setStep(1);
      startPolling(row.order_id);
    } catch {
      toast.error("Server error");
    } finally {
      setOrdering(false);
    }
  }

  async function setStatus(action) {
    if (!activeOrder?.order_id) return;
    const order_id = activeOrder.order_id;

    const r = await roStatusSet(order_id, action);
    if (!r.ok || !r.json?.success) {
      toast.error("Gagal update status");
      return;
    }
    toast.success("OK");
    startPolling(order_id);
  }

  /** ========= modal flow ========= */
  function openBuyModal() {
    setOpenBuy(true);
    setStep(1);
    setQ("");
  }

  async function pickService(svc) {
    const sid = String(svc?.service_code || "");
    if (!sid) return;

    setServiceId(sid);
    setStep(2);

    // load next step deps
    await loadCountries(sid);
  }

  /** auto load operators when country/provider ready (in step 2) */
  useEffect(() => {
    if (!openBuy || step !== 2) return;
    if (!pickedCountry?.name || !providerId) return;
    loadOperators(pickedCountry.name, providerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBuy, step, pickedCountry?.name, providerId]);

  /** ========= boot ========= */
  useEffect(() => {
    refreshPing();
    loadServices();

    const tPing = setInterval(() => refreshPing(), 5000);
    return () => {
      clearInterval(tPing);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ========= derived lists ========= */
  const serviceByName = useMemo(() => {
    const m = new Map();
    for (const s of services) m.set(normalizeName(s?.service_name), s);
    return m;
  }, [services]);

  const popularResolved = useMemo(() => {
    // Use POPULAR_APPS list but resolve to actual service from API (so service_code valid)
    return POPULAR_APPS.map((p) => {
      const svc = serviceByName.get(normalizeName(p.name));
      return { ...p, svc };
    }).filter((x) => x.svc);
  }, [serviceByName]);

  const filteredServices = useMemo(() => {
    const qq = normalizeName(q);
    if (!qq) return services;
    return services.filter((s) => normalizeName(s?.service_name).includes(qq));
  }, [services, q]);

  const pickedServiceLogo = useMemo(() => {
    // prefer API logo, else popular override if matching
    if (pickedService?.service_img) return pickedService.service_img;
    const hit = POPULAR_APPS.find(
      (p) => normalizeName(p.name) === normalizeName(pickedService?.service_name)
    );
    return hit?.img || "";
  }, [pickedService]);

  /** ========= render ========= */
  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <style jsx global>{`
        .yinn-shimmer {
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.18) 35%,
            rgba(255, 255, 255, 0) 70%
          );
          transform: translateX(-100%);
          animation: yinnShimmer 1.2s ease-in-out infinite;
        }
        @keyframes yinnShimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* header */}
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
            <div className="truncate text-sm font-extrabold leading-tight">
              Activity
            </div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {checking ? "checking..." : online ? "online" : "offline"} •{" "}
              {msLabel(latencyMs)} • update {liveAgo}s lalu
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {/* top cards like screenshot */}
        <section className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-extrabold",
                  online
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-600"
                )}
              >
                {online ? <SignalHigh size={14} /> : <SignalLow size={14} />}
                {online ? "Online" : "Offline"}
              </div>
              <button
                onClick={refreshPing}
                className="ms-auto grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)]"
                aria-label="Refresh ping"
                title="Refresh"
              >
                <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="mt-3 text-sm font-extrabold">
              {msLabel(latencyMs)} response server
            </div>
            <div className="mt-1 text-xs text-[var(--yinn-muted)]">
              Real-time update otomatis tanpa refresh.
            </div>

            <button
              onClick={openBuyModal}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Beli Nomor
              <ChevronRight size={18} />
            </button>
          </div>

          <div
            className="rounded-2xl border p-4 text-white"
            style={{
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
              background:
                "linear-gradient(135deg, rgba(255,122,0,0.95), rgba(155,81,224,0.95))",
            }}
          >
            <div className="text-xs font-bold opacity-90">Get Virtual Number</div>
            <div className="mt-1 text-sm font-extrabold">
              OTP access untuk banyak aplikasi
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {popularResolved.slice(0, 5).map((p) => (
                <div
                  key={p.name}
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold"
                >
                  <img
                    src={p.img}
                    alt={p.name}
                    className="h-4 w-4 rounded-sm"
                    loading="lazy"
                  />
                  {p.name}
                </div>
              ))}
            </div>

            <button
              onClick={openBuyModal}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-3 text-sm font-extrabold"
            >
              Pilih Nomor
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        {/* pending order */}
        <section
          className="mt-4 rounded-2xl border p-4"
          style={{
            background: "var(--yinn-surface)",
            borderColor: "var(--yinn-border)",
            boxShadow: "var(--yinn-soft)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Pesanan Pending</div>
            <button
              onClick={() => {
                if (activeOrder?.order_id) startPolling(activeOrder.order_id);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Sync order"
              title="Sync"
            >
              <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
            </button>
          </div>

          {activeOrder ? (
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-[56px_1fr] gap-3 rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                  {pickedServiceLogo ? (
                    <img
                      src={pickedServiceLogo}
                      alt={activeOrder.service}
                      className="h-10 w-10"
                      loading="lazy"
                    />
                  ) : (
                    <HelpCircle size={22} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">
                    {activeOrder.service} • {activeOrder.country}
                  </div>
                  <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                    Status:{" "}
                    <span className="font-bold">{statusLabel(activeOrder.status)}</span>{" "}
                    • Exp {Number(activeOrder.expires_in_minute || 0)} menit •{" "}
                    {formatIDR(activeOrder.price)}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[var(--yinn-muted)]">
                      PHONE
                    </div>
                    <div className="break-all text-sm font-extrabold">
                      {activeOrder.phone_number || "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      copyText(activeOrder.phone_number);
                      toast.success("Copied");
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
                    title="Copy"
                    aria-label="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[var(--yinn-muted)]">
                      OTP
                    </div>
                    <div className="break-all text-lg font-extrabold">
                      {activeOrder.otp_code || "-"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      copyText(activeOrder.otp_code);
                      toast.success("Copied");
                    }}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
                    title="Copy"
                    aria-label="Copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setStatus("cancel")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button
                    onClick={() => setStatus("resend")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                  >
                    <RotateCcw size={16} /> Resend
                  </button>
                  <button
                    onClick={() => setStatus("done")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                  >
                    <Check size={16} /> Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid place-items-center rounded-2xl border border-[var(--yinn-border)] p-6 text-center">
              <div className="text-sm font-extrabold">Tidak ada pesanan</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                Pesanan aktif akan muncul di sini
              </div>
              <button
                onClick={openBuyModal}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                + Buat Pesanan
              </button>
            </div>
          )}
        </section>

        {/* notification + FAQ like screenshot */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="flex items-center gap-2">
              <Bell size={18} />
              <div className="text-sm font-extrabold">Notifikasi</div>
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold">Browser</div>
                  <div className="text-[11px] text-[var(--yinn-muted)]">
                    Disarankan agar OTP real-time.
                  </div>
                </div>
                <button
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                  onClick={() => toast("Fitur notifikasi bisa kamu sambungin nanti")}
                >
                  Aktifkan
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] bg-black/5 p-3 text-[11px] text-[var(--yinn-muted)] dark:bg-white/5">
                Message notifikasi real-time membantu OTP masuk tepat waktu tanpa delay.
              </div>
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
            <div className="flex items-center gap-2">
              <HelpCircle size={18} />
              <div className="text-sm font-extrabold">Pertanyaan Umum</div>
            </div>
            <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
              Tips cepat biar order kamu lancar.
            </div>

            <div className="mt-3 grid gap-2">
              {FAQS.map((f, idx) => {
                const open = openFaq === idx;
                return (
                  <button
                    key={f.q}
                    className="rounded-2xl border border-[var(--yinn-border)] p-3 text-left"
                    onClick={() => setOpenFaq(open ? null : idx)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-extrabold">{f.q}</div>
                      <ChevronRight
                        size={16}
                        className={open ? "rotate-90 transition" : "transition"}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                      {open ? f.a : "Ketuk untuk lihat keterangan"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />

      {/* BUY MODAL */}
      <Modal
        open={openBuy}
        onClose={() => {
          setOpenBuy(false);
          setStep(1);
        }}
        title="Beli Nomor Virtual"
      >
        {/* search */}
        {step === 1 && (
          <div>
            <div className="text-xs text-[var(--yinn-muted)]">
              Pilih sebuah aplikasi dan lanjutkan ke negara & operator.
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-3 py-2">
              <Search size={16} className="text-[var(--yinn-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama aplikasi..."
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>

            <div className="mt-4 text-xs font-extrabold text-[var(--yinn-muted)]">
              Aplikasi Populer
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {popularResolved.map((p) => (
                <button
                  key={p.svc.service_code}
                  onClick={() => pickService(p.svc)}
                  className="rounded-2xl border border-[var(--yinn-border)] p-3 text-center"
                >
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                    <img
                      src={p.img}
                      alt={p.name}
                      className="h-9 w-9"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 truncate text-xs font-extrabold">
                    {p.name}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs font-extrabold text-[var(--yinn-muted)]">
              Semua Aplikasi
            </div>

            <div className="mt-2 max-h-[48vh] overflow-auto rounded-2xl border border-[var(--yinn-border)]">
              {loadingServices ? (
                <div className="p-3">
                  <Shimmer className="h-12" />
                  <div className="mt-2 grid gap-2">
                    <Shimmer className="h-12" />
                    <Shimmer className="h-12" />
                    <Shimmer className="h-12" />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--yinn-border)]">
                  {filteredServices.map((s) => (
                    <button
                      key={s.service_code}
                      onClick={() => pickService(s)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                        <img
                          src={s.service_img}
                          alt={s.service_name}
                          className="h-8 w-8"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold">
                          {s.service_name}
                        </div>
                        <div className="truncate text-[11px] text-[var(--yinn-muted)]">
                          Tap untuk pilih
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--yinn-muted)]" />
                    </button>
                  ))}
                  {!filteredServices.length && (
                    <div className="p-4 text-sm text-[var(--yinn-muted)]">
                      Tidak ada aplikasi yang cocok.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* step 2: choose country/provider/operator */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--yinn-border)] p-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                {pickedServiceLogo ? (
                  <img
                    src={pickedServiceLogo}
                    alt={pickedService?.service_name || "Service"}
                    className="h-9 w-9"
                    loading="lazy"
                  />
                ) : (
                  <HelpCircle size={22} />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold">
                  {pickedService?.service_name || "—"}
                </div>
                <div className="truncate text-[11px] text-[var(--yinn-muted)]">
                  Pilih negara, provider & operator
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="ms-auto rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold"
              >
                Ganti
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {/* country */}
              <div>
                <div className="text-xs font-bold text-[var(--yinn-muted)]">
                  Negara
                </div>
                {loadingCountries ? (
                  <Shimmer className="mt-1 h-12" />
                ) : (
                  <select
                    value={countryId}
                    onChange={(e) => {
                      setCountryId(e.target.value);
                      setProviderId("");
                      setOperatorId("");
                      setOperators([]);
                      // set provider default after pickedCountry updated by effect below
                    }}
                    className="mt-1 w-full rounded-2xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                  >
                    {countries.map((c) => (
                      <option key={c.number_id} value={String(c.number_id)}>
                        {c.name} ({c.prefix}) • stock {Number(c.stock_total || 0)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* provider + operator */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    Provider
                  </div>
                  {loadingCountries ? (
                    <Shimmer className="mt-1 h-12" />
                  ) : (
                    <select
                      value={providerId}
                      onChange={(e) => {
                        setProviderId(e.target.value);
                        setOperatorId("");
                        setOperators([]);
                      }}
                      className="mt-1 w-full rounded-2xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                      disabled={!pickedCountry}
                    >
                      {(pickedCountry?.pricelist || []).map((p) => (
                        <option key={p.provider_id} value={String(p.provider_id)}>
                          Rp {Number(p.price || 0).toLocaleString("id-ID")} • stock{" "}
                          {Number(p.stock || 0)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    Operator
                  </div>
                  {loadingOperators ? (
                    <Shimmer className="mt-1 h-12" />
                  ) : (
                    <select
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                      disabled={!operators.length}
                    >
                      {operators.map((o) => (
                        <option key={o.id} value={String(o.id)}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* summary */}
              <div className="flex items-center justify-between rounded-2xl border border-[var(--yinn-border)] px-3 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    Ringkasan
                  </div>
                  <div className="mt-1 truncate text-sm font-extrabold">
                    {(pickedService?.service_name || "—") +
                      " • " +
                      (pickedCountry?.name || "—")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    Harga
                  </div>
                  <div className="mt-1 text-sm font-extrabold">
                    {formatIDR(displayPrice)}
                  </div>
                </div>
              </div>

              <button
                onClick={createOrder}
                disabled={
                  ordering ||
                  loadingCountries ||
                  loadingOperators ||
                  !serviceId ||
                  !countryId ||
                  !providerId ||
                  !operatorId
                }
                className="w-full rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                {ordering ? "Memproses..." : "Buy Number"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}