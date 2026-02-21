// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ThemeMenu from "../components/ThemeMenu";
import BottomNav from "../components/BottomNav";
import { Bell, ChevronRight, Flame, Plus, Search, ShieldCheck, Smartphone, Sparkles } from "lucide-react";

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

function AppLogo({ src, alt, fallback = "✨" }) {
  const [err, setErr] = useState(false);

  return (
    <div
      className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[var(--yinn-border)] overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(99,102,241,.10), rgba(168,85,247,.10))" }}
    >
      {src && !err ? (
        <img src={src} alt={alt} className="h-9 w-9 object-contain" loading="lazy" onError={() => setErr(true)} />
      ) : (
        <span className="text-2xl">{fallback}</span>
      )}
    </div>
  );
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

function useCountUp(target, { durationMs = 550 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const fromRef = useRef(0);
  const toRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const nextTarget = Number.isFinite(target) ? target : 0;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const from = value;
    fromRef.current = from;
    toRef.current = nextTarget;
    startRef.current = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(fromRef.current + (toRef.current - fromRef.current) * eased);
      setValue(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

export default function DashboardPage() {
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState("Populer");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState({ name: "User" });

  const [serverBalance, setServerBalance] = useState(0);
  const displayBalance = useCountUp(serverBalance, { durationMs: 550 });

  const banners = useMemo(
    () => [
      { title: "JOIN CHANNEL YinnOTP", subtitle: "Info stock, update sistem, & diskon harian.", badge: "Update", cta: { label: "Gabung", href: "https://t.me/" } },
      { title: "DELIVER RATE 99%", subtitle: "Nomor fresh • cepat masuk • auto cancel", badge: "Quality", cta: { label: "Order OTP", href: "/order" } },
      { title: "API READY", subtitle: "Integrasi mudah untuk bot & automation.", badge: "Dev", cta: { label: "Mulai", href: "/order" } },
    ],
    []
  );

  const chips = useMemo(() => ["Populer", "WhatsApp", "Telegram", "TikTok", "Google", "Lainnya"], []);

  const apps = useMemo(
    () => [
      { name: "WhatsApp", tag: "WhatsApp", icon: "https://assets.rumahotp.com/apps/wa.png", emoji: "💬" },
      { name: "Telegram", tag: "Telegram", icon: "https://assets.rumahotp.com/apps/tg.png", emoji: "✈️" },
      { name: "TikTok", tag: "TikTok", icon: "https://assets.rumahotp.com/apps/lf.png", emoji: "🎵" },
      { name: "Instagram", tag: "Lainnya", icon: "https://assets.rumahotp.com/apps/ig.png", emoji: "📸" },
      { name: "Facebook", tag: "Lainnya", icon: "https://assets.rumahotp.com/apps/fb.png", emoji: "👥" },
      { name: "Google", tag: "Google", icon: "https://assets.rumahotp.com/apps/go.png", emoji: "🔎" },
      { name: "Gmail", tag: "Google", icon: "https://assets.rumahotp.com/apps/go.png", emoji: "📧" },
      { name: "Shopee", tag: "Lainnya", icon: "https://assets.rumahotp.com/apps/ka.png", emoji: "🛍️" },
    ],
    []
  );

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q) {
      const list = apps.filter((a) => a.name.toLowerCase().includes(q));
      return showAll ? list : list.slice(0, 8);
    }

    const list =
      filter === "Populer"
        ? apps.slice(0, 8)
        : filter === "Lainnya"
        ? apps.filter((a) => a.tag === "Lainnya")
        : apps.filter((a) => a.tag === filter);

    return showAll ? list : list.slice(0, 8);
  }, [apps, filter, showAll, query]);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedName =
      localStorage.getItem("yinnotp_name") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("username") ||
      localStorage.getItem("name") ||
      "User";

    setUser({ name: storedName });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = getTokenFromStorage();
    if (!token) {
      setServerBalance(0);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/deposit/me.php", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const j = await res.json();
        const bal = Number(j?.balance ?? 0);
        setServerBalance(Number.isFinite(bal) ? bal : 0);
      } catch (_) {
        setServerBalance(0);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="yinn-float-up grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))", boxShadow: "var(--yinn-soft)" }}
              aria-hidden="true"
            >
              <span className="text-white text-base leading-none">☄𔓎</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold leading-tight">YinnOTP</div>
              <div className="truncate text-[11px] text-[var(--yinn-muted)]">Virtual Number & OTP API</div>
            </div>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--yinn-border)] px-3 py-2" style={{ boxShadow: "var(--yinn-soft)" }}>
              <span className="text-[11px] text-[var(--yinn-muted)]">Saldo</span>
              <span className="text-sm font-semibold">{formatIDR(displayBalance)}</span>
              <Link
                href="/topup"
                className="grid h-7 w-7 place-items-center rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                aria-label="Top up saldo"
                title="Top up"
              >
                <Plus size={16} />
              </Link>
            </div>

            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]"
              style={{ boxShadow: "var(--yinn-soft)" }}
              aria-label="Notifikasi"
              title="Notifikasi"
            >
              <Bell size={18} />
            </button>

            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-4 pt-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]" style={{ boxShadow: "var(--yinn-soft)" }}>
          <div className="relative h-[140px]">
            {banners.map((b, i) => (
              <div key={b.title} className={["absolute inset-0 transition-opacity duration-500", i === slide ? "opacity-100" : "opacity-0"].join(" ")}>
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      i === 0
                        ? "linear-gradient(135deg, rgba(99,102,241,.22), rgba(168,85,247,.22))"
                        : i === 1
                        ? "linear-gradient(135deg, rgba(34,197,94,.18), rgba(99,102,241,.18))"
                        : "linear-gradient(135deg, rgba(245,158,11,.16), rgba(168,85,247,.16))",
                  }}
                />
                <div className="absolute inset-0 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-3 py-1 text-[11px] text-[var(--yinn-muted)]">
                        <span className="yinn-float-down">☄𔓎</span>
                        <span>{b.badge}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-extrabold leading-tight">{b.title}</h3>
                      <p className="mt-1 text-sm text-[var(--yinn-muted)]">{b.subtitle}</p>
                    </div>

                    <div className="yinn-float-up grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
                      <Sparkles size={20} />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Link
                      href={b.cta.href}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                    >
                      {b.cta.label} <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pb-3 pt-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={["h-2 w-2 rounded-full", i === slide ? "bg-[var(--yinn-text)]" : "bg-[var(--yinn-border)]"].join(" ")}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-4" style={{ boxShadow: "var(--yinn-soft)" }}>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
              <Smartphone size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold leading-tight">Virtual Number</div>
              <div className="text-sm text-[var(--yinn-muted)]">OTP only • nomor fresh • auto cancel</div>
            </div>
            <Link
              href="/order"
              className="ms-auto inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
            >
              BUY
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3">
              <div className="text-xs text-[var(--yinn-muted)]">Negara</div>
              <div className="text-base font-extrabold">85+</div>
            </div>
            <div className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3">
              <div className="text-xs text-[var(--yinn-muted)]">Aplikasi</div>
              <div className="text-base font-extrabold">1700+</div>
            </div>
            <div className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3">
              <div className="text-xs text-[var(--yinn-muted)]">Deliver</div>
              <div className="text-base font-extrabold">99%</div>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-3 py-3" style={{ boxShadow: "var(--yinn-soft)" }}>
            <Search size={18} className="text-[var(--yinn-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--yinn-muted)]"
              placeholder="Cari aplikasi (WhatsApp, Telegram, TikTok...)"
            />
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setFilter(c);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold",
                  c === filter ? "border-transparent text-white" : "border-[var(--yinn-border)] bg-[var(--yinn-surface)]",
                ].join(" ")}
                style={
                  c === filter
                    ? { background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }
                    : undefined
                }
              >
                {c === "Populer" ? (
                  <span className="inline-flex items-center gap-2">
                    <Flame size={16} /> Lagi Populer
                  </span>
                ) : (
                  c
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold">
              {query.trim() ? `Hasil: "${query.trim()}"` : filter === "Populer" ? "🔥 Lagi Populer" : `Kategori: ${filter}`}
            </h2>
            <button onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-[var(--yinn-muted)]">
              {showAll ? "Tampilkan sedikit" : "Tampilkan banyak"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {filteredApps.map((a) => (
              <Link key={a.name} href="/order" className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3" style={{ boxShadow: "var(--yinn-soft)" }}>
                <div className="grid place-items-center">
                  <AppLogo src={a.icon} alt={a.name} fallback={a.emoji} />
                </div>
                <div className="mt-2 line-clamp-1 text-center text-xs font-extrabold">{a.name}</div>
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3" style={{ boxShadow: "var(--yinn-soft)" }}>
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--yinn-border)]">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold">Aman & Transparan</div>
                <div className="text-xs text-[var(--yinn-muted)]">Auto cancel tersedia jika OTP tidak masuk.</div>
              </div>
              <Link href="/order" className="ms-auto text-sm font-bold">
                Lihat <ChevronRight size={16} className="inline" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}