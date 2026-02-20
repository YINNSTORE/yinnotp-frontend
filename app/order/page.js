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
import { motion } from "framer-motion";
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

function msColorClass(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "text-[var(--yinn-muted)]";
  if (n <= 400) return "text-emerald-600";
  if (n <= 600) return "text-amber-600";
  return "text-rose-600";
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

function minPriceFromCountry(country) {
  const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
  const prices = list.map((p) => Number(p?.price || 0)).filter((x) => x > 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function countryStock(country) {
  const direct = Number(country?.stock_total || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const list = Array.isArray(country?.pricelist) ? country.pricelist : [];
  const sum = list.reduce((acc, p) => acc + (Number(p?.stock || 0) || 0), 0);
  return sum || 0;
}

function applyMarkup(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n + MARKUP_FLAT_IDR;
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

  const EXCEPT = {
    gi: "gib",
  };

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

/* ================= motion ================= */

const revealProps = {
  initial: { opacity: 0, scale: 0.8 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.25, ease: "easeOut" },
};

/* ================= shimmer skeleton ================= */

function SkeletonBox({ className = "" }) {
  return (
    <div
      className={cx(
        "yinn-skel relative overflow-hidden rounded-xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5",
        className
      )}
    />
  );
}

function SkeletonRowApp() {
  return (
    <div className="flex items-center gap-3 p-3">
      <SkeletonBox className="h-10 w-10 rounded-2xl" />
      <div className="flex-1">
        <SkeletonBox className="h-3 w-40 rounded-lg" />
        <div className="mt-2">
          <SkeletonBox className="h-3 w-28 rounded-lg" />
        </div>
      </div>
      <SkeletonBox className="h-6 w-6 rounded-lg" />
    </div>
  );
}

function SkeletonRowCountry() {
  return (
    <div className="flex items-center gap-3 p-3">
      <SkeletonBox className="h-10 w-10 rounded-xl" />
      <div className="flex-1">
        <SkeletonBox className="h-3 w-44 rounded-lg" />
        <div className="mt-2 flex gap-2">
          <SkeletonBox className="h-4 w-14 rounded-full" />
          <SkeletonBox className="h-4 w-14 rounded-full" />
          <SkeletonBox className="h-4 w-28 rounded-full" />
        </div>
      </div>
      <SkeletonBox className="h-6 w-6 rounded-lg" />
    </div>
  );
}

function SkeletonRowProvider() {
  return (
    <div className="flex items-center gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SkeletonBox className="h-6 w-24 rounded-full" />
        <SkeletonBox className="h-6 w-20 rounded-full" />
        <SkeletonBox className="h-6 w-16 rounded-full" />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <SkeletonBox className="h-6 w-20 rounded-lg" />
        <SkeletonBox className="h-9 w-16 rounded-xl" />
      </div>
    </div>
  );
}

function PageBootOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-[var(--yinn-bg)]">
      <div className="mx-auto max-w-[520px] px-4 pt-4">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4">
          <SkeletonBox className="h-4 w-36 rounded-lg" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
              <SkeletonBox className="h-6 w-24 rounded-full" />
              <div className="mt-3">
                <SkeletonBox className="h-4 w-40 rounded-lg" />
              </div>
              <div className="mt-2">
                <SkeletonBox className="h-3 w-28 rounded-lg" />
              </div>
              <div className="mt-4">
                <SkeletonBox className="h-10 w-full rounded-2xl" />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
              <SkeletonBox className="h-4 w-24 rounded-lg" />
              <div className="mt-2">
                <SkeletonBox className="h-4 w-40 rounded-lg" />
              </div>
              <div className="mt-3 flex gap-2">
                <SkeletonBox className="h-6 w-20 rounded-full" />
                <SkeletonBox className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4">
                <SkeletonBox className="h-10 w-full rounded-2xl" />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
            <SkeletonBox className="h-4 w-32 rounded-lg" />
            <div className="mt-3 grid gap-2">
              <SkeletonBox className="h-14 w-full rounded-2xl" />
              <SkeletonBox className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= modal ================= */

function Modal({ open, onClose, title, subtitle, children }) {
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
          className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
          style={{
            maxHeight: "72vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth",
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

/* ================= page ================= */

export default function OrderPage() {
  const [bootLoading, setBootLoading] = useState(true);

  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);

  const [openBuy, setOpenBuy] = useState(false);
  const [buyStep, setBuyStep] = useState("app"); // app | country

  // notif
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState("default"); // default | granted | denied
  const [notifEnabled, setNotifEnabled] = useState(false);

  // services (apps)
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
  const [providersBootLoading, setProvidersBootLoading] = useState(false);

  // order status
  const [activeOrder, setActiveOrder] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const lastOtpRef = useRef("");

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
        const sa = countryStock(a);
        const sb = countryStock(b);
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

  function safeNotify(title, body) {
    try {
      if (!notifEnabled) return;
      if (!notifSupported) return;
      if (notifPermission !== "granted") return;
      new Notification(title, { body });
    } catch {
      // ignore
    }
  }

  async function checkNotifStatus(showToast = true) {
    const supported = typeof window !== "undefined" && "Notification" in window;
    setNotifSupported(supported);

    if (!supported) {
      setNotifPermission("denied");
      setNotifEnabled(false);
      if (showToast) toast.error("Browser tidak support notifikasi.");
      return;
    }

    const perm = Notification.permission;
    setNotifPermission(perm);

    if (perm !== "granted") {
      setNotifEnabled(false);
      if (showToast) toast("Notifikasi belum diizinkan.");
      return;
    }

    if (showToast) toast.success("Notifikasi siap digunakan.");
  }

  async function toggleNotif() {
    const supported = typeof window !== "undefined" && "Notification" in window;
    if (!supported) {
      toast.error("Browser tidak support notifikasi.");
      return;
    }

    const perm = Notification.permission;
    setNotifPermission(perm);

    if (perm === "denied") {
      toast.error("Notifikasi diblokir. Aktifkan dari setting browser.");
      setNotifEnabled(false);
      return;
    }

    if (perm === "default") {
      try {
        const res = await Notification.requestPermission();
        setNotifPermission(res);
        if (res === "granted") {
          setNotifEnabled(true);
          toast.success("Notifikasi diaktifkan.");
          safeNotify("YinnOTP", "Notifikasi aktif.");
        } else {
          setNotifEnabled(false);
          toast("Notifikasi tidak diizinkan.");
        }
      } catch {
        setNotifEnabled(false);
        toast.error("Gagal minta izin notifikasi.");
      }
      return;
    }

    if (perm === "granted") {
      setNotifEnabled((v) => {
        const next = !v;
        toast(next ? "Notifikasi ON" : "Notifikasi OFF");
        return next;
      });
    }
  }

  async function refreshPing() {
    setChecking(true);
    const t0 = performance.now();
    try {
      const r = await ping();
      const t1 = performance.now();
      setLatencyMs(t1 - t0);
      setOnline(!!r?.json?.ok);
    } catch {
      setLatencyMs(null);
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
    setProvidersBootLoading(true);
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
      setProvidersBootLoading(false);
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

      const otp = String(first.otp_code || "");
      if (otp && otp !== "-" && otp !== lastOtpRef.current) {
        lastOtpRef.current = otp;
        safeNotify("OTP Masuk", `Kode OTP: ${otp}`);
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
        return { ...o, status: data.status, otp_code: data.otp_code };
      });

      activityAdd({
        type: "order_status",
        order_id,
        status: data.status,
        otp_code: data.otp_code,
        ts: Date.now(),
      });

      const otp = String(data.otp_code || "");
      if (otp && otp !== "-" && otp !== lastOtpRef.current) {
        lastOtpRef.current = otp;
        safeNotify("OTP Masuk", `Kode OTP: ${otp}`);
      }

      if (isFinalStatus(data.status)) stopPolling();
    }, 2000);
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

  async function orderFromProvider(country, provider) {
    const cid = String(country?.number_id || "");
    const pid = String(provider?.provider_id || "");
    const countryName = String(country?.name || "");

    if (!cid || !pid || !countryName) {
      toast.error("Data negara/provider tidak valid");
      return;
    }

    const key = `${cid}-${pid}`;
    setOrderingKey(key);

    try {
      const opRes = await roOperators(countryName, pid);
      if (!opRes.ok || !opRes.json?.status) {
        toast.error("Gagal load provider/operator");
        return;
      }

      const ops = Array.isArray(opRes.json?.data) ? opRes.json.data : [];
      const oid = ops?.[0]?.id ? String(ops[0].id) : "";
      if (!oid) {
        toast.error("Operator kosong untuk provider ini");
        return;
      }

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

      const basePrice = Number(data.price || provider?.price || 0) || 0;
      const sellPrice = applyMarkup(basePrice);

      const row = {
        order_id: data.order_id,
        phone_number: data.phone_number || "",
        service: data.service || pickedService?.service_name || "",
        country: data.country || country?.name || "",
        operator: data.operator || ops?.[0]?.name || "",
        expires_in_minute: data.expires_in_minute || 0,
        price: sellPrice,
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

      toast.success("Order dibuat");
      setOpenBuy(false);
      startPolling(row.order_id);
    } catch {
      toast.error("Server error");
    } finally {
      setOrderingKey("");
    }
  }

  function openBuyModal() {
    setOpenBuy(true);
    setBuyStep("app");
    setServiceSearch("");
    setCountrySearch("");
    setExpandedCountryId("");
  }

  function selectServiceAndGoCountries(svc) {
    const sid = String(svc?.service_code || "");
    if (!sid) return;

    setServiceId(sid);
    setCountrySearch("");
    setExpandedCountryId("");
    setBuyStep("country");
    loadCountriesForService(sid);
  }

  /* ================= effects ================= */

  useEffect(() => {
    (async () => {
      await Promise.all([refreshPing(), loadServices()]);
      await checkNotifStatus(false);
      setBootLoading(false);
    })();

    const t = setInterval(() => refreshPing(), 5000);
    return () => {
      clearInterval(t);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= render ================= */

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <Toaster position="top-right" />

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
        .yinn-skel {
          position: relative;
        }
        .yinn-skel:before {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-120%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.16) 25%,
            rgba(255, 255, 255, 0.28) 50%,
            rgba(255, 255, 255, 0.16) 75%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: yinnSkel 1.1s ease-out infinite;
          mix-blend-mode: overlay;
        }
        @keyframes yinnSkel {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(120%);
          }
        }
      `}</style>

      <PageBootOverlay show={bootLoading} />

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
              {checking ? "checking..." : online ? "online" : "offline"}
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
            </div>

            <div className="mt-3 text-xs font-bold text-[var(--yinn-muted)]">
              Respons server api
            </div>

            <div className={cx("mt-1 text-sm font-extrabold", msColorClass(latencyMs))}>
              {msLabel(latencyMs)}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--yinn-border)] px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-extrabold">Notifikasi</div>
                <div className="text-[11px] text-[var(--yinn-muted)]">
                  {notifPermission === "denied"
                    ? "Diblokir browser"
                    : notifEnabled
                    ? "ON"
                    : "OFF"}
                </div>
              </div>

              <button
                onClick={toggleNotif}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold",
                  notifEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-[var(--yinn-border)] text-[var(--yinn-muted)]"
                )}
                aria-label="Toggle notifikasi"
                title="Toggle notifikasi"
              >
                {notifEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                {notifEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => checkNotifStatus(true)}
                className="rounded-xl border border-[var(--yinn-border)] py-2 text-sm font-extrabold"
              >
                Cek
              </button>
              <button
                onClick={openBuyModal}
                className="rounded-xl py-2 text-sm font-extrabold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              >
                + Order
              </button>
            </div>
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
            <div className="mt-1 text-sm font-extrabold">OTP untuk banyak aplikasi</div>

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
              onClick={() => activeOrder?.order_id && startPolling(activeOrder.order_id)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              aria-label="Sync order"
              title="Sync"
            >
              <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
            </button>
          </div>

          {activeOrder ? (
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">STATUS</div>
                <div className="mt-1 text-sm font-extrabold">{statusLabel(activeOrder.status)}</div>
              </div>

              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">PHONE</div>
                <div className="mt-1 text-sm font-extrabold break-all">{activeOrder.phone_number || "—"}</div>
              </div>

              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">OTP</div>
                <div className="mt-1 text-lg font-extrabold break-all">{activeOrder.otp_code || "-"}</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setStatus("cancel")}
                  className="rounded-xl border border-[var(--yinn-border)] px-3 py-3 text-sm font-extrabold"
                >
                  Cancel
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
            </div>
          ) : (
            <div className="mt-4 grid place-items-center rounded-2xl border border-[var(--yinn-border)] p-6 text-center">
              <div className="text-sm font-extrabold">Tidak ada pesanan</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">Pesanan aktif akan muncul di sini</div>
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
      </main>

      <BottomNav />

      <Modal
        open={openBuy}
        onClose={() => setOpenBuy(false)}
        title="Beli Nomor Virtual"
        subtitle="Flow: pilih aplikasi → pilih negara → pilih harga"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold text-[var(--yinn-muted)]">
            {buyStep === "app" ? "Step 1: Pilih aplikasi" : "Step 2: Pilih negara & harga"}
          </div>

          {buyStep === "country" ? (
            <button
              onClick={() => {
                setBuyStep("app");
                setCountrySearch("");
                setExpandedCountryId("");
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
                disabled={loadingServices}
              />
            </div>

            <div className="mt-3 text-xs font-extrabold text-[var(--yinn-muted)]">Aplikasi Populer</div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {loadingServices
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={`pop-skel-${i}`}
                      className="rounded-2xl border border-[var(--yinn-border)] p-3"
                    >
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)]">
                        <SkeletonBox className="h-9 w-9 rounded-xl" />
                      </div>
                      <div className="mt-2">
                        <SkeletonBox className="h-3 w-16 mx-auto rounded-lg" />
                      </div>
                    </div>
                  ))
                : popularResolved.map((p) => (
                    <motion.button
                      key={String(p.svc?.service_code)}
                      {...revealProps}
                      onClick={() => {
                        toast.success(`Pilih: ${p.name}`);
                        selectServiceAndGoCountries(p.svc);
                      }}
                      className="rounded-2xl border border-[var(--yinn-border)] p-3 text-center hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                        <img src={p.img} alt={p.name} className="h-9 w-9" loading="lazy" />
                      </div>
                      <div className="mt-2 truncate text-xs font-extrabold">{p.name}</div>
                    </motion.button>
                  ))}
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--yinn-border)]">
              {loadingServices ? (
                <div className="divide-y divide-[var(--yinn-border)]">
                  <SkeletonRowApp />
                  <SkeletonRowApp />
                  <SkeletonRowApp />
                  <SkeletonRowApp />
                  <SkeletonRowApp />
                </div>
              ) : (
                <div className="divide-y divide-[var(--yinn-border)]">
                  {filteredServices.map((s) => (
                    <motion.button
                      key={String(s?.service_code)}
                      {...revealProps}
                      onClick={() => {
                        toast.success(`Pilih: ${s.service_name}`);
                        selectServiceAndGoCountries(s);
                      }}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-black/5 dark:bg-white/5">
                        <img src={s.service_img} alt={s.service_name} className="h-8 w-8" loading="lazy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold">{s.service_name}</div>
                        <div className="truncate text-[11px] text-[var(--yinn-muted)]">Tap untuk pilih</div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--yinn-muted)]" />
                    </motion.button>
                  ))}
                  {!filteredServices.length && (
                    <div className="p-4 text-sm text-[var(--yinn-muted)]">Tidak ada aplikasi yang cocok.</div>
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
                  <div className="truncate text-sm font-extrabold">{pickedService?.service_name || "—"}</div>
                  <div className="truncate text-xs text-[var(--yinn-muted)]">Aplikasi yang dipilih</div>
                </div>

                <button
                  onClick={() => setBuyStep("app")}
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
                disabled={!serviceId || loadingCountries}
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
              ) : loadingCountries ? (
                <div className="rounded-2xl border border-[var(--yinn-border)]">
                  <div className="divide-y divide-[var(--yinn-border)]">
                    <SkeletonRowCountry />
                    <SkeletonRowCountry />
                    <SkeletonRowCountry />
                    <SkeletonRowCountry />
                    <SkeletonRowCountry />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--yinn-border)]">
                  <div className="divide-y divide-[var(--yinn-border)]">
                    {filteredCountries.map((c) => {
                      const open = String(expandedCountryId) === String(c?.number_id);
                      const minp = minPriceFromCountry(c);
                      const pricelist = Array.isArray(c?.pricelist) ? c.pricelist : [];
                      const flagUrl = flagUrlFromCountry(c);
                      const stock = countryStock(c);

                      return (
                        <div key={String(c?.number_id || Math.random())}>
                          <motion.button
                            {...revealProps}
                            className="flex w-full items-center gap-3 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                            onClick={() => setExpandedCountryId(open ? "" : String(c?.number_id || ""))}
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
                              <div className="truncate text-sm font-extrabold">{c?.name || "—"}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--yinn-muted)]">
                                <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                  {c?.prefix ? `+${String(c.prefix).replace("+", "")}` : "—"}
                                </span>
                                <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                  {c?.short ? String(c.short) : "—"}
                                </span>
                                <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                  Stock {stock || 0}
                                </span>
                                <span className="rounded-full border border-[var(--yinn-border)] px-2 py-0.5">
                                  Mulai {minp ? formatIDR(applyMarkup(minp)) : "—"}
                                </span>
                              </div>
                            </div>

                            <ChevronRight
                              size={18}
                              className={cx("text-[var(--yinn-muted)] transition", open ? "rotate-90" : "")}
                            />
                          </motion.button>

                          {open && (
                            <div className="px-3 pb-3">
                              {providersBootLoading ? (
                                <div className="overflow-hidden rounded-2xl border border-[var(--yinn-border)]">
                                  <div className="divide-y divide-[var(--yinn-border)]">
                                    <SkeletonRowProvider />
                                    <SkeletonRowProvider />
                                    <SkeletonRowProvider />
                                  </div>
                                </div>
                              ) : pricelist.length === 0 ? (
                                <div className="rounded-2xl border border-[var(--yinn-border)] p-3 text-xs text-[var(--yinn-muted)]">
                                  Provider kosong / stok habis untuk negara ini.
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-2xl border border-[var(--yinn-border)]">
                                  <div className="divide-y divide-[var(--yinn-border)]">
                                    {pricelist.map((p) => {
                                      const pid = String(p?.provider_id || "");
                                      const key = `${String(c?.number_id || "")}-${pid}`;
                                      const loading = orderingKey === key;

                                      const serverText = String(p?.server || p?.server_id || "").trim();
                                      const serverLabel = serverText ? `Server ${serverText}` : "Server";

                                      const base = Number(p?.price || 0) || 0;
                                      const sell = applyMarkup(base);

                                      return (
                                        <motion.div key={pid} {...revealProps} className="relative">
                                          {loading ? (
                                            <div className="absolute inset-0 z-10 bg-[var(--yinn-surface)]/70">
                                              <div className="h-full w-full yinn-skel" />
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
                                              {p?.rate ? (
                                                <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-extrabold text-[var(--yinn-muted)] dark:bg-white/5">
                                                  {String(p.rate)}
                                                </span>
                                              ) : null}
                                            </div>

                                            <div className="ms-auto flex items-center gap-2">
                                              <div className="text-sm font-extrabold">{formatIDR(sell)}</div>
                                              <button
                                                onClick={() => orderFromProvider(c, p)}
                                                className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-xs font-extrabold"
                                                disabled={!!orderingKey}
                                              >
                                                Order
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
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
                      <div className="p-4 text-sm text-[var(--yinn-muted)]">Negara tidak ditemukan.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-4" />
          </>
        )}
      </Modal>
    </div>
  );
}