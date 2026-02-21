"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

// NEW: persist pending orders + balance (client-side fallback)
const LS_PENDING_KEY = "yinnotp:pending_orders:v1";
const LS_BALANCE_KEY = "yinnotp:balance_idr:v1"; // fallback only (kalau belum ada store saldo global)

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,()-]/gu, "")
    .trim();
}

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function msLabel(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)}ms`;
}

function msRange(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "muted";
  if (n <= 400) return "good";
  if (n <= 600) return "warn";
  return "bad";
}

function MsBadge({ ms }) {
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

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function minPriceFromCountry(country) {
  const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
  const prices = list.map((p) => safeNum(p?.price)).filter((x) => x > 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function realStockFromCountry(country) {
  const st = safeNum(country?.stock_total);
  if (st > 0) return st;

  const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
  const sum = list.reduce((acc, p) => acc + safeNum(p?.stock), 0);
  return sum > 0 ? sum : 0;
}

function applyMarkup(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n + MARKUP_FLAT_IDR;
}

/* FIX: rate tampil pakai persen seperti RumahOTP */
function fmtRatePercent(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "";
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  const v = isInt ? String(Math.round(n)) : n.toFixed(2);
  return `${v}%`;
}

/* ================= localStorage helpers (pending + balance fallback) ================= */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function balanceGet() {
  // fallback ONLY: kalau kamu udah punya saldo store sendiri, ganti ini ke store itu.
  const v = readJSON(LS_BALANCE_KEY, 0);
  return safeNum(v);
}

function balanceSet(n) {
  writeJSON(LS_BALANCE_KEY, safeNum(n));
  try {
    window.dispatchEvent(
      new CustomEvent("yinnotp:balance_changed", { detail: { balance: n } })
    );
  } catch {}
}

function balanceApplyDelta(delta) {
  const cur = balanceGet();
  const next = cur + safeNum(delta);
  balanceSet(next);
  return next;
}

function pendingLoad() {
  const list = readJSON(LS_PENDING_KEY, []);
  return Array.isArray(list) ? list : [];
}

function pendingSave(list) {
  writeJSON(LS_PENDING_KEY, Array.isArray(list) ? list : []);
}

function upsertPending(list, order) {
  const oid = String(order?.order_id || "");
  if (!oid) return list;

  const next = Array.isArray(list) ? list.slice() : [];
  const idx = next.findIndex((x) => String(x?.order_id) === oid);
  if (idx >= 0) next[idx] = { ...next[idx], ...order };
  else next.unshift(order);
  // keep newest first
  next.sort((a, b) => safeNum(b?.created_at) - safeNum(a?.created_at));
  return next;
}

function updatePendingStatus(list, order_id, patch) {
  const oid = String(order_id || "");
  if (!oid) return list;
  const next = Array.isArray(list) ? list.slice() : [];
  const idx = next.findIndex((x) => String(x?.order_id) === oid);
  if (idx >= 0) next[idx] = { ...next[idx], ...patch };
  return next;
}

function fmtMMSS(sec) {
  const s = Math.max(0, Math.floor(safeNum(sec)));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function shouldRefund(order) {
  // Refund kalau belum ada OTP dan belum “received/done/completed”
  const status = String(order?.status || "").toLowerCase();
  const otp = String(order?.otp_code || "").trim();
  const otpOk = otp && otp !== "-" && otp !== "—";
  if (otpOk) return false;
  if (status.includes("received")) return false;
  if (status.includes("done") || status.includes("completed")) return false;
  return true;
}

/* ================= flags ================= */

function flagCodeForCountry(country) {
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
  const EXCEPT = { gi: "gib" };
  if (EXCEPT[iso2]) return EXCEPT[iso2];
  if (iso2) return iso2;

  if (nameNorm.includes("indonesia")) return "id";
  if (nameNorm.includes("philippines")) return "ph";
  if (nameNorm.includes("malaysia")) return "my";
  if (nameNorm.includes("thailand")) return "th";
  if (nameNorm.includes("colombia")) return "co";
  return "";
}

function flagUrlFromCountry(country) {
  const direct = String(
    country?.flag_img || country?.flag_url || country?.img || country?.image || ""
  ).trim();
  if (direct) return direct;

  const code = flagCodeForCountry(country);
  if (!code) return "";
  return `https://assets.rumahotp.com/flags/${code}.png`;
}

/* ================= Scroll Reveal (smoothed) ================= */
function Reveal({ children, className = "" }) {
  const ref = useRef(null);
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
      { threshold: 0.12 }
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
        transform: inView ? "translateY(0px)" : "translateY(10px)",
        transition: "transform 220ms ease-out, opacity 220ms ease-out",
        contain: "content",
      }}
    >
      {children}
    </div>
  );
}

/* ================= Skeleton shimmer ================= */

function Skel({ className = "" }) {
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

function FullscreenBoot({ show }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-[var(--yinn-bg)]">
      <BootPageSkeleton />
    </div>
  );
}

function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey, { passive: true });
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
            scrollBehavior: "auto",
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
  const [bootLoading, setBootLoading] = useState(true);

  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastPingTs, setLastPingTs] = useState(0);
  const [ago, setAgo] = useState(0);

  // NEW: balance fallback + refresh when other page changes it
  const [balanceIdr, setBalanceIdr] = useState(0);

  // notifikasi realtime (Browser Notification)
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifState, setNotifState] = useState("unsupported"); // unsupported | default | granted | denied
  const lastNotifiedOtpRef = useRef("");

  // modal
  const [openBuy, setOpenBuy] = useState(false);
  const [buyStep, setBuyStep] = useState("app"); // app | country

  // services
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceId, setServiceId] = useState("");

  // countries
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [sortMode, setSortMode] = useState("rate"); // rate | harga
  const [expandedCountryId, setExpandedCountryId] = useState("");
  const [orderingKey, setOrderingKey] = useState("");

  // order status
  const [activeOrder, setActiveOrder] = useState(null);
  const activeOrderRef = useRef(null);

  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // NEW: pending orders list (persist)
  const [pendingOrders, setPendingOrders] = useState([]);

  // NEW: cancel state (cooldown button tetap bisa di klik, tapi disable pas request doang)
  const [cancelling, setCancelling] = useState(false);

  // NEW: countdown tick (cooldown UI)
  const [tick, setTick] = useState(0);

  /* loading anim sebentar pas modal */
  const [modalKickLoading, setModalKickLoading] = useState(false);
  const modalKickRef = useRef(null);
  function kickModalLoading(ms = 450) {
    setModalKickLoading(true);
    if (modalKickRef.current) clearTimeout(modalKickRef.current);
    modalKickRef.current = setTimeout(() => setModalKickLoading(false), ms);
  }

  /* ================== operator picker modal ================== */
  const [openOperator, setOpenOperator] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [operators, setOperators] = useState([]);
  const [opCtx, setOpCtx] = useState({ country: null, provider: null });
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

  function saveNotifPref(v) {
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
    const p = Notification.permission;
    setNotifState(p);

    const pref = readNotifPref();
    const enabled = p === "granted" && pref;
    setNotifEnabled(enabled);
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    try {
      const p = await Notification.requestPermission();
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

    const currentPerm = Notification.permission;
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

  function fireOtpNotification(otp, phone) {
    if (!notifEnabled) return;
    if (!otp || otp === "-" || otp === "—") return;

    const key = `${phone || ""}:${otp}`;
    if (lastNotifiedOtpRef.current === key) return;
    lastNotifiedOtpRef.current = key;

    try {
      new Notification("YinnOTP • OTP Masuk", {
        body: phone ? `Nomor: ${phone}\nOTP: ${otp}` : `OTP: ${otp}`,
        silent: false,
      });
    } catch {}
  }

  /* ================= API ================= */

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
        toast.error("Gagal load layanan");
        setServices([]);
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setServices(list);
    } catch {
      toast.error("Server error");
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }

  async function loadCountriesForService(sid) {
    setLoadingCountries(true);
    try {
      const r = await roCountries(sid);
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal load negara");
        setCountries([]);
        setExpandedCountryId("");
        return;
      }
      const list = Array.isArray(r.json?.data) ? r.json.data : [];
      setCountries(list);
      setExpandedCountryId("");
    } catch {
      toast.error("Server error");
      setCountries([]);
      setExpandedCountryId("");
    } finally {
      setLoadingCountries(false);
    }
  }

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

  function persistOrderPatch(order_id, patch) {
    setPendingOrders((prev) => {
      const next = updatePendingStatus(prev, order_id, patch);
      pendingSave(next);
      return next;
    });
  }

  async function startPolling(order_id) {
    stopPolling();
    setPolling(true);

    const first = await pollOnce(order_id);
    if (first) {
      // update active + pending storage
      setActiveOrder((o) => {
        if (!o) return o;
        const next = { ...o, status: first.status, otp_code: first.otp_code };
        activeOrderRef.current = next;
        return next;
      });

      persistOrderPatch(order_id, {
        status: first.status,
        otp_code: first.otp_code,
        updated_at: Date.now(),
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: first.status,
        otp_code: first.otp_code,
        ts: Date.now(),
      });

      const phone = activeOrderRef.current?.phone_number || "";
      if (String(first.otp_code || "").trim()) {
        fireOtpNotification(first.otp_code, phone);
      }

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
        const next = { ...o, status: data.status, otp_code: data.otp_code };
        activeOrderRef.current = next;

        if (String(data?.otp_code || "").trim()) {
          fireOtpNotification(data.otp_code, next.phone_number);
        }
        return next;
      });

      persistOrderPatch(order_id, {
        status: data.status,
        otp_code: data.otp_code,
        updated_at: Date.now(),
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: data.status,
        otp_code: data.otp_code,
        ts: Date.now(),
      });

      if (isFinalStatus(data.status)) stopPolling();
    }, 1800);
  }

  async function setStatus(action) {
    if (!activeOrderRef.current?.order_id) return;
    const order_id = activeOrderRef.current.order_id;

    const r = await roStatusSet(order_id, action);
    if (!r.ok || !r.json?.success) {
      toast.error("Gagal update status");
      return;
    }
    toast.success("OK");
    startPolling(order_id);
  }

  // NEW: cancel yang bener-bener jalan + refund saldo (kalau eligible)
  async function cancelOrder() {
    const order = activeOrderRef.current;
    if (!order?.order_id) return;
    if (cancelling) return;

    setCancelling(true);
    try {
      // tetap allow klik saat cooldown
      const r = await roStatusSet(order.order_id, "cancel");
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal cancel (mungkin masih cooldown / server)");
        return;
      }

      // update status local cepat
      const patch = { status: "canceled", canceled_at: Date.now() };
      setActiveOrder((o) => {
        if (!o) return o;
        const next = { ...o, ...patch };
        activeOrderRef.current = next;
        return next;
      });
      persistOrderPatch(order.order_id, patch);

      activityAdd({
        type: "order_cancel",
        order_id: order.order_id,
        ts: Date.now(),
      });

      // refund logic: hanya kalau sebelumnya sudah kepotong & belum terpakai verif
      const alreadyCharged = !!order?.charged;
      const refundable = shouldRefund(order);
      if (alreadyCharged && refundable) {
        const amt = safeNum(order?.charged_amount || order?.price || 0);
        if (amt > 0) {
          balanceApplyDelta(amt);
          toast.success(`Cancel sukses • Refund ${formatIDR(amt)}`);
          // mark refunded
          const refundPatch = {
            charged: false,
            refunded: true,
            refunded_amount: amt,
            refunded_at: Date.now(),
          };
          setActiveOrder((o) => {
            if (!o) return o;
            const next = { ...o, ...refundPatch };
            activeOrderRef.current = next;
            return next;
          });
          persistOrderPatch(order.order_id, refundPatch);

          activityAdd({
            type: "refund",
            order_id: order.order_id,
            amount: amt,
            ts: Date.now(),
          });
        } else {
          toast.success("Cancel sukses");
        }
      } else {
        toast.success("Cancel sukses");
      }

      stopPolling();
    } catch {
      toast.error("Server error cancel");
    } finally {
      setCancelling(false);
    }
  }

  /* ================= operator picker flow ================= */

  async function openOperatorPicker(country, provider) {
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
      const ok = !!(opRes?.ok && (opRes?.json?.status || opRes?.json?.success));
      if (!ok) {
        toast.error("Gagal load operator");
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

  async function orderWithOperator(country, provider, operator) {
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
      if (!r.ok || !r.json?.success) {
        toast.error("Gagal buat order");
        return;
      }

      const data = r.json?.data || null;
      if (!data?.order_id) {
        toast.error("Order id kosong");
        return;
      }

      const basePrice = safeNum(data.price || provider?.price);
      const sellPrice = applyMarkup(basePrice);

      // NEW: potong saldo beneran (fallback localStorage)
      const curBal = balanceGet();
      if (sellPrice > 0 && curBal < sellPrice) {
        // Kalau backend udah motong saldo, bagian ini bisa dihapus.
        toast.error("Saldo tidak cukup");
        // optional: cancel order yang baru kebentuk di server biar gak nyangkut
        try {
          await roStatusSet(String(data.order_id), "cancel");
        } catch {}
        return;
      }

      if (sellPrice > 0) {
        balanceApplyDelta(-sellPrice);
        setBalanceIdr(balanceGet());
      }

      const createdAt = Date.now();
      const cooldownSec = safeNum(data?.cooldown_second || data?.cooldown || 180);
      const cooldownUntil = createdAt + cooldownSec * 1000;

      const row = {
        order_id: data.order_id,
        phone_number: data.phone_number || "",
        service: data.service || pickedService?.service_name || "",
        country: data.country || country?.name || "",
        operator: data.operator || operator?.name || "",
        expires_in_minute: data.expires_in_minute || 0,
        price: sellPrice,
        created_at: createdAt,
        status: "waiting",
        otp_code: "-",

        // NEW: charge tracking for refund
        charged: sellPrice > 0,
        charged_amount: sellPrice,
        refunded: false,

        // NEW: cooldown tracking
        cooldown_second: cooldownSec,
        cooldown_until: cooldownUntil,
      };

      // set active + ref
      setActiveOrder(row);
      activeOrderRef.current = row;

      // NEW: masuk pending list + persist (biar muncul di pending & activity)
      setPendingOrders((prev) => {
        const next = upsertPending(prev, row);
        pendingSave(next);
        return next;
      });

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

      toast.success("Order dibuat");
      setOpenOperator(false);
      setOpenBuy(false);

      startPolling(row.order_id);
    } catch {
      toast.error("Server error");
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

  function selectServiceAndGoCountries(svc) {
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

    try {
      const pref = readNotifPref();
      setNotifEnabled(pref);
    } catch {}

    updateNotifStateFromBrowser();

    // NEW: load pending orders + set activeOrder (latest non-final kalau ada)
    try {
      const list = pendingLoad();
      setPendingOrders(list);

      const latestActive =
        list.find((x) => x && !isFinalStatus(x?.status)) || list[0] || null;

      if (latestActive?.order_id) {
        setActiveOrder(latestActive);
        activeOrderRef.current = latestActive;
      }
    } catch {}

    // NEW: load balance fallback
    setBalanceIdr(balanceGet());
    const onBal = () => setBalanceIdr(balanceGet());
    try {
      window.addEventListener("yinnotp:balance_changed", onBal);
    } catch {}

    (async () => {
      setBootLoading(true);
      await Promise.allSettled([refreshPing(), loadServices()]);
      if (!alive) return;
      updateNotifStateFromBrowser();
      setBootLoading(false);
    })();

    const t = setInterval(() => refreshPing(), 5000);

    // NEW: tick for countdown UI
    const t2 = setInterval(() => setTick((x) => x + 1), 250);

    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(t2);
      stopPolling();
      if (modalKickRef.current) clearTimeout(modalKickRef.current);
      try {
        window.removeEventListener("yinnotp:balance_changed", onBal);
      } catch {}
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

  const showAppLoading = loadingServices || modalKickLoading;
  const showCountryLoading = loadingCountries || modalKickLoading;

  // NEW: derive current pending card = latest non-final
  const currentPending = useMemo(() => {
    const list = Array.isArray(pendingOrders) ? pendingOrders : [];
    const hit =
      list.find((x) => x && !isFinalStatus(x?.status)) ||
      (activeOrder && !isFinalStatus(activeOrder?.status) ? activeOrder : null);
    return hit || null;
  }, [pendingOrders, activeOrder]);

  const pendingCount = useMemo(() => {
    const list = Array.isArray(pendingOrders) ? pendingOrders : [];
    return list.filter((x) => x && !isFinalStatus(x?.status)).length;
  }, [pendingOrders]);

  // cooldown seconds left
  const cooldownLeftSec = useMemo(() => {
    const o = currentPending;
    const until = safeNum(o?.cooldown_until);
    if (!until) return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPending?.cooldown_until, tick]);

  /* ================= render ================= */

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />
      <FullscreenBoot show={bootLoading} />

      <style jsx global>{`
        html,
        body {
          scroll-behavior: auto; /* biar scroll finger natural & smooth (bukan animasi) */
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
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scroll-behavior: auto;
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
              onClick={() => {
                setBalanceIdr(balanceGet());
                refreshPing();
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            </button>
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
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

            {/* NEW: saldo fallback display (biar keliatan potong/refund) */}
            <div className="mt-3 text-xs font-extrabold text-[var(--yinn-muted)]">
              Saldo (fallback)
            </div>
            <div className="mt-1 text-sm font-extrabold">{formatIDR(balanceIdr)}</div>

            <button
              onClick={openBuyModal}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              + Buat Pesanan
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
            <div className="text-sm font-extrabold">
              Pesanan Pending{" "}
              <span className="ms-2 rounded-full border border-[var(--yinn-border)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--yinn-muted)]">
                {pendingCount}
              </span>
            </div>
            <button
              onClick={() =>
                currentPending?.order_id && startPolling(currentPending.order_id)
              }
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Sync order"
              title="Sync"
            >
              <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
            </button>
          </div>

          {currentPending ? (
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">
                      NOMOR
                    </div>
                    <div className="mt-1 text-sm font-extrabold break-all">
                      {currentPending.phone_number || "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                      {currentPending.service || "—"} •{" "}
                      {currentPending.operator || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-extrabold text-[var(--yinn-muted)]">
                      HARGA
                    </div>
                    <div className="mt-1 text-sm font-extrabold">
                      {formatIDR(currentPending.price || 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    STATUS
                  </div>
                  <div className="mt-1 text-sm font-extrabold">
                    {statusLabel(currentPending.status)}
                  </div>
                  {cooldownLeftSec > 0 ? (
                    <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                      Tunggu <b>{fmtMMSS(cooldownLeftSec)}</b> (cooldown)
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                      Bisa cancel kapan saja
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">
                    OTP
                  </div>
                  <div className="mt-1 text-lg font-extrabold break-all">
                    {currentPending.otp_code || "-"}
                  </div>
                </div>
              </div>

              {/* tombol utama (sesuai request: cancel harus bisa dipencet saat cooldown) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={cancelOrder}
                  disabled={cancelling}
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold disabled:opacity-60"
                >
                  {cancelling ? "..." : "Batal"}
                </button>
                <button
                  onClick={() => setStatus("resend")}
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                >
                  Resend
                </button>
                <button
                  onClick={() => setStatus("done")}
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                >
                  Done
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--yinn-border)] p-3 text-xs text-[var(--yinn-muted)]">
                Refund otomatis kalau kamu cancel dan <b>OTP belum masuk</b> / nomor
                belum terpakai verifikasi.
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
                          ? Notification.permission
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
                <div className="text-xs font-extrabold">Cancel & refund</div>
                <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                  Tombol Batal tetap bisa dipencet walau cooldown. Refund jalan kalau
                  OTP belum masuk.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-extrabold">Activity</div>
                <div className="mt-1 text-[11px] text-[var(--yinn-muted)]">
                  Semua create / status / cancel / refund otomatis masuk ke Activity.
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
                  {filteredServices.map((s) => (
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
                    {filteredCountries.map((c) => {
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
                                  <div className="text-sm font-extrabold">🏳️</div>
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
                                      .filter((p) =>
                                        String(p?.provider_id || "").trim()
                                      )
                                      .map((p) => {
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
              Tap salah satu operator. (Rekomendasi: <b>any</b> biar cepat)
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
