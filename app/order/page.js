"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import ThemeMenu from "../components/ThemeMenu";
import BottomNav from "../components/BottomNav";
import {
  ArrowLeft,
  RefreshCw,
  SignalHigh,
  SignalLow,
  Search,
  ChevronRight,
  X,
  ChevronLeft,
  Bell,
  BellOff,
  Copy,
  Clock,
  Mail,
  ShoppingBag,
  XCircle,
  Wallet,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  ping,
  roCountries,
  roOrder,
  roServices,
  roOperators,
  roStatusGet,
  roStatusSet,
} from "../_lib/rumahotpClient";
import { activityAdd } from "../_lib/activityStore";

/* ================= helpers ================= */

const MARKUP_FLAT_IDR = 1000;
const LS_NOTIF_KEY = "yinnotp:notif_enabled:v1";

// persist active order only
const LS_ACTIVE_ORDER_KEY = "yinnotp:active_order:v2";
// prevent double-refund spam on client (backend should also be idempotent)
const LS_REFUNDED_KEY = "yinnotp:refunded_orders:v1";

// cache saldo agar tetap tampil walau API lagi error
const LS_BALANCE_CACHE_KEY = "yinnotp:balance_cache:v1";

/**
 * ================= BACKEND WALLET API =================
 * GANTI PATH INI kalau endpoint backend lu beda.
 */
const API_WALLET = {
  balance: "/api/wallet/balance", // GET  -> { success, balance }
  debit: "/api/wallet/debit", // POST -> { success, balance }
  credit: "/api/wallet/credit", // POST -> { success, balance }
};

function cx(...xs: any[]) {
  return xs.filter(Boolean).join(" ");
}

function normalizeName(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,()-]/gu, "")
    .trim();
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const formatIDR = (n: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

function formatIDRCompact(n: any) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v.toLocaleString("id-ID");
}

function msLabel(ms: any) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)}ms`;
}
function msRange(ms: any) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "muted";
  if (n <= 400) return "good";
  if (n <= 600) return "warn";
  return "bad";
}
function MsBadge({ ms }: { ms: any }) {
  const r = msRange(ms);
  const cls =
    r === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      : r === "warn"
      ? "border-[#eab308]/30 bg-[#eab308]/10 text-[#a16207]"
      : r === "bad"
      ? "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]"
      : "border-zinc-500/30 bg-zinc-500/10 text-zinc-600";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold",
        cls
      )}
      title="Response server"
    >
      {msLabel(ms)}
    </span>
  );
}

function statusLabel(v: any) {
  const s = String(v || "").toLowerCase();
  if (s.includes("received")) return "OTP Masuk";
  if (s.includes("completed") || s.includes("done")) return "Selesai";
  if (s.includes("canceled") || s.includes("cancel")) return "Dibatalkan";
  if (s.includes("expired")) return "Expired";
  if (s.includes("waiting") || s.includes("pending")) return "Menunggu";
  return s || "—";
}

function isFinalStatus(v: any) {
  const s = String(v || "").toLowerCase();
  return (
    s.includes("completed") ||
    s.includes("done") ||
    s.includes("canceled") ||
    s.includes("cancel") ||
    s.includes("expired")
  );
}

function applyMarkup(price: any) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n + MARKUP_FLAT_IDR;
}

/* FIX: rate tampil pakai persen */
function fmtRatePercent(rate: any) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "";
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  const v = isInt ? String(Math.round(n)) : n.toFixed(2);
  return `${v}%`;
}

/* time helpers */
function hhmm(ts: any) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function mmssLeft(msLeft: any) {
  const s = Math.max(0, Math.floor((msLeft || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function isOtpEmpty(otp: any) {
  const v = String(otp || "").trim();
  return !v || v === "-" || v === "—";
}

/* ================= ERROR EXTRACTOR ================= */
function errMsg(defaultMsg: string, r: any) {
  if (!r) return defaultMsg;

  const j = r?.json;
  if (!j) return defaultMsg;

  if (typeof j === "string") return j;

  const msg =
    (typeof j.message === "string" && j.message) ||
    (typeof j.msg === "string" && j.msg) ||
    (typeof j.error === "string" && j.error) ||
    (typeof j?.data?.message === "string" && j.data.message) ||
    "";

  const type = String(j.type || j.code || "").toLowerCase();

  if (
    type.includes("provider") ||
    type.includes("supplier") ||
    type.includes("rumahotp") ||
    (msg && /provider|supplier|rumahotp/i.test(msg))
  ) {
    return "Saldo provider (RumahOTP) tidak cukup";
  }

  if (
    type.includes("balance") ||
    type.includes("user_balance") ||
    (msg && /saldo|balance/i.test(msg) && /tidak cukup|insufficient/i.test(msg))
  ) {
    const need = Number(j.need ?? j.required ?? j.amount ?? j.total ?? 0);
    const bal = Number(j.balance ?? j.saldo ?? 0);

    if (need || bal) {
      return `Saldo tidak cukup. Butuh ${formatIDR(
        need
      )}, saldo ${formatIDR(bal)}`;
    }
    return "Saldo tidak cukup";
  }

  if (typeof j.error === "object" && j.error) {
    const em = (j as any).error.message || (j as any).error.msg;
    if (typeof em === "string" && em.trim()) return em;
    try {
      return JSON.stringify(j.error);
    } catch {
      return defaultMsg;
    }
  }

  return msg && String(msg).trim() ? msg : defaultMsg;
}

/* ================= persist helpers ================= */

function saveActiveOrderLS(order: any) {
  try {
    if (!order) {
      localStorage.removeItem(LS_ACTIVE_ORDER_KEY);
      return;
    }
    localStorage.setItem(LS_ACTIVE_ORDER_KEY, JSON.stringify(order));
  } catch {}
}
function loadActiveOrderLS() {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_ORDER_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && obj.order_id ? obj : null;
  } catch {
    return null;
  }
}

function readRefundedMap() {
  try {
    const raw = localStorage.getItem(LS_REFUNDED_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function markRefunded(order_id: any) {
  try {
    const m = readRefundedMap();
    m[String(order_id || "")] = 1;
    localStorage.setItem(LS_REFUNDED_KEY, JSON.stringify(m));
  } catch {}
}
function alreadyRefunded(order_id: any) {
  const m = readRefundedMap();
  return !!m[String(order_id || "")];
}

/* ================= flags ================= */

function flagCodeForCountry(country: any) {
  const shortRaw = String(
    country?.short || country?.code || country?.iso || country?.iso2 || ""
  ).trim();
  const nameNorm = normalizeName(country?.name);

  if (
    nameNorm.includes("virtual") &&
    (shortRaw.toLowerCase() === "us" || nameNorm.includes("united states"))
  ) {
    return "uv";
  }

  const iso2 = shortRaw.toLowerCase();
  const EXCEPT: any = { gi: "gib" };
  if (EXCEPT[iso2]) return EXCEPT[iso2];
  if (iso2) return iso2;

  if (nameNorm.includes("indonesia")) return "id";
  if (nameNorm.includes("philippines")) return "ph";
  if (nameNorm.includes("malaysia")) return "my";
  if (nameNorm.includes("thailand")) return "th";
  if (nameNorm.includes("colombia")) return "co";
  return "";
}

function flagUrlFromCountry(country: any) {
  const direct = String(
    country?.flag_img ||
      country?.flag_url ||
      country?.img ||
      country?.image ||
      ""
  ).trim();
  if (direct) return direct;

  const code = flagCodeForCountry(country);
  if (!code) return "";
  return `https://assets.rumahotp.com/flags/${code}.png`;
}

/* ================= Scroll Reveal ================= */
function Reveal({ children, className = "" }: any) {
  const ref = useRef<any>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.16 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cx("will-change-transform", className)}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "scale(1)" : "scale(0.96)",
        transition: "transform 260ms ease-out, opacity 260ms ease-out",
      }}
    >
      {children}
    </div>
  );
}

/* ================= Skeleton shimmer ================= */

function Skel({ className = "" }: any) {
  return <div className={cx("yinn-skel", className)} />;
}

function SkeletonRowApp() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skel className="h-10 w-10 rounded-2xl border border-[var(--yinn-border)]" />
      <div className="min-w-0 flex-1">
        <Skel className="h-3 w-44 rounded-md" />
        <div className="mt-2">
          <Skel className="h-3 w-28 rounded-md" />
        </div>
      </div>
      <Skel className="h-5 w-5 rounded-md" />
    </div>
  );
}

function SkeletonRowCountry() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skel className="h-10 w-10 rounded-xl border border-[var(--yinn-border)]" />
      <div className="min-w-0 flex-1">
        <Skel className="h-3 w-48 rounded-md" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Skel className="h-4 w-14 rounded-full" />
          <Skel className="h-4 w-14 rounded-full" />
          <Skel className="h-4 w-24 rounded-full" />
          <Skel className="h-4 w-28 rounded-full" />
        </div>
      </div>
      <Skel className="h-5 w-5 rounded-md" />
    </div>
  );
}

function SkeletonProviderRow() {
  return (
    <div className="flex items-center gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Skel className="h-6 w-24 rounded-full" />
        <Skel className="h-6 w-20 rounded-full" />
        <Skel className="h-6 w-16 rounded-full" />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <Skel className="h-5 w-20 rounded-md" />
        <Skel className="h-9 w-16 rounded-xl" />
      </div>
    </div>
  );
}

function BootPageSkeleton() {
  return (
    <div className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <div className="flex items-center gap-2">
            <Skel className="h-7 w-20 rounded-full border border-[var(--yinn-border)]" />
            <Skel className="ms-auto h-7 w-24 rounded-full border border-[var(--yinn-border)]" />
          </div>
          <div className="mt-3">
            <Skel className="h-4 w-28 rounded-md" />
            <div className="mt-2">
              <Skel className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <div className="mt-4">
            <Skel className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <Skel className="h-3 w-28 rounded-md" />
          <div className="mt-2">
            <Skel className="h-4 w-40 rounded-md" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Skel className="h-6 w-24 rounded-full" />
            <Skel className="h-6 w-20 rounded-full" />
            <Skel className="h-6 w-24 rounded-full" />
          </div>
          <div className="mt-4">
            <Skel className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
        <div className="flex items-center justify-between">
          <Skel className="h-4 w-32 rounded-md" />
          <Skel className="h-10 w-10 rounded-xl border border-[var(--yinn-border)]" />
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-6">
          <div className="mx-auto grid max-w-[220px] gap-3">
            <Skel className="h-4 w-40 rounded-md" />
            <Skel className="h-3 w-52 rounded-md" />
            <Skel className="mx-auto h-11 w-44 rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <Skel className="h-4 w-24 rounded-md" />
          <div className="mt-2">
            <Skel className="h-3 w-40 rounded-md" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skel className="h-7 w-20 rounded-full" />
            <Skel className="h-7 w-20 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skel className="h-10 w-full rounded-xl" />
            <Skel className="h-10 w-full rounded-xl" />
          </div>
          <div className="mt-3">
            <Skel className="h-16 w-full rounded-2xl border border-[var(--yinn-border)]" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <Skel className="h-4 w-28 rounded-md" />
          <div className="mt-2">
            <Skel className="h-3 w-44 rounded-md" />
          </div>
          <div className="mt-3 grid gap-2">
            <Skel className="h-16 w-full rounded-2xl border border-[var(--yinn-border)]" />
            <Skel className="h-16 w-full rounded-2xl border border-[var(--yinn-border)]" />
            <Skel className="h-16 w-full rounded-2xl border border-[var(--yinn-border)]" />
          </div>
        </div>
      </section>
    </div>
  );
}

function FullscreenBoot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-[var(--yinn-bg)]">
      <BootPageSkeleton />
    </div>
  );
}

function Modal({ open, onClose, title, subtitle, children }: any) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: any) => {
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
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[520px] rounded-t-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[0_-20px_60px_rgba(0,0,0,0.25)]">
        <div className="p-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/10" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold">{title}</div>
              <div className="truncate text-xs text-[var(--yinn-muted)]">
                {subtitle}
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
        </div>

        <div
          className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] yinn-smoothscroll"
          style={{
            maxHeight: "72vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ================= app icons ================= */

const POPULAR_APPS = [
  { name: "WhatsApp", img: "https://assets.rumahotp.com/apps/wa.png" },
  { name: "Kredito", img: "https://assets.rumahotp.com/apps/bdp.png" },
  { name: "Any Other", img: "https://assets.rumahotp.com/apps/ot.png" },
  { name: "Telegram", img: "https://assets.rumahotp.com/apps/tg.png" },
  { name: "Grab", img: "https://assets.rumahotp.com/apps/jg.png" },
  { name: "DANA", img: "https://assets.rumahotp.com/apps/fr.png" },
];

export default function OrderPage() {
  const router = useRouter();

  const [bootLoading, setBootLoading] = useState(true);

  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState<any>(null);
  const [lastPingTs, setLastPingTs] = useState(0);
  const [ago, setAgo] = useState(0);

  // backend balance
  const [balanceIDR, setBalanceIDR] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceErrText, setBalanceErrText] = useState("");

  // tick
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // notifikasi
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifState, setNotifState] = useState("unsupported");
  const lastNotifiedOtpRef = useRef("");

  // modal
  const [openBuy, setOpenBuy] = useState(false);
  const [buyStep, setBuyStep] = useState("app"); // app | country

  // services
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceId, setServiceId] = useState("");

  // countries
  const [countries, setCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [sortMode, setSortMode] = useState("rate"); // rate | harga
  const [expandedCountryId, setExpandedCountryId] = useState("");
  const [orderingKey, setOrderingKey] = useState("");

  // order status
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<any>(null);

  /* loading anim sebentar pas modal */
  const [modalKickLoading, setModalKickLoading] = useState(false);
  const modalKickRef = useRef<any>(null);
  function kickModalLoading(ms = 450) {
    setModalKickLoading(true);
    if (modalKickRef.current) clearTimeout(modalKickRef.current);
    modalKickRef.current = setTimeout(() => setModalKickLoading(false), ms);
  }

  /* operator picker */
  const [openOperator, setOpenOperator] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [operators, setOperators] = useState<any[]>([]);
  const [opCtx, setOpCtx] = useState<any>({ country: null, provider: null });
  const [opOrdering, setOpOrdering] = useState(false);

  const pickedService = useMemo(() => {
    return (
      services.find((x) => String(x?.service_code) === String(serviceId)) || null
    );
  }, [services, serviceId]);

  const popularResolved = useMemo(() => {
    const map = new Map();
    for (const s of services) map.set(normalizeName(s?.service_name), s);
    return POPULAR_APPS.map((p) => ({
      ...p,
      svc: map.get(normalizeName(p.name)),
    })).filter((x) => x.svc);
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = normalizeName(serviceSearch);
    if (!q) return services;
    return services.filter((s) => normalizeName(s?.service_name).includes(q));
  }, [services, serviceSearch]);

  function minPriceFromCountry(country: any) {
    const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
    const prices = list.map((p: any) => safeNum(p?.price)).filter((x) => x > 0);
    if (!prices.length) return 0;
    return Math.min(...prices);
  }

  function realStockFromCountry(country: any) {
    const st = safeNum(country?.stock_total);
    if (st > 0) return st;

    const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
    const sum = list.reduce((acc: number, p: any) => acc + safeNum(p?.stock), 0);
    return sum > 0 ? sum : 0;
  }

  const filteredCountries = useMemo(() => {
    const q = normalizeName(countrySearch);
    let list = countries.slice();

    if (sortMode === "harga") {
      list.sort(
        (a, b) => (minPriceFromCountry(a) || 0) - (minPriceFromCountry(b) || 0)
      );
    } else {
      list.sort((a, b) => {
        const sa = safeNum(a?.stock_total);
        const sb = safeNum(b?.stock_total);
        if (sb !== sa) return sb - sa;
        return (minPriceFromCountry(a) || 0) - (minPriceFromCountry(b) || 0);
      });
    }

    if (!q) return list;
    return list.filter((c) => normalizeName(c?.name).includes(q));
  }, [countries, countrySearch, sortMode]);

  const pickedServiceLogo = useMemo(() => {
    if (pickedService?.service_img) return pickedService.service_img;
    const hit = POPULAR_APPS.find(
      (p) => normalizeName(p.name) === normalizeName(pickedService?.service_name)
    );
    return hit?.img || "";
  }, [pickedService]);

  /* ================= notif persist ================= */

  function readNotifPref() {
    try {
      const v = localStorage.getItem(LS_NOTIF_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    return false;
  }

  function saveNotifPref(v: boolean) {
    try {
      localStorage.setItem(LS_NOTIF_KEY, v ? "1" : "0");
    } catch {}
  }

  function updateNotifStateFromBrowser() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotifState("unsupported");
      setNotifEnabled(false);
      saveNotifPref(false);
      return;
    }
    const p = (Notification as any).permission;
    setNotifState(p);

    const pref = readNotifPref();
    const enabled = p === "granted" && pref;
    setNotifEnabled(enabled);
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    try {
      const p = await (Notification as any).requestPermission();
      setNotifState(p);
      return p === "granted";
    } catch {
      return false;
    }
  }

  async function toggleNotif() {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setNotifState("unsupported");
      setNotifEnabled(false);
      saveNotifPref(false);
      toast.error("Browser tidak support notifikasi");
      return;
    }

    const currentPerm = (Notification as any).permission;
    setNotifState(currentPerm);

    if (notifEnabled) {
      setNotifEnabled(false);
      saveNotifPref(false);
      toast("Notifikasi OFF");
      return;
    }

    if (currentPerm === "denied") {
      toast.error("Notifikasi diblokir. Aktifkan di setting browser.");
      setNotifEnabled(false);
      saveNotifPref(false);
      return;
    }

    const ok =
      currentPerm === "granted" ? true : await requestNotificationPermission();
    if (!ok) {
      toast.error("Notifikasi tidak diizinkan");
      setNotifEnabled(false);
      saveNotifPref(false);
      return;
    }

    setNotifEnabled(true);
    saveNotifPref(true);
    toast.success("Notifikasi ON");
  }

  function fireOtpNotification(otp: any, phone: any) {
    if (!notifEnabled) return;
    if (!otp || otp === "-" || otp === "—") return;

    const key = `${phone || ""}:${otp}`;
    if (lastNotifiedOtpRef.current === key) return;
    lastNotifiedOtpRef.current = key;

    try {
      new (Notification as any)("YinnOTP • OTP Masuk", {
        body: phone ? `Nomor: ${phone}\nOTP: ${otp}` : `OTP: ${otp}`,
        silent: false,
      });
    } catch {}
  }

  /* ================= Backend wallet API ================= */

  async function apiJson(url: string, init: any) {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  }

  function readBalanceCache() {
    try {
      const raw = localStorage.getItem(LS_BALANCE_CACHE_KEY);
      const n = safeNum(raw);
      return n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
  function writeBalanceCache(n: any) {
    try {
      localStorage.setItem(LS_BALANCE_CACHE_KEY, String(Math.floor(safeNum(n))));
    } catch {}
  }

  function extractBalanceFromJson(j: any) {
    if (!j) return 0;
    // dukung banyak bentuk response
    const direct =
      j.balance ??
      j.saldo ??
      j.data?.balance ??
      j.data?.saldo ??
      j.result?.balance ??
      j.result?.saldo ??
      j.wallet?.balance ??
      j.wallet?.saldo ??
      0;
    return safeNum(direct);
  }

  function isWalletSuccess(r: any) {
    const j = r?.json;
    if (!r?.ok) return false;
    if (!j) return false;
    // toleran: success/status/ok true
    if (j.success === true) return true;
    if (j.status === true) return true;
    if (j.ok === true) return true;
    if (j?.data?.success === true) return true;
    // kalau ada balance angka juga kita anggap ok
    const b = extractBalanceFromJson(j);
    return b >= 0;
  }

  async function loadBalance(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent;

    setBalanceLoading(true);
    setBalanceErrText("");
    try {
      const r = await apiJson(API_WALLET.balance, { method: "GET" });

      if (!isWalletSuccess(r)) {
        const msg = errMsg("Gagal load saldo", r);
        setBalanceErrText(msg);
        // jangan spam toast saat boot, tapi tetap toast kalau user klik refresh
        if (!silent) toast.error(msg);
        // fallback tampilkan cache
        const cached = readBalanceCache();
        if (cached > 0) setBalanceIDR(cached);
        return;
      }

      const b = extractBalanceFromJson(r.json);
      setBalanceIDR(b);
      writeBalanceCache(b);
    } catch {
      const msg = "Server error (saldo)";
      setBalanceErrText(msg);
      if (!silent) toast.error(msg);
      const cached = readBalanceCache();
      if (cached > 0) setBalanceIDR(cached);
    } finally {
      setBalanceLoading(false);
    }
  }

  async function walletDebit({
    amount,
    order_id,
    note,
  }: {
    amount: number;
    order_id: any;
    note?: string;
  }) {
    const r = await apiJson(API_WALLET.debit, {
      method: "POST",
      body: JSON.stringify({ amount, order_id, note }),
    });

    if (!isWalletSuccess(r)) {
      throw new Error(errMsg("Gagal potong saldo", r));
    }

    const b = extractBalanceFromJson(r.json);
    setBalanceIDR(b);
    writeBalanceCache(b);
    return b;
  }

  async function walletCredit({
    amount,
    order_id,
    note,
  }: {
    amount: number;
    order_id: any;
    note?: string;
  }) {
    const r = await apiJson(API_WALLET.credit, {
      method: "POST",
      body: JSON.stringify({ amount, order_id, note }),
    });

    if (!isWalletSuccess(r)) {
      throw new Error(errMsg("Gagal refund saldo", r));
    }

    const b = extractBalanceFromJson(r.json);
    setBalanceIDR(b);
    writeBalanceCache(b);
    return b;
  }

  /* ================= order helpers ================= */

  function orderExpiresAt(order: any) {
    if (!order) return 0;
    const createdAt = Number(order.created_at || 0);
    const expMin = Number(order.expires_in_minute || 0);
    if (!createdAt || !expMin) return 0;
    return createdAt + expMin * 60 * 1000;
  }

  function stopPolling() {
    setPolling(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function clearActiveOrder(reason: any, finalStatus: any, extra = {}) {
    try {
      if (activeOrder?.order_id) {
        activityAdd({
          type: "order_final",
          reason: reason || "final",
          order_id: activeOrder.order_id,
          phone_number: activeOrder.phone_number,
          service: activeOrder.service,
          country: activeOrder.country,
          operator: activeOrder.operator,
          price: activeOrder.price,
          status: finalStatus || activeOrder.status || "final",
          otp_code: activeOrder.otp_code,
          created_at: activeOrder.created_at,
          expires_in_minute: activeOrder.expires_in_minute,
          ...extra,
          ts: Date.now(),
        });
      }
    } catch {}

    stopPolling();
    setActiveOrder(null);
    saveActiveOrderLS(null);
  }

  /* ================= Provider API ================= */

  async function refreshPing() {
    setChecking(true);
    const t0 = performance.now();
    try {
      const r = await ping();
      const t1 = performance.now();
      setLatencyMs(t1 - t0);
      setLastPingTs(Date.now());
      setOnline(!!r?.json?.ok);
    } catch {
      setLatencyMs(null);
      setLastPingTs(Date.now());
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }

  async function loadServices() {
    setLoadingServices(true);
    try {
      const r = await roServices();
      if (!r.ok || !r.json?.success) {
        toast.error(errMsg("Gagal load layanan", r));
        setServices([]);
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setServices(list);
    } catch {
      toast.error("Server error (services)");
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }

  async function loadCountriesForService(sid: any) {
    setLoadingCountries(true);
    try {
      const r = await roCountries(sid);
      if (!r.ok || !r.json?.success) {
        toast.error(errMsg("Gagal load negara", r));
        setCountries([]);
        setExpandedCountryId("");
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setCountries(list);
      setExpandedCountryId("");
    } catch {
      toast.error("Server error (countries)");
      setCountries([]);
      setExpandedCountryId("");
    } finally {
      setLoadingCountries(false);
    }
  }

  async function pollOnce(order_id: any) {
    const r = await roStatusGet(order_id);
    if (!r.ok || !r.json?.success) return null;
    return r.json?.data || null;
  }

  async function startPolling(order_id: any) {
    stopPolling();
    setPolling(true);

    const first = await pollOnce(order_id);
    if (first) {
      setActiveOrder((o: any) => {
        if (!o) return o;
        const next = { ...o, status: first.status, otp_code: first.otp_code };
        if (String(first.otp_code || "").trim())
          fireOtpNotification(first.otp_code, next.phone_number);
        return next;
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: first.status,
        otp_code: first.otp_code,
        ts: Date.now(),
      });

      if (isFinalStatus(first.status)) {
        clearActiveOrder("final_status", first.status, { final_from_poll: 1 });
        return;
      }
    }

    pollRef.current = setInterval(async () => {
      const data = await pollOnce(order_id);
      if (!data) return;

      // ambil price terbaru dari state (anti stale)
      let latestPrice = 0;
      setActiveOrder((o: any) => {
        if (!o) return o;
        latestPrice = safeNum(o.price || 0);

        const next = { ...o, status: data.status, otp_code: data.otp_code };
        if (String(data?.otp_code || "").trim())
          fireOtpNotification(data.otp_code, next.phone_number);
        return next;
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: data.status,
        otp_code: data.otp_code,
        ts: Date.now(),
      });

      // refund otomatis kalau cancel & otp kosong (sekali)
      const st = String(data.status || "").toLowerCase();
      if (
        (st.includes("cancel") || st.includes("canceled")) &&
        isOtpEmpty(data.otp_code) &&
        !alreadyRefunded(order_id)
      ) {
        try {
          const amt = latestPrice; // ✅ pakai harga terbaru
          if (amt > 0) {
            await walletCredit({
              amount: amt,
              order_id,
              note: "Refund cancel (OTP kosong)",
            });
          }
          markRefunded(order_id);
          toast.success(`Refund berhasil: +${formatIDR(amt)}`);
        } catch (e: any) {
          toast.error(String(e?.message || "Refund gagal"));
        }
      }

      if (isFinalStatus(data.status)) {
        clearActiveOrder("final_status", data.status, { final_from_poll: 1 });
      }
    }, 1800);
  }

  async function setStatus(action: any) {
    if (!activeOrder?.order_id) return;
    const order_id = activeOrder.order_id;

    const r = await roStatusSet(order_id, action);
    if (!r.ok || !r.json?.success) {
      toast.error(errMsg("Gagal update status", r));
      return;
    }

    if (action === "cancel") {
      // refund kalau OTP belum ada (sekali)
      const otpEmpty = isOtpEmpty(activeOrder?.otp_code);
      const amt = safeNum(activeOrder?.price || 0);

      if (otpEmpty && amt > 0 && !alreadyRefunded(order_id)) {
        try {
          await walletCredit({
            amount: amt,
            order_id,
            note: "Refund manual cancel (OTP kosong)",
          });
          markRefunded(order_id);
          toast.success(`Pesanan dibatalkan. Refund: +${formatIDR(amt)}`);
        } catch (e: any) {
          toast.error(String(e?.message || "Refund gagal"));
        }
      } else {
        toast.success("Pesanan dibatalkan");
      }

      clearActiveOrder("cancel_action", "canceled", { final_from_action: 1 });
      return;
    }

    toast.success("OK");
    startPolling(order_id);
  }

  /* ================= operator picker flow ================= */

  async function openOperatorPicker(country: any, provider: any) {
    const cid = String(country?.number_id || "");
    const pid = String(provider?.provider_id || "");
    const countryName = String(country?.name || "").trim();

    if (!cid || !pid || !countryName) {
      toast.error("Data negara/provider tidak valid");
      return;
    }

    setOpCtx({ country, provider });
    setOperators([]);
    setOpenOperator(true);
    setOpLoading(true);

    try {
      const opRes = await roOperators(countryName, pid);
      const ok = !!(
        opRes?.ok &&
        (opRes?.json?.status || opRes?.json?.success)
      );
      if (!ok) {
        toast.error(errMsg("Gagal load operator", opRes));
        setOperators([]);
        return;
      }
      const ops = Array.isArray(opRes.json?.data) ? opRes.json.data : [];
      if (!ops.length) {
        toast.error("Operator kosong untuk provider ini");
        setOperators([]);
        return;
      }
      setOperators(ops);
    } catch {
      toast.error("Server error load operator");
      setOperators([]);
    } finally {
      setOpLoading(false);
    }
  }

  /* ================= ORDER (fix “gagal” padahal masuk RumahOTP) ================= */
  async function orderWithOperator(country: any, provider: any, operator: any) {
    if (opOrdering) return;

    const cid = String(country?.number_id || "");
    const pid = String(provider?.provider_id || "");
    const oid = String(operator?.id || "");

    if (!cid || !pid || !oid) {
      toast.error("Operator tidak valid");
      return;
    }

    const key = `${cid}-${pid}`;
    setOrderingKey(key);
    setOpOrdering(true);

    try {
      const r = await roOrder(cid, pid, oid);

      // ✅ FIX: anggap sukses kalau ada order_id walau success false
      const data = r?.json?.data || null;
      const orderId = String(data?.order_id || "").trim();
      if (!orderId) {
        toast.error(errMsg("Gagal buat order", r));
        return;
      }

      // harga web: provider.price + markup
      const basePrice = safeNum(provider?.price);
      const sellPrice = applyMarkup(basePrice);

      const row = {
        order_id: orderId,
        phone_number: data?.phone_number || "",
        service: data?.service || pickedService?.service_name || "",
        country: data?.country || country?.name || "",
        operator: data?.operator || operator?.name || "any",
        expires_in_minute: data?.expires_in_minute || 0,
        price: sellPrice,
        created_at: Date.now(),
        status: "waiting",
        otp_code: "-",
        app_img: pickedServiceLogo || "",
        country_flag_url: flagUrlFromCountry(country) || "",
      };

      // ✅ set order dulu biar UI gak bilang gagal padahal order masuk
      setActiveOrder(row);
      saveActiveOrderLS(row);

      activityAdd({
        type: "order_create",
        order_id: row.order_id,
        phone_number: row.phone_number,
        service: row.service,
        country: row.country,
        operator: row.operator,
        price: row.price,
        expires_in_minute: row.expires_in_minute,
        ts: Date.now(),
      });

      // ✅ Debit wallet: kalau gagal, jangan bikin order dianggap gagal (biar gak misleading)
      try {
        await walletDebit({
          amount: sellPrice,
          order_id: row.order_id,
          note: `Order ${pickedService?.service_name || "service"}`,
        });
      } catch (e: any) {
        toast.error(String(e?.message || "Potong saldo gagal (order tetap dibuat)"));
      }

      toast.success("Order berhasil dibuat");
      setOpenOperator(false);
      setOpenBuy(false);
      startPolling(row.order_id);
    } catch (e: any) {
      toast.error(String(e?.message || "Server error (order)"));
    } finally {
      setOpOrdering(false);
      setOrderingKey("");
    }
  }

  function openBuyModal() {
    setOpenBuy(true);
    setBuyStep("app");
    setServiceSearch("");
    setCountrySearch("");
    setExpandedCountryId("");
    kickModalLoading();
  }

  function selectServiceAndGoCountries(svc: any) {
    const sid = String(svc?.service_code || "");
    if (!sid) return;

    setServiceId(sid);
    setCountrySearch("");
    setExpandedCountryId("");
    setBuyStep("country");

    kickModalLoading();
    loadCountriesForService(sid);
  }

  /* ================= effects ================= */

  useEffect(() => {
    let alive = true;

    const cached = loadActiveOrderLS();
    if (cached?.order_id) setActiveOrder(cached);

    // tampilkan cache saldo dulu biar gak kosong
    const cachedBal = readBalanceCache();
    if (cachedBal > 0) setBalanceIDR(cachedBal);

    try {
      const pref = readNotifPref();
      setNotifEnabled(pref);
    } catch {}

    updateNotifStateFromBrowser();

    (async () => {
      setBootLoading(true);
      // ✅ silent loadBalance biar gak spam toast pas awal
      await Promise.allSettled([refreshPing(), loadServices(), loadBalance({ silent: true })]);
      if (!alive) return;
      updateNotifStateFromBrowser();
      setBootLoading(false);
    })();

    const t = setInterval(() => refreshPing(), 5000);
    return () => {
      alive = false;
      clearInterval(t);
      stopPolling();
      if (modalKickRef.current) clearTimeout(modalKickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!lastPingTs) return;
      setAgo(Math.max(0, Math.floor((Date.now() - lastPingTs) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [lastPingTs]);

  useEffect(() => {
    if (activeOrder?.order_id) startPolling(activeOrder.order_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.order_id]);

  // auto-expire -> clear & activity (mirip rumahotp)
  useEffect(() => {
    if (!activeOrder?.order_id) return;
    const expAt = orderExpiresAt(activeOrder);
    if (!expAt) return;

    if (Date.now() >= expAt) {
      activityAdd({
        type: "order_status",
        order_id: activeOrder.order_id,
        status: "expired",
        otp_code: activeOrder.otp_code,
        ts: Date.now(),
      });
      clearActiveOrder("expired_timer", "expired", { final_from_timer: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, activeOrder?.order_id]);

  const showAppLoading = loadingServices || modalKickLoading;
  const showCountryLoading = loadingCountries || modalKickLoading;

  /* ================= render ================= */

  // saldo label ala screenshot: "2.150 IDR"
  const saldoLabel = `${formatIDRCompact(balanceIDR)} IDR`;

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />
      <FullscreenBoot show={bootLoading} />

      <style jsx global>{`
        html,
        body {
          scroll-behavior: smooth;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }

        .yinn-skel {
          position: relative;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.08);
        }
        html.dark .yinn-skel {
          background: rgba(255, 255, 255, 0.10);
        }
        .yinn-skel::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-120%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.42) 45%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: yinnSkelMove 1.05s ease-in-out infinite;
          filter: blur(0.25px);
          opacity: 1;
          pointer-events: none;
        }
        @keyframes yinnSkelMove {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .yinn-skel::after {
            animation: none;
          }
        }

        .yinn-smoothscroll {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
      `}</style>

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
              Order
            </div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {checking ? "checking..." : online ? "online" : "offline"} •{" "}
              <MsBadge ms={latencyMs} /> • update {ago}s lalu
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={refreshPing}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Refresh ping"
              title="Refresh"
            >
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            </button>
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {/* TOP: card kiri + card kanan */}
        <section className="grid grid-cols-2 gap-3">
          {/* kiri */}
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
                    : "border-zinc-500/30 bg-zinc-500/10 text-zinc-600"
                )}
              >
                {online ? <SignalHigh size={14} /> : <SignalLow size={14} />}
                {online ? "Online" : "Offline"}
              </div>

              <button
                onClick={toggleNotif}
                className={cx(
                  "ms-auto inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-extrabold",
                  notifEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-zinc-500/30 bg-zinc-500/10 text-zinc-600",
                  notifState === "unsupported" ? "opacity-60" : ""
                )}
                title="Toggle notifikasi"
                aria-label="Toggle notifikasi"
                disabled={notifState === "unsupported"}
              >
                {notifEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                {notifEnabled ? "Notif ON" : "Notif OFF"}
              </button>
            </div>

            <div className="mt-3 text-sm font-extrabold">
              <MsBadge ms={latencyMs} />{" "}
              <span className="ms-1">response server</span>
            </div>

            <button
              onClick={openBuyModal}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Buat Pesanan
              <ChevronRight size={18} />
            </button>

            {/* SALDO KAMU ala screenshot */}
            <div
              className="mt-3 rounded-2xl border p-3"
              style={{
                borderColor: "var(--yinn-border)",
                boxShadow: "var(--yinn-soft)",
                background: "var(--yinn-surface)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 place-items-center rounded-full text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,122,0,0.95), rgba(155,81,224,0.95))",
                  }}
                >
                  <Wallet size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    Saldo Kamu
                  </div>
                  <div className="truncate text-xl font-extrabold">
                    {balanceLoading ? "..." : saldoLabel}
                  </div>

                  {/* ✅ FIX: tampilkan hint error tanpa ubah layout besar */}
                  {balanceErrText ? (
                    <div className="mt-1 truncate text-[10px] font-bold text-red-500">
                      {balanceErrText}
                    </div>
                  ) : null}
                </div>

                {/* ✅ FIX: Top Up redirect /deposit */}
                <button
                  onClick={() => router.push("/deposit")}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold"
                  style={{
                    background: "rgba(34,197,94,0.16)",
                    border: "1px solid rgba(34,197,94,0.35)",
                    color: "rgb(22,163,74)",
                  }}
                  title="Top Up"
                >
                  <ExternalLink size={18} />
                  Top Up
                </button>
              </div>

              <button
                onClick={() => loadBalance({ silent: false })}
                className="mt-2 w-full rounded-xl border border-[var(--yinn-border)] py-2 text-xs font-extrabold text-[var(--yinn-muted)]"
              >
                Refresh Saldo
              </button>
            </div>
          </div>

          {/* kanan promo */}
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
              OTP untuk banyak aplikasi
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
              Beli Nomor
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        {/* ================= PESANAN PENDING (pixel-ish RumahOTP) ================= */}
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
              onClick={() =>
                activeOrder?.order_id && startPolling(activeOrder.order_id)
              }
              className="grid h-10 w-14 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Sync order"
              title="Sync"
            >
              <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
            </button>
          </div>

          {activeOrder ? (
            (() => {
              const cooldownMs = 3 * 60 * 1000;
              const createdAt = Number(activeOrder?.created_at || 0);
              const elapsed = nowTick - createdAt;
              const leftCancel = Math.max(0, cooldownMs - elapsed);
              const canCancel = leftCancel <= 0;

              const phone = String(activeOrder.phone_number || "—");
              const operator = String(activeOrder.operator || "any");
              const appName = String(activeOrder.service || "—");
              const appImg = String(activeOrder.app_img || pickedServiceLogo || "");
              const statusTxt = statusLabel(activeOrder.status);

              const expAt = orderExpiresAt(activeOrder);
              const expTimeBadge = expAt ? hhmm(expAt) : "—";

              const priceBadge = `Rp${formatIDRCompact(activeOrder.price || 0)}`;

              const flagUrl = String(activeOrder.country_flag_url || "").trim() || "";

              return (
                <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] bg-white/40 p-4 dark:bg-black/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-10 place-items-center">
                          {flagUrl ? (
                            <img
                              src={flagUrl}
                              alt="flag"
                              className="h-6 w-8 rounded-sm object-cover"
                            />
                          ) : (
                            <div className="h-6 w-8 rounded-sm bg-black/10 dark:bg-white/10" />
                          )}
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <div className="truncate text-base font-extrabold">
                            {phone}
                          </div>
                          <button
                            onClick={() => {
                              try {
                                navigator.clipboard.writeText(phone);
                                toast.success("Nomor disalin");
                              } catch {
                                toast.error("Gagal copy nomor");
                              }
                            }}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)] bg-white/60 dark:bg-black/10"
                            title="Copy"
                            aria-label="Copy nomor"
                          >
                            <Copy size={16} className="text-[var(--yinn-muted)]" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-sm font-bold text-[var(--yinn-muted)]">
                        <Sparkles size={16} className="text-[var(--yinn-muted)]" />
                        <span className="font-extrabold text-[var(--yinn-text)]">
                          {operator}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-extrabold text-amber-700 dark:text-amber-300">
                        <Clock size={16} />
                        {expTimeBadge}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-sm font-extrabold text-blue-700 dark:text-blue-300">
                        {priceBadge}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                          {appImg ? (
                            <img
                              src={appImg}
                              alt={appName}
                              className="h-9 w-9"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-xs font-extrabold">APP</div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold">
                            {appName}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 text-sm font-extrabold text-amber-600">
                        {statusTxt}
                        <Mail size={18} />
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-[var(--yinn-muted)]">
                      {canCancel ? (
                        <span>Sudah bisa klik batal.</span>
                      ) : (
                        <span>
                          Tunggu{" "}
                          <span className="font-extrabold text-amber-600">
                            {mmssLeft(leftCancel)}
                          </span>{" "}
                          sebelum klik batal.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={openBuyModal}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-extrabold"
                      style={{
                        borderColor: "rgba(59,130,246,0.55)",
                        color: "rgb(37,99,235)",
                        background: "rgba(59,130,246,0.06)",
                        boxShadow: "var(--yinn-soft)",
                      }}
                    >
                      <ShoppingBag size={18} />
                      Beli lagi
                    </button>

                    <button
                      onClick={() => setStatus("cancel")}
                      disabled={!canCancel}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-extrabold disabled:opacity-50"
                      style={{
                        borderColor: "rgba(239,68,68,0.45)",
                        color: "rgb(239,68,68)",
                        background: "rgba(239,68,68,0.06)",
                        boxShadow: "var(--yinn-soft)",
                      }}
                    >
                      <XCircle size={18} />
                      Batal
                    </button>
                  </div>
                </div>
              );
            })()
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
                Buat Pesanan
              </button>
            </div>
          )}
        </section>

        {/* bottom cards */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--yinn-surface)",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="text-sm font-extrabold">Notifikasi</div>
            <div className="mt-1 text-xs text-[var(--yinn-muted)]">
              Aktifkan agar OTP masuk langsung muncul (real-time).
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-extrabold",
                  notifEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-zinc-500/30 bg-zinc-500/10 text-zinc-600"
                )}
              >
                {notifEnabled ? "Aktif" : "Tidak Aktif"}
              </div>
              <div className="rounded-full border border-[var(--yinn-border)] px-3 py-1 text-xs font-extrabold text-[var(--yinn-muted)]">
                Browser
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="rounded-xl border border-[var(--yinn-border)] py-2 text-sm font-extrabold"
                onClick={() => {
                  updateNotifStateFromBrowser();
                  if (notifState === "unsupported")
                    toast.error("Browser tidak support notifikasi");
                  else
                    toast.success(
                      `Status: ${
                        typeof Notification !== "undefined"
                          ? (Notification as any).permission
                          : notifState
                      }`
                    );
                }}
              >
                Cek
              </button>
              <button
                className="rounded-xl py-2 text-sm font-extrabold text-white disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
                onClick={toggleNotif}
                disabled={notifState === "unsupported"}
              >
                {notifEnabled ? "Matikan" : "Aktifkan"}
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] p-3 text-xs text-[var(--yinn-muted)]">
              Kalau permission “Denied”, ubah izin notifikasi di setting browser.
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
            <div className="text-sm font-extrabold">Pertanyaan Umum</div>
            <div className="mt-1 text-xs text-[var(--yinn-muted)]">
              Info singkat biar gak bingung pas order.
            </div>

            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-extrabold">OTP gak masuk</div>
                <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                  Coba Resend. Kalau tetap kosong, Cancel lalu pilih provider lain.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-extrabold">Stok kecil</div>
                <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                  Stok dari server (bisa berubah kapan saja).
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-extrabold">Refund</div>
                <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                  Refund otomatis jika cancel & OTP kosong (sekali saja).
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />

      {/* BUY MODAL */}
      <Modal
        open={openBuy}
        onClose={() => setOpenBuy(false)}
        title="Beli Nomor Virtual"
        subtitle="Pilih aplikasi lalu negara & harga"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold text-[var(--yinn-muted)]">
            {buyStep === "app"
              ? "Step 1: Pilih aplikasi"
              : "Step 2: Pilih negara & harga"}
          </div>

          {buyStep === "country" ? (
            <button
              onClick={() => {
                setBuyStep("app");
                setCountrySearch("");
                setExpandedCountryId("");
                kickModalLoading();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold"
            >
              <ChevronLeft size={16} />
              Kembali
            </button>
          ) : null}
        </div>

        {buyStep === "app" ? (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-3 py-2">
              <Search size={16} className="text-[var(--yinn-muted)]" />
              <input
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Cari nama aplikasi..."
                className="w-full bg-transparent py-2 text-sm outline-none"
                disabled={showAppLoading}
              />
            </div>

            <div className="mt-3 text-xs font-extrabold text-[var(--yinn-muted)]">
              Aplikasi Populer
            </div>

            {showAppLoading ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--yinn-border)] p-3"
                  >
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)]">
                      <Skel className="h-9 w-9 rounded-xl" />
                    </div>
                    <div className="mt-2">
                      <Skel className="mx-auto h-3 w-16 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {popularResolved.map((p) => (
                  <Reveal key={String(p.svc?.service_code)}>
                    <button
                      onClick={() => {
                        toast.success(`Pilih: ${p.name}`);
                        selectServiceAndGoCountries(p.svc);
                      }}
                      className="w-full rounded-2xl border border-[var(--yinn-border)] p-3 text-center hover:bg-black/5 dark:hover:bg-white/5"
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
                  </Reveal>
                ))}
              </div>
            )}

            <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--yinn-border)]">
              {showAppLoading ? (
                <div className="divide-y divide-[var(--yinn-border)]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRowApp key={i} />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[var(--yinn-border)]">
                  {filteredServices.map((s: any) => (
                    <Reveal key={String(s?.service_code)}>
                      <button
                        onClick={() => {
                          toast.success(`Pilih: ${s.service_name}`);
                          selectServiceAndGoCountries(s);
                        }}
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
                        <ChevronRight
                          size={18}
                          className="text-[var(--yinn-muted)]"
                        />
                      </button>
                    </Reveal>
                  ))}
                  {!filteredServices.length && (
                    <div className="p-4 text-sm text-[var(--yinn-muted)]">
                      Tidak ada aplikasi yang cocok.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="h-4" />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                  {pickedServiceLogo ? (
                    <img
                      src={pickedServiceLogo}
                      alt={pickedService?.service_name || "App"}
                      className="h-9 w-9"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-xs font-extrabold">APP</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold">
                    {pickedService?.service_name || "—"}
                  </div>
                  <div className="truncate text-xs text-[var(--yinn-muted)]">
                    Aplikasi yang dipilih
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBuyStep("app");
                    kickModalLoading();
                  }}
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold"
                >
                  Ganti
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-3 py-2">
              <Search size={16} className="text-[var(--yinn-muted)]" />
              <input
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Cari nama negara..."
                className="w-full bg-transparent py-2 text-sm outline-none"
                disabled={!serviceId || showCountryLoading}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 rounded-2xl border border-[var(--yinn-border)] p-1">
              <button
                onClick={() => setSortMode("rate")}
                className={cx(
                  "rounded-xl py-2 text-sm font-extrabold",
                  sortMode === "rate"
                    ? "border border-[var(--yinn-border)] bg-[var(--yinn-surface)]"
                    : "text-[var(--yinn-muted)]"
                )}
              >
                Rate
              </button>
              <button
                onClick={() => setSortMode("harga")}
                className={cx(
                  "rounded-xl py-2 text-sm font-extrabold",
                  sortMode === "harga"
                    ? "border border-[var(--yinn-border)] bg-[var(--yinn-surface)]"
                    : "text-[var(--yinn-muted)]"
                )}
              >
                Harga
              </button>
            </div>

            <div className="mt-3">
              {!serviceId ? (
                <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                  Pilih aplikasi dulu.
                </div>
              ) : showCountryLoading ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--yinn-border)]">
                  <div className="divide-y divide-[var(--yinn-border)]">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonRowCountry key={i} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--yinn-border)]">
                  <div className="divide-y divide-[var(--yinn-border)]">
                    {filteredCountries.map((c: any) => {
                      const open =
                        String(expandedCountryId) === String(c?.number_id);
                      const minp = minPriceFromCountry(c);
                      const pricelist = Array.isArray(c?.pricelist)
                        ? c.pricelist
                        : [];
                      const flagUrl = flagUrlFromCountry(c);
                      const stock = realStockFromCountry(c);

                      return (
                        <div key={String(c?.number_id || Math.random())}>
                          <Reveal>
                            <button
                              className="flex w-full items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                              onClick={() => {
                                setExpandedCountryId(
                                  open ? "" : String(c?.number_id || "")
                                );
                              }}
                            >
                              <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                                {flagUrl ? (
                                  <img
                                    src={flagUrl}
                                    alt={c?.name || "Flag"}
                                    className="h-6 w-6"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded-md bg-black/10 dark:bg-white/10" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-extrabold">
                                  {c?.name || "—"}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--yinn-muted)]">
                                  <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                    {c?.prefix
                                      ? `+${String(c.prefix).replace("+", "")}`
                                      : "—"}
                                  </span>
                                  <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                    {c?.short ? String(c.short) : "—"}
                                  </span>
                                  <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                    Stok {stock || 0}
                                  </span>
                                  <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                    Mulai{" "}
                                    {minp ? formatIDR(applyMarkup(minp)) : "—"}
                                  </span>
                                </div>
                              </div>

                              <ChevronRight
                                size={18}
                                className={cx(
                                  "text-[var(--yinn-muted)] transition",
                                  open ? "rotate-90" : ""
                                )}
                              />
                            </button>
                          </Reveal>

                          {open && (
                            <div className="px-3 pb-3">
                              {pricelist.length === 0 ? (
                                <div className="rounded-2xl border border-[var(--yinn-border)] p-3 text-xs text-[var(--yinn-muted)]">
                                  Provider kosong / stok habis untuk negara ini.
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-2xl border border-[var(--yinn-border)]">
                                  <div className="divide-y divide-[var(--yinn-border)]">
                                    {modalKickLoading ? (
                                      <>
                                        <SkeletonProviderRow />
                                        <SkeletonProviderRow />
                                      </>
                                    ) : null}

                                    {pricelist
                                      .filter((p: any) =>
                                        String(p?.provider_id || "").trim()
                                      )
                                      .map((p: any) => {
                                        const pid = String(p?.provider_id || "");
                                        const key = `${String(
                                          c?.number_id || ""
                                        )}-${pid}`;
                                        const loading = orderingKey === key;

                                        const serverText = String(
                                          p?.server || p?.server_id || ""
                                        ).trim();
                                        const serverLabel = serverText
                                          ? `Server ${serverText}`
                                          : "Server";

                                        const base = safeNum(p?.price);
                                        const sell = applyMarkup(base);

                                        return (
                                          <Reveal key={pid}>
                                            <div className="relative">
                                              {loading ? (
                                                <div className="absolute inset-0 z-10 overflow-hidden rounded-2xl">
                                                  <div className="absolute inset-0 bg-[var(--yinn-surface)] opacity-65" />
                                                  <Skel className="absolute inset-0" />
                                                </div>
                                              ) : null}

                                              <div className="flex items-center gap-2 p-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[11px] font-extrabold text-blue-600">
                                                    {serverLabel}
                                                  </span>
                                                  <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-bold text-[var(--yinn-muted)] dark:bg-white/5">
                                                    ID: {pid || "—"}
                                                  </span>

                                                  {typeof p?.rate !== "undefined" &&
                                                  p?.rate !== null ? (
                                                    <span className="rounded-full bg-zinc-500/10 px-2 py-1 text-[11px] font-extrabold text-zinc-600">
                                                      {fmtRatePercent(p.rate)}
                                                    </span>
                                                  ) : null}
                                                </div>

                                                <div className="ms-auto flex items-center gap-2">
                                                  <div className="text-sm font-extrabold">
                                                    {formatIDR(sell)}
                                                  </div>

                                                  <button
                                                    onClick={() =>
                                                      openOperatorPicker(c, p)
                                                    }
                                                    className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-xs font-extrabold"
                                                    disabled={!!orderingKey}
                                                  >
                                                    Order
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </Reveal>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!filteredCountries.length && (
                      <div className="p-4 text-sm text-[var(--yinn-muted)]">
                        Negara tidak ditemukan.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-4" />
          </>
        )}
      </Modal>

      {/* OPERATOR MODAL */}
      <Modal
        open={openOperator}
        onClose={() => {
          if (opOrdering) return;
          setOpenOperator(false);
        }}
        title="Pilih Operator Seluler"
        subtitle={
          opCtx?.country?.name && opCtx?.provider?.provider_id
            ? `${String(opCtx.country.name)} • Provider ID ${String(
                opCtx.provider.provider_id
              )}`
            : "Pilih operator sebelum order"
        }
      >
        {opLoading ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
              <Skel className="h-4 w-40 rounded-md" />
              <div className="mt-3 grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--yinn-border)] p-3"
                  >
                    <Skel className="mx-auto h-10 w-10 rounded-2xl" />
                    <div className="mt-2">
                      <Skel className="mx-auto h-3 w-14 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : operators.length ? (
          <>
            <div className="rounded-2xl border border-[var(--yinn-border)] p-3 text-xs text-[var(--yinn-muted)]">
              Tap salah satu operator. (Rekomendasi: <b>any</b>)
            </div>

            <div className="mt-3 grid grid-cols-4 gap-3">
              {operators.map((op) => {
                const name = String(op?.name || "—");
                const img = String(op?.image || "").trim();
                const id = String(op?.id || "");

                return (
                  <button
                    key={id || name}
                    disabled={opOrdering}
                    onClick={() => {
                      const c = opCtx?.country;
                      const p = opCtx?.provider;
                      if (!c || !p) return;
                      orderWithOperator(c, p, op);
                    }}
                    className="rounded-2xl border border-[var(--yinn-border)] p-3 text-center hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-60"
                    style={{ boxShadow: "var(--yinn-soft)" }}
                  >
                    <div className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                      {img ? (
                        <img
                          src={img}
                          alt={name}
                          className="h-10 w-10 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-sm font-extrabold">OP</div>
                      )}
                    </div>
                    <div className="mt-2 truncate text-xs font-extrabold">
                      {name}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setOpenOperator(false)}
              disabled={opOrdering}
              className="mt-4 w-full rounded-2xl border border-[var(--yinn-border)] py-3 text-sm font-extrabold disabled:opacity-60"
            >
              {opOrdering ? "Memproses..." : "Batal"}
            </button>
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
            Operator tidak tersedia / gagal dimuat.
          </div>
        )}
      </Modal>
    </div>
  );
}