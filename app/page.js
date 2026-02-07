"use client"

import { useEffect, useState } from "react"

export default function Home() {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) setTheme(savedTheme)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  const isDark = theme === "dark"

  return (
    <>
      <nav>
        <div className="logo-area">
          <span className="logo-komet">☄</span>
          <span className="brand-name">YinnOTP</span>
        </div>
        <div className="nav-right">
          <button
            className="theme-toggle"
            id="theme-btn"
            title="Toggle Dark/Light Mode"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle Theme"
          >
            <i className={`fa-regular ${isDark ? "fa-moon" : "fa-sun"}`} id="theme-icon"></i>
          </button>
          <a href="/register" className="btn-login">Login / Register</a>
        </div>
      </nav>

      <header className="hero">
        <span className="section-tag">Premium Virtual Number</span>
        <h1>
          Virtual Number<br /><span>Murah & Berkualitas</span>
        </h1>
        <p>
          Akses nomor virtual instan untuk aktivasi WhatsApp, Telegram, dan aplikasi lainnya dengan sistem otomatis 24 jam.
        </p>
        <button className="btn-cta" onClick={() => (window.location.href = "/register")}>
          Mulai Sekarang
        </button>

        <div className="hero-img">
          <img src="/hero.png" alt="YinnOTP Virtual Service" />
        </div>
      </header>

      <section className="features">
        <span className="section-tag">Kenapa Memilih YinnOTP?</span>
        <h2>Layanan Terbaik Untuk Anda</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="f-icon"><i className="fa-solid fa-layer-group"></i></div>
            <h3>1700+ Layanan</h3>
            <p>Support berbagai aplikasi populer dari seluruh penjuru dunia.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><i className="fa-solid fa-bolt"></i></div>
            <h3>Instan OTP</h3>
            <p>Kode OTP masuk dalam hitungan detik setelah permintaan dikirim.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><i className="fa-solid fa-rotate"></i></div>
            <h3>Auto Update</h3>
            <p>Stok nomor diperbarui secara berkala untuk menjaga kualitas.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon"><i className="fa-solid fa-shield-halved"></i></div>
            <h3>Privasi Aman</h3>
            <p>Data penggunaan Anda terlindungi dengan sistem keamanan tinggi.</p>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-logo">
          <span className="logo-komet">☄</span>
          <h2>YinnOTP</h2>
        </div>
        <div className="copyright">
          &copy; 2026 YinnOTP. Layanan Virtual Number Terpercaya.
        </div>
      </footer>
    </>
  )
}
