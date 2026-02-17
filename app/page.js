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
  Sparkles,
  Send,
} from "lucide-react";
import ThemeMenu from "./components/ThemeMenu";

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
        <Sparkles size={18} />
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
      className={
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-white shadow-[var(--yinn-soft)] transition hover:opacity-95 " +
        className
      }
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold border border-[var(--yinn-border)] bg-[var(--yinn-surface)] text-[var(--yinn-text)] transition hover:bg-black/5 dark:hover:bg-white/5 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

function SectionTitle({ badge, title, desc }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      {badge ? (
        <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-black/5 dark:bg-white/10 text-[var(--yinn-text)] border border-[var(--yinn-border)]">
          {badge}
        </div>
      ) : null}
      <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--yinn-text)]">
        {title}
      </h2>
      {desc ? (
        <p className="mt-3 text-[var(--yinn-muted)] leading-relaxed">{desc}</p>
      ) : null}
    </div>
  );
}

function FAQItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <span className="font-semibold text-[var(--yinn-text)]">{q}</span>
        <span className="text-[var(--yinn-muted)] font-bold">
          {open ? "—" : "+"}
        </span>
      </button>
      {open ? (
        <div className="px-5 pb-5 text-[var(--yinn-muted)] leading-relaxed">
          {a}
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  // Optional: kalau user sebelumnya pake data-theme dari localStorage lama, tetep aman
  useEffect(() => {
    // kalau belum ada, set default light (ThemeMenu akan handle preferensi juga)
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const reviews = useMemo(
    () => [
      {
        name: "VreXenAi",
        role: "Owner",
        text: "Murah, cepat, dan UI-nya enak dipakai. OTP masuk cepet.",
      },
      {
        name: "Sigma",
        role: "User",
        text: "API stabil. Semoga endpoint makin banyak biar makin lengkap.",
      },
      {
        name: "Lynne Bot",
        role: "Developer",
        text: "Deliver rate mantap, nomor fresh. Cocok buat automation.",
      },
      { name: "Rafk", role: "User", text: "Stock kadang cepet habis, tapi overall worth it." },
      {
        name: "DikzzModz",
        role: "Reseller",
        text: "Kualitas oke. Kalau ada promo paket bakal makin gacor.",
      },
    ],
    []
  );

  const logoList = useMemo(
    () => ["DANA", "ShopeePay", "OVO", "GoPay", "LinkAja", "PayPal"],
    []
  );

  const reviewsRef = useRef(null);
  const scrollReviews = (dir) => {
    const el = reviewsRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.9) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur bg-[var(--yinn-bg)]/80 border-b border-[var(--yinn-border)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeMenu />
            <Link
              href="/register"
              className="hidden sm:inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-semibold text-white shadow-[var(--yinn-soft)]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Login/Register <ArrowRight size={18} />
            </Link>
            <Link
              href="/register"
              className="sm:hidden inline-flex items-center justify-center rounded-2xl px-4 py-2 font-semibold text-white shadow-[var(--yinn-soft)]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
              }}
            >
              Masuk
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-[var(--yinn-surface)] border border-[var(--yinn-border)] shadow-[var(--yinn-soft)] text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-status" />
                Fast receive • nomor fresh • API ready
              </div>

              <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight">
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

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/register">
                  <PrimaryButton className="w-full sm:w-auto">
                    Login/Register <ArrowRight size={18} />
                  </PrimaryButton>
                </Link>
                <a href="#features">
                  <OutlineButton className="w-full sm:w-auto">
                    Lihat fitur <Bolt size={18} />
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
                    className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 shadow-[var(--yinn-soft)]"
                  >
                    <div className="text-xl font-extrabold">{x.k}</div>
                    <div className="text-sm text-[var(--yinn-muted)]">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute -top-8 -left-8 h-40 w-40 rounded-full blur-3xl opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                }}
              />
              <div className="relative rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden">
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

                  <div className="mt-6 flex gap-3">
                    <Link href="/dashboard" className="flex-1">
                      <PrimaryButton className="w-full">Get Started</PrimaryButton>
                    </Link>
                    <Link href="/developer/api" className="flex-1">
                      <OutlineButton className="w-full">
                        Docs API <ArrowRight size={18} />
                      </OutlineButton>
                    </Link>
                  </div>
                </div>
              </div>

              <div
                className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full blur-3xl opacity-30"
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
      <section id="features" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="Fitur Unggulan"
            title="YinnOTP Fitur Utama"
            desc="Informasi lengkap mengenai layanan yang kami sediakan untuk kebutuhan Anda."
          />

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "1700+ Layanan Aplikasi",
                desc: "Tersedia layanan OTP ribuan aplikasi dengan harga murah dan kualitas terbaik.",
                Icon: Smartphone,
              },
              {
                title: "Pembaruan Berkala",
                desc: "Sistem dan API terus diperbarui agar makin stabil dan kaya fitur.",
                Icon: Bolt,
              },
              {
                title: "Fast Receive",
                desc: "Penerimaan SMS instan tanpa delay, cocok buat verifikasi cepat.",
                Icon: Clock,
              },
              {
                title: "Terpercaya",
                desc: "Kualitas nomor dijaga, nomor fresh, opsi cancel tersedia.",
                Icon: BadgeCheck,
              },
              {
                title: "Dukungan Prima",
                desc: "Support siap bantu 24/7 untuk kendala akun, topup, dan penggunaan API.",
                Icon: Headset,
              },
              {
                title: "Dokumentasi Lengkap",
                desc: "Dokumentasi API jelas dan gampang diintegrasikan ke project kamu.",
                Icon: ShieldCheck,
              },
            ].map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-6 shadow-[var(--yinn-soft)]"
              >
                <div
                  className="h-12 w-12 rounded-2xl grid place-items-center text-white"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 font-extrabold text-lg">{title}</h3>
                <p className="mt-2 text-[var(--yinn-muted)] leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-16 sm:py-20 border-t border-[var(--yinn-border)] bg-[var(--yinn-bg)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-black/5 dark:bg-white/10 border border-[var(--yinn-border)]">
                Real Customers Reviews
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Apa kata mereka?
              </h2>
              <p className="mt-2 text-[var(--yinn-muted)]">
                Rating pengguna yang mencoba layanan kami
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => scrollReviews(-1)}
                className="h-11 w-11 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] grid place-items-center hover:bg-black/5 dark:hover:bg-white/5"
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scrollReviews(1)}
                className="h-11 w-11 rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] grid place-items-center hover:bg-black/5 dark:hover:bg-white/5"
                type="button"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div
            ref={reviewsRef}
            className="mt-10 flex gap-4 overflow-x-auto scroll-smooth pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {reviews.map((r) => (
              <div
                key={r.name}
                className="min-w-[280px] sm:min-w-[340px] rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-6 shadow-[var(--yinn-soft)]"
              >
                <p className="text-[var(--yinn-text)] leading-relaxed">“{r.text}”</p>
                <div className="mt-5">
                  <div className="font-extrabold">{r.name}</div>
                  <div className="text-sm text-[var(--yinn-muted)]">{r.role}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {logoList.map((x) => (
              <div
                key={x}
                className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-center text-sm font-semibold text-[var(--yinn-muted)]"
              >
                {x}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="Langkah Demi Langkah"
            title="Cara Kerjanya"
            desc="4 langkah mudah mendapatkan Nomor Virtual secara instan!"
          />

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "1", t: "Pilih Negara", d: "Pilih dari berbagai negara yang tersedia di platform." },
              { n: "2", t: "Pilih Aplikasi", d: "Pilih aplikasi tujuan untuk registrasi/verifikasi." },
              { n: "3", t: "Daftarkan Nomor", d: "Masukkan nomor virtual dan minta kode OTP." },
              { n: "4", t: "Terima SMS", d: "OTP masuk cepat (biasanya dalam hitungan detik)." },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-6 shadow-[var(--yinn-soft)] text-center"
              >
                <div className="mx-auto h-12 w-12 rounded-full grid place-items-center font-extrabold text-white"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  {s.n}
                </div>
                <h3 className="mt-4 font-extrabold">{s.t}</h3>
                <p className="mt-2 text-sm text-[var(--yinn-muted)]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 sm:py-20 border-t border-[var(--yinn-border)] bg-[var(--yinn-bg)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            badge="FAQ"
            title="Frequently asked questions"
            desc="Beberapa pertanyaan yang sering ditanyakan."
          />

          <div className="mt-12 grid lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-6 shadow-[var(--yinn-soft)]">
              <h3 className="font-extrabold text-xl">Butuh bantuan cepat?</h3>
              <p className="mt-2 text-[var(--yinn-muted)]">
                Kalau ada kendala topup, order, atau OTP tidak masuk, langsung hubungi support.
              </p>
              <div className="mt-6 grid gap-3">
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
              </div>
            </div>

            <div className="grid gap-4">
              <FAQItem
                q="Asli gak bang OTP nya?"
                a="Asli. Sistem otomatis, nomor muncul setelah order dan OTP masuk sesuai layanan yang dipilih."
                defaultOpen
              />
              <FAQItem
                q="Kalo top up gimana? takut saldo gak bisa dipake"
                a="Aman. Kalau ada kendala, chat support dan sertakan bukti pembayaran."
              />
              <FAQItem
                q="Saldo gak masuk padahal udah bayar, gimana?"
                a="Hubungi support, kirim bukti pembayaran/riwayat transfer. Nanti dicek dan diselesaikan."
              />
              <FAQItem
                q="OTP gak masuk, saldo kepotong gak?"
                a="Ada opsi cancel sebelum waktu habis. Saldo biasanya direfund sesuai kebijakan layanan."
              />
              <FAQItem
                q="Scam gak bang?"
                a="Insyaallah nggak. Kalau ada bug atau kendala, lapor ke owner/support biar cepat ditangani."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden">
            <div className="p-8 sm:p-12 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <h3 className="text-3xl font-extrabold tracking-tight">
                  Siap dapat layanan?
                </h3>
                <p className="mt-3 text-[var(--yinn-muted)] text-lg">
                  Terima OTP nokos murah kamu sekarang juga.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link href="/dashboard">
                    <PrimaryButton className="w-full sm:w-auto">
                      Get Started <ArrowRight size={18} />
                    </PrimaryButton>
                  </Link>
                  <Link href="/pricing">
                    <OutlineButton className="w-full sm:w-auto">
                      Lihat Pricing
                    </OutlineButton>
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-6">
                <div className="font-extrabold">Kenapa YinnOTP?</div>
                <ul className="mt-4 grid gap-3 text-[var(--yinn-muted)]">
                  <li className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5" size={18} />
                    Nomor fresh & kualitas terjaga
                  </li>
                  <li className="flex items-start gap-2">
                    <Bolt className="mt-0.5" size={18} />
                    OTP cepat masuk, cocok buat verifikasi
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5" size={18} />
                    API ready untuk integrasi bot/automation
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--yinn-border)] bg-[var(--yinn-bg)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Brand />
            <p className="mt-4 text-[var(--yinn-muted)] leading-relaxed">
              Nomor virtual murah dan berkualitas untuk ribuan aplikasi. Tersedia juga
              layanan REST API untuk kebutuhan integrasi verifikasi Anda.
            </p>
          </div>

          <div>
            <div className="font-extrabold">Company</div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
              <Link href="/blog/about-us">About Us</Link>
              <Link href="/blog/privacy-policy">Privacy Policy</Link>
              <Link href="/blog/terms-and-conditions">Terms & Conditions</Link>
            </div>
          </div>

          <div>
            <div className="font-extrabold">Docs</div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
              <Link href="/register">Get Started</Link>
              <Link href="/developer/api">Documentation API</Link>
              <Link href="/pricing">Pricing</Link>
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

        <div className="py-5 text-center text-sm text-[var(--yinn-muted)] border-t border-[var(--yinn-border)]">
          © {new Date().getFullYear()} • Build on YinnOTP
        </div>
      </footer>
    </div>
  );
}