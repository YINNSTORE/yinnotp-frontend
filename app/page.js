"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headset,
  Mail,
  ShieldCheck,
  Smartphone,
  Send,
} from "lucide-react";

const BRAND_MARK = "☄𔓎";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-2xl shadow-[var(--yinn-soft)] grid place-items-center"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
        }}
      >
        <span
          className="inline-block text-lg font-black yinn-float-up select-none"
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Egyptian Hieroglyphs", sans-serif',
          }}
          aria-label="YinnOTP"
        >
          {BRAND_MARK}
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-extrabold text-[var(--yinn-text)] tracking-tight">
          YinnOTP
        </div>
        <div className="text-xs text-[var(--yinn-muted)] -mt-0.5">
          Virtual Number & OTP API
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition " +
        "text-white shadow-[var(--yinn-soft)] hover:opacity-95 active:opacity-90 " +
        className
      }
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
      }}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition " +
        "border border-[var(--yinn-border)] bg-[var(--yinn-surface)] " +
        "text-[var(--yinn-text)] hover:bg-[var(--yinn-bg)] " +
        className
      }
    >
      {children}
    </button>
  );
}

function SectionTitle({ badge, title, subtitle }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-[var(--yinn-border)] bg-[var(--yinn-surface)] text-[var(--yinn-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--yinn-brand-from)]" />
        {badge}
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--yinn-text)]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-[var(--yinn-muted)] max-w-2xl mx-auto">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6">
      <div
        className="h-12 w-12 rounded-2xl grid place-items-center"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
        }}
      >
        <Icon size={20} className="text-white" />
      </div>
      <div className="mt-4 font-bold text-[var(--yinn-text)]">{title}</div>
      <p className="mt-2 text-sm text-[var(--yinn-muted)] leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

function FAQItem({ q, a, open, onToggle }) {
  return (
    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-[var(--yinn-text)]">{q}</span>
        <span className="text-[var(--yinn-muted)]">{open ? "–" : "+"}</span>
      </button>
      {open ? (
        <div className="px-4 pb-4 text-sm text-[var(--yinn-muted)] leading-relaxed">
          {a}
        </div>
      ) : null}
    </div>
  );
}

function ReviewsCarousel() {
  const reviews = useMemo(
    () => [
      {
        name: "VreXenAi",
        role: "Owner",
        text: "murah kaya harga diri mantan",
      },
      {
        name: "Sigma",
        role: "User",
        text: "Api nya bagus, saran si endpoint ai tmbahin biar bnyk",
      },
      {
        name: "Lynne Bot",
        role: "Owner Bot",
        text: "Nokosnya murah minusnyaa gkk ada nokwa germany",
      },
      {
        name: "Rafk",
        role: "Customer",
        text: "Cepet hbis stockny perbnyk lgi bg masa dikit\" stock telah hbis.",
      },
    ],
    []
  );

  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((v) => (v - 1 + reviews.length) % reviews.length);
  const next = () => setIdx((v) => (v + 1) % reviews.length);

  useEffect(() => {
    const t = setInterval(next, 5500);
    return () => clearInterval(t);
  }, [reviews.length]);

  const r = reviews[idx];

  return (
    <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-extrabold text-[var(--yinn-text)]">
            Real Customers Reviews
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Apa kata mereka?
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prev}
            className="h-10 w-10 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] grid place-items-center hover:bg-[var(--yinn-surface)] transition"
            aria-label="Previous review"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="h-10 w-10 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] grid place-items-center hover:bg-[var(--yinn-surface)] transition"
            aria-label="Next review"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-[var(--yinn-text)] leading-relaxed">{r.text}</div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-[var(--yinn-text)]">{r.name}</div>
            <div className="text-sm text-[var(--yinn-muted)]">{r.role}</div>
          </div>
          <div className="flex items-center gap-1 text-amber-400">
            {"★★★★★".split("").map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [faqOpen, setFaqOpen] = useState(2);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[var(--yinn-border)] bg-[color:var(--yinn-bg)/0.85] backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <OutlineButton className="hidden sm:inline-flex">
                Login/Register <ArrowRight size={16} className="inline ml-1" />
              </OutlineButton>
            </Link>
            <Link href="/login">
              <PrimaryButton>
                <span className="sm:hidden">Masuk</span>
                <span className="hidden sm:inline">Masuk</span>
              </PrimaryButton>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-status" />
                Fast receive • nomor fresh • API ready
              </div>

              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight">
                Virtual Number <br className="hidden sm:block" />
                <span
                  className="text-transparent bg-clip-text"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Murah & Berkualitas
                </span>
              </h1>

              <p className="mt-4 text-[var(--yinn-muted)] leading-relaxed text-lg">
                Nomor virtual premium berbagai negara + REST API untuk verifikasi OTP
                aplikasi. Cocok buat developer, reseller, dan kebutuhan automation.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login">
                  <PrimaryButton>
                    Login/Register <ArrowRight size={16} className="inline ml-1" />
                  </PrimaryButton>
                </Link>
                <a href="#features">
                  <OutlineButton>
                    Lihat fitur <BadgeCheck size={16} className="inline ml-1" />
                  </OutlineButton>
                </a>
              </div>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { k: "85+", v: "Negara" },
                  { k: "1700+", v: "Aplikasi" },
                  { k: "99%", v: "Deliver rate" },
                  { k: "24/7", v: "Support" },
                ].map((x) => (
                  <div
                    key={x.v}
                    className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-4"
                  >
                    <div className="text-xl font-extrabold">{x.k}</div>
                    <div className="text-sm text-[var(--yinn-muted)]">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right visual */}
            <div className="relative">
              <div
                className="absolute -top-10 -left-10 h-44 w-44 rounded-full blur-3xl opacity-25"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              />
              <div className="relative rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden">
                {/* FLOATING LOGO ANIMATION */}
                <div
                  className="pointer-events-none absolute -top-10 -right-10 opacity-10 yinn-float-up select-none"
                  style={{
                    fontFamily:
                      'ui-sans-serif, system-ui, "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Egyptian Hieroglyphs", sans-serif',
                    fontSize: "110px",
                    lineHeight: "1",
                    color: "var(--yinn-text)",
                  }}
                  aria-hidden="true"
                >
                  {BRAND_MARK}
                </div>

                <div className="p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold">Dashboard Preview</div>
                    <div className="text-sm text-[var(--yinn-muted)] flex items-center gap-2">
                      <Clock size={16} /> realtime
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-4 yinn-float-down">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Order OTP</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                          Ready
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--yinn-muted)]">
                        Pilih negara & aplikasi, nomor muncul instan.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-4 yinn-float-up">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">REST API</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 font-semibold">
                          v1
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--yinn-muted)]">
                        Integrasi cepat untuk bot & automation.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Saldo & Billing</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 font-semibold">
                          Aman
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--yinn-muted)]">
                        Riwayat transaksi & topup rapi.
                      </div>
                    </div>
                  </div>

                  {/* Docs API BUTTON REMOVED */}
                  <div className="mt-6">
                    <Link href="/dashboard" className="block">
                      <PrimaryButton className="w-full">Get Started</PrimaryButton>
                    </Link>
                  </div>
                </div>
              </div>

              <div
                className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full blur-3xl opacity-25"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="py-14 sm:py-18">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="Fitur Unggulan"
            title="YinnOTP Fitur Utama"
            subtitle="Informasi lengkap mengenai layanan yang kami sediakan untuk kebutuhan Anda."
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Smartphone}
              title="1700+ Layanan Aplikasi"
              desc="Tersedia layanan OTP ribuan aplikasi dengan harga murah dan kualitas terbaik."
            />
            <FeatureCard
              icon={Bolt}
              title="Pembaruan Berkala"
              desc="System dan API terus diperbarui agar makin stabil dan kaya fitur."
            />
            <FeatureCard
              icon={Clock}
              title="Fast Receive"
              desc="Penerimaan SMS instan tanpa delay, cocok buat verifikasi cepat."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Terpercaya"
              desc="Kami menjaga kepercayaan pengguna dengan meningkatkan kualitas layanan."
            />
            <FeatureCard
              icon={Headset}
              title="Dukungan Prima"
              desc="Tim support siap membantu 24/7 untuk memastikan layanan selalu lancar."
            />
            <FeatureCard
              icon={BadgeCheck}
              title="Dokumentasi Lengkap"
              desc="Dokumentasi API jelas + sistem billing/topup yang rapi."
            />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-14 sm:py-18 border-y border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ReviewsCarousel />
        </div>
      </section>

      {/* Step */}
      <section className="py-14 sm:py-18">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="Langkah Demi Langkah"
            title="Cara Kerjanya"
            subtitle="4 langkah mudah mendapatkan Nomor Virtual secara instan!"
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { t: "Pilih Negara", d: "Pilih dari banyak negara yang tersedia di platform." },
              { t: "Pilih Aplikasi", d: "Tersedia ribuan aplikasi yang didukung registrasi." },
              { t: "Daftarkan Nomor", d: "Masukkan nomor virtual dan minta kode OTP." },
              { t: "Terima SMS", d: "Kode verifikasi masuk cepat (biasanya beberapa detik)." },
            ].map((x, i) => (
              <div
                key={x.t}
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center text-white font-extrabold"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    {i + 1}
                  </div>
                  <ArrowRight size={18} className="text-[var(--yinn-muted)]" />
                </div>
                <div className="mt-4 font-bold">{x.t}</div>
                <div className="mt-2 text-sm text-[var(--yinn-muted)]">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 sm:py-18 bg-[var(--yinn-surface)] border-y border-[var(--yinn-border)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="FAQ"
            title="Frequently asked questions"
            subtitle="Beberapa pertanyaan yang sering ditanyakan."
          />

          <div className="mt-10 grid lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-6 shadow-[var(--yinn-soft)]">
              <div className="text-2xl font-extrabold tracking-tight">
                {BRAND_MARK} YinnOTP
              </div>
              <div className="mt-2 text-[var(--yinn-muted)]">
                Kalau ada kendala pembayaran, OTP, atau akun — langsung kontak support ya.
              </div>
              <div className="mt-6 grid gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center text-white"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    <Send size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Telegram</div>
                    <div className="text-sm text-[var(--yinn-muted)]">@yinnotp</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center text-white"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                    }}
                  >
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Email</div>
                    <div className="text-sm text-[var(--yinn-muted)]">
                      support@yinnotp.com
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                {
                  q: "Asli gak bang OTP nya?",
                  a: "Asli. Sistem otomatis, nomor muncul setelah order.",
                },
                {
                  q: "Kalo top up gimana? takut saldo gak bisa dipake",
                  a: "Aman. Kalau ada kendala bisa kontak support dan sertakan bukti.",
                },
                {
                  q: "Saldo gak masuk padahal udah bayar, gimana?",
                  a: "Chat support, sertakan bukti pembayaran/riwayat transfer.",
                },
                {
                  q: "OTP gak masuk, saldo kepotong gak?",
                  a: "Ada opsi cancel sebelum waktu habis. Saldo direfund sesuai ketentuan.",
                },
                {
                  q: "Scam gak bang?",
                  a: "Bukan. Kalau ada bug/kendala website langsung lapor ke owner/support.",
                },
              ].map((x, i) => (
                <FAQItem
                  key={x.q}
                  q={x.q}
                  a={x.a}
                  open={faqOpen === i}
                  onToggle={() => setFaqOpen((v) => (v === i ? -1 : i))}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-18">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-8 sm:p-10 overflow-hidden relative">
            <div
              className="absolute -top-10 -right-10 h-52 w-52 rounded-full blur-3xl opacity-25"
              style={{
                background:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            />
            <div className="grid lg:grid-cols-2 gap-8 items-center relative">
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[var(--yinn-text)]">
                  Siap dapat layanan?
                </h3>
                <p className="mt-2 text-[var(--yinn-muted)]">
                  Terima OTP nokos murah kamu sekarang juga.
                </p>
                <div className="mt-6">
                  <Link href="/dashboard">
                    <PrimaryButton>
                      Get Started <ArrowRight size={16} className="inline ml-1" />
                    </PrimaryButton>
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-6">
                <div className="font-extrabold">{BRAND_MARK} YinnOTP</div>
                <div className="mt-2 text-sm text-[var(--yinn-muted)]">
                  Nomor virtual murah & berkualitas + REST API untuk verifikasi OTP.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--yinn-border)] bg-[var(--yinn-surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-2xl shadow-[var(--yinn-soft)] grid place-items-center"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  <span
                    className="font-black"
                    style={{
                      fontFamily:
                        'ui-sans-serif, system-ui, "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Egyptian Hieroglyphs", sans-serif',
                    }}
                  >
                    {BRAND_MARK}
                  </span>
                </div>
                <div className="font-extrabold">YinnOTP</div>
              </div>
              <p className="mt-4 text-sm text-[var(--yinn-muted)] leading-relaxed">
                Nomor virtual murah dan berkualitas untuk ribuan aplikasi dari seluruh
                negara. Tersedia juga layanan REST API.
              </p>
            </div>

            <div>
              <div className="font-extrabold">Company</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                <Link className="hover:text-[var(--yinn-text)]" href="#">
                  About Us
                </Link>
                <Link className="hover:text-[var(--yinn-text)]" href="#">
                  Privacy Policy
                </Link>
                <Link className="hover:text-[var(--yinn-text)]" href="#">
                  Terms & Conditions
                </Link>
              </div>
            </div>

            <div>
              <div className="font-extrabold">Docs</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                <Link className="hover:text-[var(--yinn-text)]" href="/register">
                  Get Started
                </Link>
                <Link className="hover:text-[var(--yinn-text)]" href="/developer/api">
                  Documentation API
                </Link>
                <Link className="hover:text-[var(--yinn-text)]" href="/pricing">
                  Pricing
                </Link>
              </div>
            </div>

            <div>
              <div className="font-extrabold">Contact</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                <span>Telegram: @yinnotp</span>
                <span>Email: support@yinnotp.com</span>
              </div>
            </div>
          </div>
        </div>

        <div className="py-5 text-center text-sm text-[var(--yinn-muted)] border-t border-[var(--yinn-border)]">
          © {new Date().getFullYear()} • Build on YinnOTP
        </div>
      </footer>
    </div>
  );
}