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
  Telegram,
} from "lucide-react";
import ThemeMenu from "./components/ThemeMenu";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-2xl grid place-items-center text-white shadow-[var(--yinn-soft)]"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
        }}
      >
        <Sparkles size={18} />
      </div>
      <div className="leading-tight">
        <div className="font-extrabold text-[var(--yinn-text)] tracking-tight">YinnOTP</div>
        <div className="text-xs text-[var(--yinn-muted)] -mt-0.5">Virtual Number & OTP API</div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white " +
        "shadow-[var(--yinn-soft)] transition active:scale-[.99] " +
        className
      }
      style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold " +
        "border border-[var(--yinn-border)] bg-[var(--yinn-surface)] text-[var(--yinn-text)] " +
        "shadow-[var(--yinn-soft)] transition active:scale-[.99] " +
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
    <div className="text-center">
      {badge ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-3 py-1 text-xs font-semibold text-[var(--yinn-muted)] shadow-[var(--yinn-soft)]">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--yinn-brand-to)" }} />
          {badge}
        </div>
      ) : null}
      <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--yinn-text)]">
        {title}
      </h2>
      {desc ? (
        <p className="mt-2 text-sm sm:text-base text-[var(--yinn-muted)] max-w-2xl mx-auto">{desc}</p>
      ) : null}
    </div>
  );
}

function FAQItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="font-semibold text-[var(--yinn-text)]">{q}</div>
        <div className="text-[var(--yinn-muted)]">{open ? "—" : "+"}</div>
      </button>
      {open ? (
        <div className="px-4 pb-4 text-sm text-[var(--yinn-muted)] leading-relaxed">{a}</div>
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
      { name: "VreXenAi", role: "Owner", text: "Murah, cepat, dan UI-nya enak dipakai. OTP masuk cepet." },
      { name: "Sigma", role: "User", text: "API stabil. Semoga endpoint makin banyak biar makin lengkap." },
      { name: "Lynne Bot", role: "Developer", text: "Deliver rate mantap, nomor fresh. Cocok buat automation." },
      { name: "Rafk", role: "User", text: "Stock kadang cepet habis, tapi overall worth it." },
      { name: "DikzzModz", role: "Reseller", text: "Kualitas oke. Kalau ada promo paket bakal makin gacor." },
    ],
    []
  );

  const logoList = useMemo(() => ["DANA", "ShopeePay", "OVO", "GoPay", "LinkAja", "PayPal"], []);

  const reviewsRef = useRef(null);
  const scrollReviews = (dir) => {
    const el = reviewsRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.9) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
      {/* Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur bg-[var(--yinn-bg)]/80 border-b border-[var(--yinn-border)]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-3">
            <Link href="/" className="no-underline">
              <Brand />
            </Link>

            <div className="flex items-center gap-2">
              <ThemeMenu />
              <Link href="/login" className="hidden sm:block">
                <PrimaryButton className="px-4 py-2">
                  Login/Register <ArrowRight size={16} />
                </PrimaryButton>
              </Link>
              <Link href="/login" className="sm:hidden">
                <PrimaryButton className="px-3 py-2">
                  <ArrowRight size={16} />
                </PrimaryButton>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--yinn-brand-to) 0, transparent 40%), radial-gradient(circle at 80% 10%, var(--yinn-brand-from) 0, transparent 35%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 pt-10 pb-14 sm:pt-16 sm:pb-20 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-3 py-1 text-xs font-semibold text-[var(--yinn-muted)] shadow-[var(--yinn-soft)]">
                <Bolt size={14} />
                Fast receive • nomor fresh • API ready
              </div>

              <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight">
                Virtual Number <br className="hidden sm:block" />
                Murah & Berkualitas
              </h1>
              <p className="mt-3 text-[var(--yinn-muted)] text-sm sm:text-base max-w-xl">
                YinnOTP menyediakan nomor virtual untuk ribuan aplikasi + REST API untuk integrasi OTP.
                Fokus ke speed, stability, dan deliver rate.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link href="/login">
                  <PrimaryButton>
                    Login/Register <ArrowRight size={18} />
                  </PrimaryButton>
                </Link>
                <a href="#features">
                  <OutlineButton>
                    Lihat Fitur <Sparkles size={18} />
                  </OutlineButton>
                </a>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { k: "85+", v: "Negara" },
                  { k: "1700+", v: "Aplikasi" },
                  { k: "99%", v: "Deliver" },
                ].map((x) => (
                  <div
                    key={x.v}
                    className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3 text-center shadow-[var(--yinn-soft)]"
                  >
                    <div className="text-lg font-extrabold">{x.k}</div>
                    <div className="text-xs text-[var(--yinn-muted)]">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock “dashboard image” (biar mirip template hero-dashboard) */}
            <div className="relative">
              <div
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden"
              >
                <div
                  className="h-12 px-4 flex items-center justify-between border-b border-[var(--yinn-border)]"
                  style={{ background: "rgba(59,130,246,.06)" }}
                >
                  <div className="font-semibold">YinnOTP Dashboard</div>
                  <div className="text-xs text-[var(--yinn-muted)]">Preview</div>
                </div>

                <div className="p-4 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--yinn-border)] p-4 yinn-float-down">
                      <div className="text-xs text-[var(--yinn-muted)]">Saldo</div>
                      <div className="text-xl font-extrabold">Rp 0</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--yinn-border)] p-4 yinn-float-up">
                      <div className="text-xs text-[var(--yinn-muted)]">Status</div>
                      <div className="text-xl font-extrabold text-emerald-500">Online</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
                    <div className="text-xs text-[var(--yinn-muted)]">Order</div>
                    <div className="mt-2 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full w-[62%]"
                        style={{ backgroundImage: "linear-gradient(90deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[var(--yinn-muted)]">Ready untuk alur countries → operators → orders</div>
                  </div>
                </div>
              </div>

              <div
                className="absolute -bottom-6 -left-6 hidden sm:block w-28 h-28 rounded-3xl opacity-40"
                style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-to), transparent)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <SectionTitle
            badge="Fitur Unggulan"
            title="YinnOTP Fitur Utama"
            desc="Informasi lengkap mengenai layanan yang kami sediakan untuk kebutuhan Anda."
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Smartphone, title: "1700+ Layanan Aplikasi", desc: "Support ribuan aplikasi dengan flow yang rapi." },
              { icon: Sparkles, title: "Pembaruan Berkala", desc: "Fitur & sistem terus ditingkatkan secara rutin." },
              { icon: Bolt, title: "Fast Receive", desc: "Penerimaan SMS instan, minim delay." },
              { icon: ShieldCheck, title: "Terpercaya", desc: "Komitmen jaga kualitas layanan & kepercayaan user." },
              { icon: Headset, title: "Dukungan Prima", desc: "Support responsif untuk bantu kendala user." },
              { icon: BadgeCheck, title: "Dokumentasi & API", desc: "Siap untuk integrasi automation & developer." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5 shadow-[var(--yinn-soft)]"
              >
                <div
                  className="h-12 w-12 rounded-2xl grid place-items-center text-white"
                  style={{
                    backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 font-extrabold text-[var(--yinn-text)]">{title}</h3>
                <p className="mt-2 text-sm text-[var(--yinn-muted)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews + Logos */}
      <section className="py-14 sm:py-20 border-t border-[var(--yinn-border)]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-[320px,1fr] gap-6 items-start">
            <div>
              <SectionTitle badge="Real Customers Reviews" title="Apa kata mereka?" desc="Rating pengguna yang mencoba layanan kami." />
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => scrollReviews(-1)}
                  className="h-11 w-11 rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] grid place-items-center"
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => scrollReviews(1)}
                  className="h-11 w-11 rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] grid place-items-center"
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div
              ref={reviewsRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
            >
              {reviews.map((r) => (
                <div
                  key={r.name}
                  className="min-w-[280px] sm:min-w-[340px] snap-start rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5 shadow-[var(--yinn-soft)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold">{r.name}</div>
                    <div className="text-xs text-[var(--yinn-muted)]">{r.role}</div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--yinn-muted)] leading-relaxed">{r.text}</p>
                  <div className="mt-4 text-sm">★★★★★</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {logoList.map((x) => (
                <div
                  key={x}
                  className="px-4 py-2 rounded-2xl border border-[var(--yinn-border)] text-sm font-semibold text-[var(--yinn-muted)]"
                >
                  {x}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <SectionTitle
            badge="Langkah Demi Langkah"
            title="Cara Kerjanya"
            desc="4 langkah mudah mendapatkan nomor virtual secara instan."
          />

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: 1, t: "Pilih Negara", d: "Pilih dari banyak negara yang tersedia." },
              { n: 2, t: "Pilih Aplikasi", d: "Pilih aplikasi layanan OTP yang didukung." },
              { n: 3, t: "Daftarkan Nomor", d: "Masukkan nomor dan minta OTP dari aplikasi." },
              { n: 4, t: "Terima SMS", d: "Kode masuk cepat, biasanya dalam hitungan detik." },
            ].map((x) => (
              <div
                key={x.n}
                className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-5 text-center"
              >
                <div className="mx-auto h-14 w-14 rounded-full grid place-items-center text-white font-extrabold"
                     style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}>
                  {x.n}
                </div>
                <h3 className="mt-4 font-extrabold">{x.t}</h3>
                <p className="mt-2 text-sm text-[var(--yinn-muted)]">{x.d}</p>

                {/* Placeholder gambar step (kalau nanti mau tambahin image di /public) */}
                <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4 text-xs text-[var(--yinn-muted)]">
                  (Preview step {x.n})
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 sm:py-20 border-t border-[var(--yinn-border)]">
        <div className="max-w-6xl mx-auto px-4">
          <SectionTitle badge="FAQ" title="Frequently asked questions" desc="Beberapa pertanyaan yang sering ditanyakan." />

          <div className="mt-10 grid lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-2xl grid place-items-center text-white"
                  style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <div className="font-extrabold">Support & Info</div>
                  <div className="text-sm text-[var(--yinn-muted)]">Jawaban ringkas biar gak ribet.</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-[var(--yinn-muted)] leading-relaxed">
                Kalau ada kendala (saldo, OTP, order), langsung hubungi admin/support. Nanti kita rapihin juga halaman
                contact biar nyambung ke channel lo.
              </div>
            </div>

            <div className="grid gap-3">
              <FAQItem
                q="Asli gak bang OTP nya?"
                a="Asli. Setelah order, sistem otomatis proses dan OTP akan muncul jika SMS masuk."
              />
              <FAQItem
                q="Kalo top up gimana? takut saldo gak bisa dipake"
                a="Aman. Kalau ada kendala, tinggal kontak support dan sertakan bukti pembayaran."
              />
              <FAQItem
                q="Saldo gak masuk padahal udah bayar, gimana?"
                a="Chat support + kirim bukti. Kalau valid, saldo akan di-approve."
                defaultOpen
              />
              <FAQItem
                q="OTP gak masuk, saldo kepotong gak?"
                a="Ada opsi cancel sebelum waktu habis. Kalau dibatalkan sesuai aturan, saldo balik sesuai harga."
              />
              <FAQItem
                q="Scam gak bang?"
                a="Fokusnya layanan real & transparan. Kalau ada bug/masalah, lapor biar langsung dibenerin."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="rounded-[28px] border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] overflow-hidden"
          >
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-7 sm:p-10">
                <div className="text-sm font-semibold text-[var(--yinn-muted)]">Get Started</div>
                <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold">
                  Siap dapat layanan?
                </h3>
                <p className="mt-2 text-sm sm:text-base text-[var(--yinn-muted)]">
                  Login/Register dulu, lalu mulai order nomor virtual dan pantau OTP dari dashboard.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link href="/login">
                    <PrimaryButton>
                      Login/Register <ArrowRight size={18} />
                    </PrimaryButton>
                  </Link>
                  <Link href="/dashboard">
                    <OutlineButton>
                      Ke Dashboard <ArrowRight size={18} />
                    </OutlineButton>
                  </Link>
                </div>
              </div>

              <div className="p-7 sm:p-10 relative">
                <div
                  className="absolute inset-0 opacity-[0.18]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, var(--yinn-brand-to) 0, transparent 45%), radial-gradient(circle at 80% 60%, var(--yinn-brand-from) 0, transparent 45%)",
                  }}
                />
                <div className="relative rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] p-6">
                  <div className="font-extrabold">Kenapa YinnOTP?</div>
                  <ul className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                    <li className="flex gap-2"><span>•</span> UI rapi & ringan</li>
                    <li className="flex gap-2"><span>•</span> Flow order jelas</li>
                    <li className="flex gap-2"><span>•</span> Siap untuk API integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-14 sm:py-20 border-t border-[var(--yinn-border)]">
        <div className="max-w-6xl mx-auto px-4">
          <SectionTitle badge="Contact Us" title="Let’s work together" desc="Punya pertanyaan atau aduan? Hubungi kami." />

          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6">
              <div className="font-extrabold text-lg">Kontak</div>
              <p className="mt-2 text-sm text-[var(--yinn-muted)]">
                Isi contact form atau langsung chat ke channel support.
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-[var(--yinn-border)] p-4 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center text-white"
                    style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Email</div>
                    <div className="text-sm text-[var(--yinn-muted)]">support@yinnotp.com</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--yinn-border)] p-4 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center text-white"
                    style={{ backgroundImage: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    <Telegram size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Telegram</div>
                    <div className="text-sm text-[var(--yinn-muted)]">@yinnotp</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-xs text-[var(--yinn-muted)]">
                * Nanti tinggal lo ganti username/email sesuai real channel YINN STORE.
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] shadow-[var(--yinn-soft)] p-6">
              <div className="font-extrabold text-lg">Kirim pesan</div>
              <p className="mt-2 text-sm text-[var(--yinn-muted)]">
                Form ini buat tampilan dulu. Nanti kita sambungin ke backend lo kalau mau.
              </p>

              <form className="mt-6 grid gap-3" onSubmit={(e) => e.preventDefault()}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] px-4 py-3 text-sm outline-none"
                    placeholder="Full Name"
                  />
                  <input
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] px-4 py-3 text-sm outline-none"
                    placeholder="Email"
                  />
                </div>
                <textarea
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-bg)] px-4 py-3 text-sm outline-none min-h-[140px]"
                  placeholder="Message"
                />
                <PrimaryButton type="submit" className="py-3">
                  Send inquiry <ArrowRight size={18} />
                </PrimaryButton>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--yinn-border)]">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <Brand />
              <p className="mt-3 text-sm text-[var(--yinn-muted)] leading-relaxed max-w-md">
                YinnOTP menyediakan nomor virtual murah dan berkualitas untuk ribuan aplikasi dari berbagai negara.
                Tersedia juga REST API untuk kebutuhan integrasi verifikasi.
              </p>
            </div>

            <div>
              <div className="font-extrabold">Company</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                <Link href="/terms" className="hover:underline">Terms & Conditions</Link>
              </div>
            </div>

            <div>
              <div className="font-extrabold">Docs</div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--yinn-muted)]">
                <Link href="/register" className="hover:underline">Get Started</Link>
                <Link href="/order" className="hover:underline">Order (dev)</Link>
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

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--yinn-muted)]">
            <span>© {new Date().getFullYear()} • YinnOTP</span>
            <span>Build with Next.js</span>
          </div>
        </div>
      </footer>
    </main>
  );
}