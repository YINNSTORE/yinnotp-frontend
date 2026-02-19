// app/_lib/balanceClient.js
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
    return String(localStorage.getItem("yinnotp_token") || localStorage.getItem("yinnotp_token_active") || "");
  } catch {
    return "";
  }
}

function authHeaders(uid) {
  const token = getToken();
  const h = { "Content-Type": "application/json" };
  if (uid) {
    h["X-User-Id"] = uid;
    h["X-Token"] = token || "";
  }
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function readCachedBalance(uid) {
  try {
    if (!uid) return 0;
    const raw = localStorage.getItem(`yinnotp_balance:${uid}`);
    const n = Number(String(raw || "0").replace(/[^\d]/g, "")) || 0;
    return n;
  } catch {
    return 0;
  }
}

function writeCachedBalance(uid, bal) {
  try {
    if (!uid) return;
    localStorage.setItem(`yinnotp_balance:${uid}`, String(Number(bal || 0) || 0));
    localStorage.setItem(`yinnotp_last_sync:${uid}`, String(Date.now()));
    window.dispatchEvent(new CustomEvent("yinnotp:balance", { detail: { uid, balance: Number(bal || 0) || 0 } }));
  } catch {}
}

export function useAnimatedBalance({ durationMs = 650 } = {}) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [uid, setUid] = useState("");
  const [targetBalance, setTargetBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState(0);

  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);
  const toRef = useRef(0);

  const isLoggedIn = useMemo(() => Boolean(uid && getToken()), [uid]);

  function animateTo(next) {
    cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    fromRef.current = displayBalance;
    toRef.current = Number(next || 0) || 0;

    const step = (now) => {
      const t = Math.min(1, (now - startRef.current) / Math.max(120, durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(fromRef.current + (toRef.current - fromRef.current) * eased);
      setDisplayBalance(val);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }

  async function fetchBalance(currentUid) {
    if (!backend || !currentUid) return;
    if (!getToken()) return;

    try {
      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(currentUid)}`, {
        cache: "no-store",
        headers: authHeaders(currentUid),
      });
      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      writeCachedBalance(currentUid, bal);
      setTargetBalance(bal);
      animateTo(bal);
    } catch {}
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentUid = getActiveUserId();
    setUid(currentUid);

    setDisplayBalance(0);
    setTargetBalance(0);

    const cached = readCachedBalance(currentUid);
    if (cached > 0) {
      setTargetBalance(cached);
      animateTo(cached);
    }

    fetchBalance(currentUid);

    const onStorage = () => {
      const nu = getActiveUserId();
      if (nu !== currentUid) {
        setUid(nu);
        setDisplayBalance(0);
        setTargetBalance(0);
        const c2 = readCachedBalance(nu);
        if (c2 > 0) {
          setTargetBalance(c2);
          animateTo(c2);
        }
        fetchBalance(nu);
      }
    };

    const onBalance = (e) => {
      const d = e?.detail || {};
      if (d.uid && d.uid === getActiveUserId()) {
        const b = Number(d.balance || 0) || 0;
        setTargetBalance(b);
        animateTo(b);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("yinnotp:balance", onBalance);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("yinnotp:balance", onBalance);
    };
  }, [backend, durationMs]);

  return { uid, isLoggedIn, displayBalance, targetBalance, refresh: () => fetchBalance(uid) };
}