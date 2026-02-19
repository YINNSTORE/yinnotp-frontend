"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import ThemeMenu from "../components/ThemeMenu";
import BottomNav from "../components/BottomNav";
import { ArrowLeft, Copy, RefreshCw, SignalHigh, SignalLow, X, Check, RotateCcw } from "lucide-react";
import {
  ping,
  roBalance,
  roCountries,
  roOperators,
  roOrder,
  roServices,
  roStatusGet,
  roStatusSet,
} from "../_lib/rumahotpClient";
import { activityAdd } from "../_lib/activityStore";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

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

export default function OrderPage() {
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  const [roBal, setRoBal] = useState(0);
  const [loadingBal, setLoadingBal] = useState(false);

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

  const pickedCountry = useMemo(() => {
    const c = countries.find((x) => String(x?.number_id) === String(countryId));
    return c || null;
  }, [countries, countryId]);

  const pickedProvider = useMemo(() => {
    const p = (pickedCountry?.pricelist || []).find((x) => String(x?.provider_id) === String(providerId));
    return p || null;
  }, [pickedCountry, providerId]);

  const pickedService = useMemo(() => {
    const s = services.find((x) => String(x?.service_code) === String(serviceId));
    return s || null;
  }, [services, serviceId]);

  const displayPrice = useMemo(() => {
    const p = pickedProvider?.price;
    return Number.isFinite(Number(p)) ? Number(p) : 0;
  }, [pickedProvider]);

  async function refreshPing() {
    setChecking(true);
    try {
      const r = await ping();
      setOnline(!!(r?.json?.ok));
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }

  async function refreshBalance(showToast = false) {
    setLoadingBal(true);
    try {
      const r = await roBalance();
      if (!r.ok || !r.json?.success) {
        if (showToast) toast.error("Gagal ambil balance RumahOTP");
        return;
      }
      const b = Number(r.json?.data?.balance || 0) || 0;
      setRoBal(b);
      if (showToast) toast.success("Balance updated");
    } catch {
      if (showToast) toast.error("Server error");
    } finally {
      setLoadingBal(false);
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
      setServices(Array.isArray(r.json?.data) ? r.json.data : []);
      if (!serviceId && Array.isArray(r.json?.data) && r.json.data.length) {
        setServiceId(String(r.json.data[0].service_code));
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
      setCountryId(list?.[0]?.number_id ? String(list[0].number_id) : "");
      const firstProvider = list?.[0]?.pricelist?.[0]?.provider_id ? String(list[0].pricelist[0].provider_id) : "";
      setProviderId(firstProvider);
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

      setActiveOrder((o) => {
        if (!o) return o;
        const next = { ...o, status: data.status, otp_code: data.otp_code };
        return next;
      });

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
      refreshBalance(false);
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
    refreshBalance(false);
    loadServices();

    const t = setInterval(() => refreshPing(), 8000);
    return () => {
      clearInterval(t);
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    loadCountries(serviceId);
  }, [serviceId]);

  useEffect(() => {
    if (!pickedCountry?.name || !providerId) return;
    loadOperators(pickedCountry.name, providerId);
  }, [pickedCountry?.name, providerId]);

  useEffect(() => {
    if (!pickedCountry) return;
    const firstProvider = pickedCountry?.pricelist?.[0]?.provider_id ? String(pickedCountry.pricelist[0].provider_id) : "";
    if (!providerId && firstProvider) setProviderId(firstProvider);
  }, [pickedCountry]);

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
              {checking ? "checking..." : online ? "online" : "offline"}
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
              style={{ boxShadow: "var(--yinn-soft)" }}
            >
              {online ? <SignalHigh size={16} /> : <SignalLow size={16} />}
              <span>{formatIDR(roBal)}</span>
              <button
                onClick={() => refreshBalance(true)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--yinn-border)]"
                aria-label="refresh balance"
                title="Refresh"
              >
                <RefreshCw size={14} className={loadingBal ? "animate-spin" : ""} />
              </button>
            </div>

            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <section
          className="rounded-2xl border p-4"
          style={{
            background: "var(--yinn-surface)",
            borderColor: "var(--yinn-border)",
            boxShadow: "var(--yinn-soft)",
          }}
        >
          <div className="text-sm font-extrabold">Buat Order</div>

          <div className="mt-3 grid gap-3">
            <div>
              <div className="text-xs font-bold text-[var(--yinn-muted)]">Service</div>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--yinn-border)] bg-transparent px-3 py-3 text-sm outline-none"
                disabled={loadingServices}
              >
                {services.map((s) => (
                  <option key={s.service_code} value={String(s.service_code)}>
                    {s.service_name}
                  </option>
                ))}
              </select>
            </div>

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
                disabled={loadingCountries}
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

            <div className="flex items-center justify-between rounded-xl border border-[var(--yinn-border)] px-3 py-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">Ringkasan</div>
                <div className="mt-1 text-sm font-extrabold truncate">
                  {(pickedService?.service_name || "—") + " • " + (pickedCountry?.name || "—")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">Harga</div>
                <div className="mt-1 text-sm font-extrabold">{formatIDR(displayPrice)}</div>
              </div>
            </div>

            <button
              onClick={createOrder}
              disabled={ordering}
              className="w-full rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
            >
              {ordering ? "Memproses..." : "Buy Number"}
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
            <div className="text-sm font-extrabold">Live Status</div>
            <Link href="/dashboard/activity" className="text-sm font-semibold text-[var(--yinn-muted)]">
              activity →
            </Link>
          </div>

          {activeOrder ? (
            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="text-xs font-bold text-[var(--yinn-muted)]">ORDER ID</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold break-all">{activeOrder.order_id}</div>
                  <button
                    onClick={() => {
                      copyText(activeOrder.order_id);
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

              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
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

              <div className="rounded-2xl border border-[var(--yinn-border)] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--yinn-muted)]">STATUS</div>
                    <div className="mt-1 text-sm font-extrabold">{statusLabel(activeOrder.status)}</div>
                  </div>
                  <button
                    onClick={() => activeOrder?.order_id && startPolling(activeOrder.order_id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2 text-sm font-extrabold"
                    title="Refresh"
                    aria-label="Refresh"
                  >
                    <RefreshCw size={16} className={polling ? "animate-spin" : ""} />
                    Sync
                  </button>
                </div>

                <div className="mt-3">
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

              <div className="grid grid-cols-3 gap-2">
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
          ) : (
            <div className="mt-3 rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
              Belum ada order aktif.
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}