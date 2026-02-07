"use client"

import { useEffect, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { signIn } from "next-auth/react"
import "./register.css"

function isEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())
}

function normalizeMessage(m) {
  return String(m || "").replace(/\s+/g, " ").trim()
}

function parseUsedMessage(msgRaw) {
  const raw = normalizeMessage(msgRaw)
  const m = raw.toLowerCase()

  // detect "already used" in many variants
  const used =
    m.includes("already used") ||
    m.includes("sudah dipakai") ||
    m.includes("sudah digunakan") ||
    m.includes("sudah terdaftar") ||
    m.includes("telah terdaftar") ||
    m.includes("exists") ||
    m.includes("exist") ||
    m.includes("taken") ||
    m.includes("dipakai") ||
    m.includes("terdaftar") ||
    m.includes("unique") ||
    m.includes("constraint")

  if (m.includes("email") && used) return "Email already used"
  if (m.includes("username") && used) return "Username already used"

  // explicit codes (kalau backend pakai code)
  if (m.includes("email_already") || m.includes("email_used")) return "Email already used"
  if (m.includes("username_already") || m.includes("username_used")) return "Username already used"

  return ""
}

export default function RegisterPage() {
  const [agree, setAgree] = useState(false);

  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const [last, setLast] = useState(null)

  
  const LAST_TTL_MS = 12 * 60 * 60 * 1000

  // LOAD_LAST_SESSION_TTL12H
  useEffect(() => {
    try {
      const raw = localStorage.getItem("yinnotp:last_session")
      if (!raw) { setLast(null); return }
      const obj = JSON.parse(raw)
      const ts = Number(obj && obj.ts ? obj.ts : 0)
      if (!ts || (Date.now() - ts) > LAST_TTL_MS) {
        localStorage.removeItem("yinnotp:last_session")
        setLast(null)
        return
      }
      if (obj && obj.username && obj.email) {
        setLast({ username: obj.username, email: obj.email })
      } else {
        setLast(null)
      }
    } catch {
      try { localStorage.removeItem("yinnotp:last_session") } catch {}
      setLast(null)
    }
  }, [])

  // CLICK_SAVED_SESSION_AUTLOGIN
  function onSavedSessionClick() {
    try { localStorage.setItem("yinnotp:autologin", "1") } catch {}
    window.location.href = "/login"
  }
const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [policy, setPolicy] = useState(false)

  const [policyAttn, setPolicyAttn] = useState(false)
  const policyWrapRef = useRef(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("yinnotp:last_login")
      if (raw) setLast(JSON.parse(raw))
    } catch {}
  }, [])

  function focusPolicy() {
    setPolicyAttn(true)
    try {
      policyWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch {}
    setTimeout(() => setPolicyAttn(false), 900)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return

    const u = username.trim()
    const em = email.trim()

    if (u.length < 6) return toast.error("Username minimal 6 karakter")
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return toast.error("Username hanya huruf/angka/_")
    if (!isEmailValid(em)) return toast.error("Email tidak valid")
    if (password.length < 6) return toast.error("Password minimal 6 karakter")
    if (!policy) {
      toast.error("Wajib centang privacy policy & terms")
      focusPolicy()
      return
    }

    setLoading(true)
    try {

      const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

      if (!API) {
        setLoading(false)
        toast.error("API base belum diset (NEXT_PUBLIC_API_BASE)")
        return
      }


      const r = await fetch(`${API}/auth/register.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, email: em, password })
      })

      // ✅ robust: baca raw text dulu biar message gak hilang
      const rawText = await r.text()
      let j = {}
      try { j = JSON.parse(rawText) } catch {}

      const msgAny =
        j?.message ||
        j?.msg ||
        j?.error ||
        j?.errors?.[0]?.message ||
        rawText

      if (!r.ok || !j.ok) {
        const usedText = parseUsedMessage(msgAny)
        if (usedText) return toast.error(usedText)

        // fallback: kalau server ngirim kosong/aneh, tetap tampilkan yg paling dekat
        const clean = normalizeMessage(msgAny)
        return toast.error(clean ? clean : "Gagal daftar")
      }

      localStorage.setItem("yinnotp:last_login", JSON.stringify({
        username: j.data?.username || u,
        email: j.data?.email || em
      }))

      toast.success("Daftar berhasil")
      setTimeout(() => (window.location.href = "/login"), 1200)
    } catch {
      toast.error("Server error / koneksi putus")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2200,
          style: {
            minWidth: 280,   // ✅ lebih “panjang ke kiri” dikit
            padding: "12px 14px",
            borderRadius: 10,
            fontWeight: 700,
          },
        }}
      />

      <div className="bg-dots top-right"></div>
      <div className="bg-dots bottom-left"></div>

      <div className="auth-card">
        <div className="logo-container">
          <div className="logo-komet">☄𔓎</div>
        </div>

        <h2>Hello new member! 🚀</h2>
        <p className="subtitle">Buat akun dan nikmati layanannya</p>

        <div className="social-row">
          <button className="btn-social" type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
            <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" width="18" alt="Google" />
            Google
          </button>
          <button className="btn-social" type="button" onClick={() => signIn("github", { callbackUrl: "/" })}>
            <i className="fab fa-github"></i>
            GitHub
          </button>
        </div>

        {last?.username && last?.email ? (
        <div className="session-info" onClick={onSavedSessionClick} role="button" title="Masuk cepat (auto login)">
            <div className="acc-details">
              <div className="avatar">{String(last.username).slice(0, 1).toUpperCase()}</div>
              <div className="acc-text">
                <p>Masuk sebagai {last.username}</p>
                <span>{last.email}</span>
              </div>
</div>
            <span style={{ fontSize: 20, color: "var(--navy-dark)", fontWeight: 900 }}>☄</span>
          </div>
        ) : null}

        <div className="divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <div className="input-group">
              <i className="fa-regular fa-user"></i>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <div className="input-group">
              <i className="fa-regular fa-envelope"></i>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <div className="input-group">
              <i className="fa-solid fa-lock"></i>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <i
                className={`fa-regular ${showPwd ? "fa-eye" : "fa-eye-slash"} toggle-eye`}
                onClick={() => setShowPwd((s) => !s)}
                role="button"
                aria-label="Toggle password"
              ></i>
            </div>
          </div>

          <div ref={policyWrapRef} className={policyAttn ? "policy-attn" : ""}>
            <div className="policy-group" onClick={() => setPolicy((v) => !v)}>
              <input
                type="checkbox"
                id="policy"
                checked={policy}
                onChange={(e) => setPolicy(e.target.checked)}
              />
              <label htmlFor="policy">
                Saya telah menyetujui{" "}
                <a href="/privacy" className="policy-link">Kebijakan Privasi</a>
                {" "}dan{" "}
                <a href="/terms" className="policy-link">Ketentuan Layanan</a>
              </label>
            </div>
          </div>

          <button type="submit" className="btn-register" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <p className="footer-link">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </>
  )
}
