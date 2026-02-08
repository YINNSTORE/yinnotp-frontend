"use client"

import { useEffect, useState } from "react"
import "./dashboard.css"

function moneyIDR(n) {
  const num = Number(n || 0)
  return num.toLocaleString("id-ID")
}

export default function DashboardPage() {
  const [user, setUser] = useState({ username: "yinnzzmc", greeting: "Selamat malam 💤" })
  const [balance, setBalance] = useState(1000)
  const [online, setOnline] = useState(true)
  const [latency, setLatency] = useState(235)
  const [notifOn, setNotifOn] = useState(true)

  // contoh: nanti ganti dari API kamu
  useEffect(() => {
    try {
      const raw = localStorage.getItem("yinnotp:last_login")
      if (raw) {
        const j = JSON.parse(raw)
        if (j?.username) setUser((p) => ({ ...p, username: j.username }))
      }
    } catch {}
  }, [])

  return (
    <div className="dash">
      {/* top bar */}
      <header className="dash-top">
        <div className="dash-profile">
          <div className="dash-avatar">{String(user.username || "U").slice(0, 1).toUpperCase()}</div>
          <div className="dash-who">
            <div className="dash-username">{user.username}</div>
            <div className="dash-sub">{user.greeting}</div>
          </div>
        </div>

        <div className="dash-actions">
          <button className="icon-btn" type="button" aria-label="Theme">
            <span className="icon">☀️</span>
          </button>
          <button className="icon-btn" type="button" aria-label="Account">
            <span className="icon">👤</span>
          </button>
        </div>
      </header>

      {/* content */}
      <main className="dash-main">
        {/* row: balance + hero */}
        <section className="grid-2">
          <div className="card balance-card">
            <div className="card-row">
              <div className="bal-icon">💳</div>
              <div className="bal-meta">
                <div className="label">Saldo Kamu</div>
                <div className="value">{moneyIDR(balance)} IDR</div>
              </div>
              <button className="btn-soft" type="button" onClick={() => (window.location.href = "/topup")}>
                Top Up
              </button>
            </div>

            <div className="status-row">
              <div className={`pill ${online ? "pill-on" : "pill-off"}`}>
                <span className="dot" />
                {online ? "Online" : "Offline"}
              </div>
              <div className="muted">
                <b>{latency}ms</b> response server saat ini
              </div>
            </div>
          </div>

          <div className="card hero-card">
            <div className="hero-left">
              <div className="hero-title">Get Virtual Number</div>
              <div className="hero-sub">OTP access for 1,000+ apps across countries</div>

              <div className="hero-icons">
                <span className="app-ic">🟢</span>
                <span className="app-ic">✈️</span>
                <span className="app-ic">📘</span>
                <span className="app-ic">❓</span>
                <span className="app-ic">+99</span>
              </div>
            </div>

            <button className="hero-next" type="button" onClick={() => (window.location.href = "/order")}>
              Pilih Nomor <span className="arr">›</span>
            </button>
          </div>
        </section>

        {/* pending */}
        <section className="card pending-card">
          <div className="card-head">
            <div className="card-title">Pesanan Pending</div>
            <button className="icon-btn small" type="button" aria-label="Refresh">
              🔄
            </button>
          </div>

          <div className="pending-body">
            <div className="pending-illu">📦</div>
            <div className="pending-title">Tidak ada pesanan</div>
            <div className="pending-sub">Pesanan aktif akan muncul disini</div>
            <button className="btn-primary" type="button" onClick={() => (window.location.href = "/order")}>
              + Buat Pesanan
            </button>
          </div>
        </section>

        {/* bottom grid */}
        <section className="grid-2 bottom-grid">
          {/* notif */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Notifikasi</div>
              <div className="muted-sm">
                <span className={`mini-dot ${online ? "on" : "off"}`} /> Aktif
              </div>
            </div>

            <div className="seg">
              <button className={`seg-btn ${notifOn ? "active" : ""}`} type="button" onClick={() => setNotifOn(true)}>
                Browser
              </button>
              <button className={`seg-btn ${!notifOn ? "active" : ""}`} type="button" onClick={() => setNotifOn(false)}>
                Matikan
              </button>
            </div>

            <div className="info-box">
              <div className="info-title">Message Notifikasi Real-time</div>
              <div className="info-text">
                Disarankan gunakan notifikasi real-time agar SMS masuk cepat tanpa delay walaupun situs ditutup saat daftar nomor.
              </div>
            </div>
          </div>

          {/* faq */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Pertanyaan Umum</div>
              <div className="muted-sm">Yang sering diajukan</div>
            </div>

            <div className="faq">
              {[
                { t: "Ayo belajar membaca!", i: "📘" },
                { t: "OTP gak masuk", i: "⏱️" },
                { t: "Cancel tapi saldo terpotong", i: "🧾" },
                { t: "Lupa cancel active order", i: "🧠" },
                { t: "Syarat refund", i: "👁️" },
              ].map((x, idx) => (
                <button key={idx} className="faq-item" type="button" onClick={() => (window.location.href = "/help")}>
                  <span className="faq-ic">{x.i}</span>
                  <span className="faq-t">{x.t}</span>
                  <span className="faq-arr">⌄</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* bottom nav */}
      <nav className="bottom-nav" aria-label="Bottom Navigation">
        <button className="nav-item active" type="button" onClick={() => (window.location.href = "/dashboard")}>
          <span className="nav-ic">🏠</span>
          <span className="nav-tx">Home</span>
        </button>

        <button className="nav-item" type="button" onClick={() => (window.location.href = "/topup")}>
          <span className="nav-ic">💰</span>
          <span className="nav-tx">Deposit</span>
        </button>

        <button className="nav-fab" type="button" onClick={() => (window.location.href = "/order")} aria-label="Order">
          🛍️
        </button>

        <button className="nav-item" type="button" onClick={() => (window.location.href = "/history")}>
          <span className="nav-ic">📈</span>
          <span className="nav-tx">Activity</span>
        </button>

        <button className="nav-item" type="button" onClick={() => (window.location.href = "/settings")}>
          <span className="nav-ic">👤</span>
          <span className="nav-tx">Profile</span>
        </button>
      </nav>
    </div>
  )
}
