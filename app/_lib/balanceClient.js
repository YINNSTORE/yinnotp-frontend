"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(text) {
  try {
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readLastSession() {
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = Number(obj?.ts || 0);
    if (!ts || Date.now() - ts > TTL) return null;
    if (!obj?.token) return null;
    return obj;
  } catch {
    return null;
  }
}

function getActiveUserId() {
  try {
    return (
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("username") ||
      readLastSession()?.username ||
      ""
    );
  } catch {
    return "";
  }
}

function getToken() {
  try {
    const s = readLastSession();
    if (s?.token) return String(s.token);
    return String(localStorage.getItem("yinnotp_token") || "");
  } catch {
    return "";
  }
}

function authHeaders(uid) {
  const token = getToken();
  const h = { "Content-Type": "application/json", "X-User-Id": uid, "X-User-Id".toLowerCase(): uid };
  // (server lu nerima X-User-Id / X-Token, jadi aman kirim keduanya)
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
    h["X-Token"] = token;
    h["x-token"] = token;
    h["x-auth-token"] = token;
  }
  return h;
}

function readCachedBalance(uid) {
  try {
    const key = uid ? `yinnotp_balance:${uid}` : "";
    const raw = (key && localStorage.getItem(key)) || localStorage.getItem("yinnotp_balance") || "0";
    const n = Number(String(raw).replace(/[^\d]/g, "")) || 0;
    return n;
  } catch {
    return 0;
  }
}

function writeCachedBalance(uid, bal) {
  try {
    const b = String(Number(bal || 0) || 0);
    if (uid) localStorage.setItem(`yinnotp_balance:${uid}`, b);
    // legacy global biar page lain yang masih baca global tetap bener
    localStorage.setItem("yinnotp_balance", b);
    localStorage.setItem(`yinnotp_last_sync:${uid || "global"}`, String(Date.now()));
    // kasih signal ke semua page yang lagi kebuka
    window.dispatchEvent(new Event("yinnotp:balance"));
  } catch {}
}

export function useAnimatedBalance({ durationMs = 650 } = {}) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const uid = useMemo(() => (typeof window === "undefined" ? "" : getActiveUserId()), []);
  const [targetBalance, setTargetBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState(0);

  const animRef = useRef({ raf: 0, start: 0, from: 0, to: 0 });

  function animateTo(to) {
    cancelAnimationFrame(animRef.current.raf);
    const from = displayBalance;
    const start = performance.now();

    animRef.current = { raf: 0, start, from, to };

    const tick = (now) => {
      const p = Math.min(1, (now - start) / Math.max(1, durationMs));
      const val = Math.round(from + (to - from) * p);
      setDisplayBalance(val);
      if (p < 1) animRef.current.raf = requestAnimationFrame(tick);
    };

    animRef.current.raf = requestAnimationFrame(tick);
  }

  async function syncFromBackend() {
    if (!backend || !uid) return;

    const token = getToken();
    if (!token) return;

    try {
      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers: authHeaders(uid),
      });
      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      writeCachedBalance(uid, bal);
      setTargetBalance(bal);
    } catch {}
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ✅ tiap masuk: reset 0 dulu biar gak “kedip” saldo akun lama
    setDisplayBalance(0);

    // ✅ load cache lokal langsung
    const cached = readCachedBalance(uid);
    setTargetBalance(cached);
    // animasi 0 -> cached
    setTimeout(() => animateTo(cached), 30);

    // ✅ langsung sync biar Home gak nunggu Deposit page
    syncFromBackend();

    // ✅ re-sync saat balik ke tab / buka lagi
    const onFocus = () => syncFromBackend();
    window.addEventListener("focus", onFocus);

    // ✅ listen event custom + storage (multi tab)
    const onBalanceEvent = () => {
      const b = readCachedBalance(uid);
      setTargetBalance(b);
      animateTo(b);
    };
    window.addEventListener("yinnotp:balance", onBalanceEvent);
    window.addEventListener("storage", onBalanceEvent);

    // ✅ polling ringan biar selalu update walau ga buka deposit
    const timer = setInterval(() => syncFromBackend(), 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("yinnotp:balance", onBalanceEvent);
      window.removeEventListener("storage", onBalanceEvent);
      clearInterval(timer);
      cancelAnimationFrame(animRef.current.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, backend]);

  // kalau targetBalance berubah dari event lain, animasi ke target
  useEffect(() => {
    animateTo(targetBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBalance]);

  return { uid, displayBalance, targetBalance, syncFromBackend };
}