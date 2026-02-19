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
  ChevronRight,
  Search,
  Loader2,
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

/**
 * NOTE:
 * - Saldo RumahOTP sengaja DIHILANGKAN dari UI (sesuai request).
 * - Online + response time dibuat real-time (ping berkala).
 * - UI dibuat mirip screenshot: card "Get Virtual Number", "Pesanan Pending", "Notifikasi", "Pertanyaan Umum".
 * - Modal "Beli Nomor Virtual" berisi list aplikasi + search.
 * - Link logo aplikasi pakai mapping populer (sisanya fallback).
 */

const APP_ICON = {
  "whatsapp": "https://assets.rumahotp.com/apps/wa.png",
  "kredito": "https://assets.rumahotp.com/apps/bdp.png",
  "any other": "https://assets.rumahotp.com/apps/ot.png",
  "telegram": "https://assets.rumahotp.com/apps/tg.png",
  "grab": "https://assets.rumahotp.com/apps/jg.png",
  "dana": "https://assets.rumahotp.com/apps/fr.png",
  "facebook": "https://assets.rumahotp.com/apps/fb.png",
  "google, gmail, youtube": "https://assets.rumahotp.com/apps/go.png",
  "myxl": "https://assets.rumahotp.com/apps/bkf.png",
  "indomaret": "https://assets.rumahotp.com/apps/ju.png",
  "tokopedia": "https://assets.rumahotp.com/apps/xd.png",
  "instagram": "https://assets.rumahotp.com/apps/ig.png",
};

const POPULAR_APP_NAMES = [
  "WhatsApp",
  "Kredito",
  "Any Other",
  "Telegram",
  "Grab",
  "DANA",
];

const FAQ_ITEMS = [
  { title: "OTP gak masuk", desc: "Masuk", icon: "info" },
  { title: "Cancel tapi saldo terpotong", desc: "", icon: "warn" },
  { title: "Lupa cancel active order", desc: "", icon: "warn" },
  { title: "Syarat refund", desc: "", icon: "doc" },
];

function formatMs(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Math.max(0, Math.round(v))}ms`;
}

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
  return s.includes("completed") || s.includes("done") || s.includes("canceled") || s.includes("cancel");
}

function iconForServiceName(name) {
  const k = String(name || "").trim().toLowerCase();
  if (APP_ICON[k]) return APP_ICON[k];
  // fallback: coba cocokkan "Google" dll dengan partial
  if (k.includes("whatsapp")) return APP_ICON["whatsapp"];
  if (k.includes("telegram")) return APP_ICON["telegram"];
  if (k.includes("facebook")) return APP_ICON["facebook"];
  if (k.includes("instagram")) return APP_ICON["instagram"];
  if (k.includes("google")) return APP_ICON["google, gmail, youtube"];
  return "https://assets.rumahotp.com/apps/null.png";
}

function SoftCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "var(--yinn-surface)",
        borderColor: "var(--yinn-border)",
        boxShadow: "var(--yinn-soft)",
      }}
    >
      {children}
    </div>
  );
}

function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="close overlay"
      />
      <div
        className="absolute left-0 right-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-3xl border p-4"
        style={{
          background: "var(--yinn-surface)",
          borderColor: "var(--yinn-border)",
          boxShadow: "0 -20px 60px rgba(0,0,0,.25)",
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/10" />
        {children}
      </div>
    </div>
  );
}

export default function OrderPage() {
  // online + response time
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);

  // rumahotp data
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);

  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [operators, setOperators] = useState([]);
  const [operatorId, setOperatorId] = useState("");
  const [loadingOperators, setLoadingOperators] = useState(false);

  const [ordering, setOrdering] = useState(false);

  const [activeOrder, setActiveOrder] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // modal aplikasi
  const [sheetOpen, setSheetOpen] = useState(false);
  const [appQuery, setAppQuery] = useState("");

  const pickedService = useMemo(() => {
    return services.find((x) => String(x?.service_code) === String(serviceId)) || null;
  }, [services, serviceId]);

  const pickedCountry = useMemo(() => {
    return countries.find((x) => String(x?.number_id) === String(countryId)) || null;
  }, [countries, countryId]);

  const pickedProvider = useMemo(() => {
    return (pickedCountry?.pricelist || []).find((x) => String(x?.provider_id) === String(providerId)) || null;
  }, [pickedCountry, providerId]);

  const allServicesFiltered = useMemo(() => {
    const q = String(appQuery || "").trim().toLowerCase();
    const list = Array.isArray(services) ? services : [];
    if (!q) return list;
    return list.filter((s) => String(s?.service_name || "").toLowerCase().includes(q));
  }, [services, appQuery]);

  const popularServices = useMemo(() => {
    const map = new Map();
    for (const s of services) {
      const n = String(s?.service_name || "");
      map.set(n.toLowerCase(), s);
    }
    const out = [];
    for (const want of POPULAR_APP_NAMES) {
      const hit = map.get(want.toLowerCase());
      if (hit) out.push(hit);
    }
    return out;
  }, [services]);

  async function refreshPing() {
    setChecking(true);
    const t0 = Date.now();
    try {
      const r = await ping();
      const ok = !!(r?.json?.ok);
      setOnline(ok);
      setLatencyMs(Date.now() - t0);
    } catch {
      setOnline(false);
      setLatencyMs(null);
    } finally {
      setChecking(false);
    }
  }

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

      // default service: WhatsApp kalau ada, kalau tidak pakai item pertama
      if (!serviceId) {
        const wa = list.find((x) => String(x?.service_name || "").toLowerCase() === "whatsapp");
        setServiceId(String((wa || list?.[0])?.service_code || ""));
      }
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

      // reset selection
      const firstCountry = list?.[0] || null;
      const firstProvider = firstCountry?.pricelist?.[0] || null;

      setCountryId(firstCountry?.number_id ? String(firstCountry.number_id) : "");
      setProviderId(firstProvider?.provider_id ? String(firstProvider.provider_id) : "");
      setOperatorId("");
      setOperators([]);
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
      setActiveOrder((o) => (o ? { ...o, status: first.status, otp_code: first.otp_code } : o));
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

      setActiveOrder((o) => (o ? { ...o, status: data.status, otp_code: data.otp_code } : o));

      activityAdd({
        type: "order_status",
        order_id,
        status: data.status,
        otp_code: data.otp_code,
        ts: Date.now(),
      });

      if (isFinalStatus(data.status)) stopPolling();
    }, 2500);
  }

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
      // endpoint order v2: number_id + provider_id + operator_id
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

      toast.success("Order dibuat");
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

  useEffect(() => {
    refreshPing();
    loadServices();

    const t = setInterval(() => refreshPing(), 8000);
    return () => {
      clearInterval(t);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    loadCountries(serviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  useEffect(() => {
    if (!pickedCountry?.name || !providerId) return;
    loadOperators(pickedCountry.name, providerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedCountry?.name, providerId]);

  const topStatusText = useMemo(() => {
    if (checking) return "checking...";
    return online ? "Online" : "Offline";
  }, [checking, online]);

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
            <div className="truncate text-sm font-extrabold leading-tight">Order</div>
            <div className="truncate text-[11px] text-[var(--yinn-muted)]">
              {topStatusText} • {online ? `${formatMs(latencyMs)} response server saat ini` : "—"}
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={refreshPing}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              style={{ boxShadow: "var(--yinn-soft)" }}
              title="Refresh status"
              aria-label="Refresh status"
            >
              {online ? <SignalHigh size={16} /> : <SignalLow size={16} />}
              <span>{online ? "Online" : "Offline"}</span>
              <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
            </button>

            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        {/* TOP ROW CARDS: Saldo Kamu + Get Virtual Number */}
        <div className="grid gap-3 md:grid-cols-2">
          <SoftCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--yinn-border)]">
                <span className="text-sm font-extrabold">₿</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">Status</div>
                <div className="mt-1 text-sm font-extrabold">
                  {online ? "Online" : "Offline"}{" "}
                  <span className="text-[var(--yinn-muted)] font-bold">
                    • {online ? `${formatMs(latencyMs)} response` : "—"}
                  </span>
                </div>
              </div>

              <div className="ms-auto">
                <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-xs font-extrabold">
                  <span className={online ? "text-emerald-500" : "text-red-500"}>●</span>
                  <span>{online ? "Online" : "Offline"}</span>
                </div>
              </div>
            </div>
          </SoftCard>

          <SoftCard
            className="p-4"
            // gradient mirip contoh
            style={{
              background:
                "linear-gradient(135deg, rgba(255,141,75,.28), rgba(130,99,255,.22))",
              borderColor: "var(--yinn-border)",
              boxShadow: "var(--yinn-soft)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold">Get Virtual Number</div>
                <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                  OTP access for banyak apps di banyak negara
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {["WhatsApp", "Telegram", "Facebook", "Google"].map((n) => (
                      <img
                        key={n}
                        src={iconForServiceName(n)}
                        alt={n}
                        className="h-7 w-7 rounded-full border border-white/60 bg-white object-contain"
                        loading="lazy"
                      />
                    ))}
                  </div>
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">+ banyak lainnya</div>
                </div>
              </div>

              <button
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
              >
                Beli Nomor <ChevronRight size={18} />
              </button>
            </div>
          </SoftCard>
        </div>

        {/* PESANAN PENDING */}
        <SoftCard className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Pesanan Pending</div>
            <button
              onClick={() => activeOrder?.order_id && startPolling(activeOrder.order_id)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={18} className={polling ? "animate-spin" : ""} />
            </button>
          </div>

          {!activeOrder ? (
            <div className="mt-3 grid place-items-center rounded-2xl border border-[var(--yinn-border)] p-6">
              <div className="text-sm font-extrabold">Tidak ada pesanan</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">Pesanan aktif akan muncul disini</div>

              <button
                onClick={() => setSheetOpen(true)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white"
                style={{ background: "rgba(0,0,0,.75)" }}
              >
                + Buat Pesanan
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">Order</div>
                    <div className="mt-1 flex items-center gap-2">
                      <img
                        src={iconForServiceName(activeOrder.service)}
                        alt={activeOrder.service}
                        className="h-8 w-8 rounded-xl border border-[var(--yinn-border)] bg-white object-contain"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{activeOrder.service}</div>
                        <div className="truncate text-[11px] text-[var(--yinn-muted)]">
                          {activeOrder.country} • {activeOrder.operator}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">Status</div>
                    <div className="mt-1 text-sm font-extrabold">{statusLabel(activeOrder.status)}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-xl border border-[var(--yinn-border)] p-3">
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">PHONE</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold break-all">{activeOrder.phone_number || "—"}</div>
                      <button
                        onClick={() => {
                          copyText(activeOrder.phone_number);
                          toast.success("Copied");
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)]"
                        title="Copy"
                        aria-label="Copy"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--yinn-border)] p-3">
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">OTP</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-lg font-extrabold break-all">{activeOrder.otp_code || "-"}</div>
                      <button
                        onClick={() => {
                          copyText(activeOrder.otp_code);
                          toast.success("Copied");
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--yinn-border)]"
                        title="Copy"
                        aria-label="Copy"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
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
          )}
        </SoftCard>

        {/* NOTIFIKASI + FAQ */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SoftCard className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-extrabold">Notifikasi</div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--yinn-border)] p-3">
              <div className="text-xs">
                <div className="font-extrabold">Tidak Aktif</div>
                <div className="mt-0.5 text-[var(--yinn-muted)]">Browser</div>
              </div>

              <div className="flex gap-2">
                <button className="rounded-xl border border-[var(--yinn-border)] px-4 py-2 text-sm font-extrabold">
                  Browser
                </button>
                <button
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                >
                  Aktifkan
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[var(--yinn-border)] p-3">
              <div className="text-sm font-extrabold">Message Notifikasi Real-time</div>
              <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                Disarankan menggunakan notifikasi real-time agar SMS message dapat diterima tepat waktu tanpa delay.
              </div>
            </div>
          </SoftCard>

          <SoftCard className="p-4">
            <div className="text-sm font-extrabold">Pertanyaan Umum</div>
            <div className="mt-3 grid gap-2">
              {FAQ_ITEMS.map((it) => (
                <button
                  key={it.title}
                  className="flex items-center justify-between rounded-xl border border-[var(--yinn-border)] p-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold">{it.title}</div>
                    {it.desc ? (
                      <div className="mt-0.5 text-xs text-[var(--yinn-muted)]">{it.desc}</div>
                    ) : null}
                  </div>
                  <ChevronRight size={18} className="text-[var(--yinn-muted)]" />
                </button>
              ))}
            </div>
          </SoftCard>
        </div>

        {/* ADVANCED: pilihan negara/provider/operator + Buy */}
        <SoftCard className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Detail Pesanan</div>
            <Link href="/dashboard/activity" className="text-sm font-semibold text-[var(--yinn-muted)]">
              activity →
            </Link>
          </div>

          <div className="mt-3 grid gap-3">
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center justify-between rounded-2xl border border-[var(--yinn-border)] px-3 py-3 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={iconForServiceName(pickedService?.service_name)}
                  alt={pickedService?.service_name || "App"}
                  className="h-10 w-10 rounded-2xl border border-[var(--yinn-border)] bg-white object-contain"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--yinn-muted)]">Aplikasi</div>
                  <div className="truncate text-sm font-extrabold">
                    {pickedService?.service_name || "Pilih aplikasi"}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--yinn-muted)]" />
            </button>

            <div>
              <div className="text-xs font-bold text-[var(--yinn-muted)]">Country</div>
              <select
                value={countryId}
                onChange={(e) => {
                  setCountryId(e.target.value);
                  setProviderId("");
                  setOperatorId("");
                  setOperators([]);
                }}
                className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                disabled={loadingCountries || !countries.length}
              >
                {countries.map((c) => (
                  <option key={c.number_id} value={String(c.number_id)}>
                    {c.name} ({c.prefix}) • stock {Number(c.stock_total || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-bold text-[var(--yinn-muted)]">Provider</div>
                <select
                  value={providerId}
                  onChange={(e) => {
                    setProviderId(e.target.value);
                    setOperatorId("");
                    setOperators([]);
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                  disabled={!pickedCountry}
                >
                  {(pickedCountry?.pricelist || []).map((p) => (
                    <option key={p.provider_id} value={String(p.provider_id)}>
                      Rp {Number(p.price || 0).toLocaleString("id-ID")} • stock {Number(p.stock || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-bold text-[var(--yinn-muted)]">Operator</div>
                <select
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                  disabled={loadingOperators || !operators.length}
                >
                  {operators.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={createOrder}
              disabled={ordering || !online}
              className="w-full rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
            >
              {ordering ? "Memproses..." : online ? "Buy Number" : "Offline"}
            </button>

            <div className="text-[11px] text-[var(--yinn-muted)]">
              * Status & OTP akan update otomatis (polling).
            </div>
          </div>
        </SoftCard>
      </main>

      <BottomNav />

      {/* SHEET: PILIH APLIKASI */}
      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setAppQuery("");
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold">Beli Nomor Virtual</div>
            <div className="mt-1 text-xs text-[var(--yinn-muted)]">Pilih sebuah aplikasi dan negaranya</div>
          </div>
          <button
            onClick={() => {
              setSheetOpen(false);
              setAppQuery("");
            }}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--yinn-border)]"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] px-3 py-3">
          <Search size={18} className="text-[var(--yinn-muted)]" />
          <input
            value={appQuery}
            onChange={(e) => setAppQuery(e.target.value)}
            placeholder="Cari nama aplikasi..."
            className="w-full bg-transparent text-sm outline-none"
          />
          {loadingServices ? <Loader2 size={18} className="animate-spin text-[var(--yinn-muted)]" /> : null}
        </div>

        {/* POPULAR */}
        <div className="mt-4">
          <div className="text-xs font-extrabold text-[var(--yinn-muted)]">Aplikasi Populer</div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {(popularServices.length ? popularServices : services.slice(0, 6)).map((s) => (
              <button
                key={s.service_code}
                onClick={() => {
                  setServiceId(String(s.service_code));
                  setSheetOpen(false);
                  setAppQuery("");
                  toast.success(`Pilih ${s.service_name}`);
                }}
                className="rounded-2xl border border-[var(--yinn-border)] p-3 text-center"
              >
                <img
                  src={iconForServiceName(s.service_name)}
                  alt={s.service_name}
                  className="mx-auto h-12 w-12 rounded-2xl border border-[var(--yinn-border)] bg-white object-contain"
                  loading="lazy"
                />
                <div className="mt-2 truncate text-xs font-extrabold">{s.service_name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ALL */}
        <div className="mt-5">
          <div className="text-xs font-extrabold text-[var(--yinn-muted)]">Semua Aplikasi</div>

          <div className="mt-2 max-h-[42vh] overflow-auto rounded-2xl border border-[var(--yinn-border)]">
            {allServicesFiltered.length ? (
              allServicesFiltered.map((s) => (
                <button
                  key={s.service_code}
                  onClick={() => {
                    setServiceId(String(s.service_code));
                    setSheetOpen(false);
                    setAppQuery("");
                    toast.success(`Pilih ${s.service_name}`);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-[var(--yinn-border)] px-3 py-3 text-left last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={iconForServiceName(s.service_name)}
                      alt={s.service_name}
                      className="h-10 w-10 rounded-2xl border border-[var(--yinn-border)] bg-white object-contain"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold">{s.service_name}</div>
                      <div className="truncate text-[11px] text-[var(--yinn-muted)]">Tap untuk pilih</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[var(--yinn-muted)]" />
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-[var(--yinn-muted)]">
                Tidak ada hasil.
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}