"use client";

import "./login.css";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { signIn, getCsrfToken } from "next-auth/react";
import { useRouter } from "next/navigation";

const TTL = 12 * 60 * 60 * 1000;
const DASHBOARD_URL = "/dashboard";

function readLastSession() {
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = Number(obj?.ts || 0);
    if (!ts || Date.now() - ts > TTL) {
      localStorage.removeItem("yinnotp:last_session");
      return null;
    }
    if (!obj?.token || !obj?.username || !obj?.email) return null;
    return { username: obj.username, email: obj.email, token: obj.token, ts };
  } catch {
    try {
      localStorage.removeItem("yinnotp:last_session");
    } catch {}
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState(null);

  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    // prewarm next-auth biar tombol social cepat
    try {
      getCsrfToken().catch(() => {});
    } catch {}
    try {
      fetch("/api/auth/providers", { cache: "no-store" }).catch(() => {});
    } catch {}

    setLast(readLastSession());
  }, []);

  async function submitLogin(e) {
    e.preventDefault();
    if (loading) return;

    const id = ident.trim();
    if (!id) return toast.error("Isi username/email dulu");
    if (!password) return toast.error("Isi password dulu");

    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ident: id, password }),
      });

      const text = await r.text();
      const j = text ? JSON.parse(text) : {};

      if (!r.ok || !j.ok) {
        toast.error(j.message || "Login gagal");
        return;
      }

      if (remember && j.data?.token && j.data?.username && j.data?.email) {
        const payload = {
          username: j.data.username,
          email: j.data.email,
          token: j.data.token,
          ts: Date.now(),
        };
        localStorage.setItem("yinnotp:last_session", JSON.stringify(payload));
        setLast(payload);
      }

      toast.success("Login berhasil");

      // ✅ redirect ke dashboard utama
      router.replace(DASHBOARD_URL);
    } catch {
      toast.error("Server error / koneksi putus");
    } finally {
      setLoading(false);
    }
  }

  async function clickSaved() {
    const cur = readLastSession();
    if (!cur) {
      toast.error("Belum ada sesi login, silakan sign in");
      setLast(null);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/auth/session_login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cur.token }),
      });

      const text = await r.text();
      const j = text ? JSON.parse(text) : {};

      if (!r.ok || !j.ok) {
        localStorage.removeItem("yinnotp:last_session");
        setLast(null);
        toast.error(j.message || "Sesi habis, silakan login ulang");
        return;
      }

      toast.success("Auto login berhasil");

      // ✅ redirect ke dashboard utama
      router.replace(DASHBOARD_URL);
    } catch {
      toast.error("Server error / koneksi putus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <Toaster position="top-right" />

      <div className="dots-decoration dots-top-right"></div>
      <div className="dots-decoration dots-bottom-left"></div>

      <div className="login-card">
        <div className="logo-container">
          <div className="logo-placeholder">☄𔓎</div>
        </div>

        <h2>Welcome back! 👋</h2>
        <p className="subtitle">
          Please sign-in to your account to view the dashboard
        </p>

        <div className="social-buttons">
          <button
            className="btn-social"
            type="button"
            onClick={() => signIn("google", { callbackUrl: DASHBOARD_URL })}
          >
            <img
              src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png"
              width="18"
              alt="Google"
            />
            Google
          </button>

          <button
            className="btn-social"
            type="button"
            onClick={() => signIn("github", { callbackUrl: DASHBOARD_URL })}
          >
            <i className="fab fa-github"></i>
            GitHub
          </button>
        </div>

        {last?.username && last?.email ? (
          <div
            className="saved-account"
            onClick={clickSaved}
            role="button"
            title="Klik untuk auto login"
          >
            <div className="account-info">
              <div className="avatar">
                {String(last.username).slice(0, 1).toUpperCase()}
              </div>
              <div className="account-details">
                <p>Masuk sebagai {last.username}</p>
                <span>{last.email}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "var(--navy-dark)",
              }}
            >
              ☄
            </span>
          </div>
        ) : null}

        <div className="divider">or continue with email</div>

        <form onSubmit={submitLogin}>
          <div className="form-group">
            <div className="input-wrapper">
              <i className="fa-regular fa-user prefix"></i>
              <input
                type="text"
                placeholder="Username or email"
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <i className="fa-solid fa-lock prefix"></i>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <i
                className={`fa-regular ${
                  showPwd ? "fa-eye" : "fa-eye-slash"
                } suffix`}
                onClick={() => setShowPwd((s) => !s)}
                role="button"
                aria-label="Toggle password"
              ></i>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember Me
            </label>
            <a
              href="#"
              className="forgot-pass"
              onClick={(e) => {
                e.preventDefault();
                toast("Coming soon");
              }}
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="btn-submit"
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="footer-text">
          New on our platform? <a href="/register">Create an account</a>
        </p>
      </div>
    </div>
  );
}