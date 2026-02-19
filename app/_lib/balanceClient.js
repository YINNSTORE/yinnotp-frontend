"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(t) {
  try {
    if (!t) return null;
    return JSON.parse(t);
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
  const h = { "Content-Type": "application/json" };
  if (uid) {
    h["X-User-Id"] = uid;
    h["x-user-id"] = uid;
  }
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
    const k1 = uid ? `yinnotp_balance:${uid}` : "";
    const raw =
      (k1 && localStorage.getItem(k1)) ||
      localStorage.getItem("yinnotp_balance") ||
      localStorage.getItem("balance") ||
      "0";

    const n = Number(String(raw).replace(/[^\d]/g, "")) || 0;
    return n;
  } catch {
    return 0;
  }
}

function writeCachedBalance(uid, bal) {
  try {
    const n = Number(bal || 0) || 0;
    if (uid) localStorage.setItem(`yinnotp_balance:${uid}`, String(n));
    // legacy cache biar page lama masih kebaca
    localStorage.setItem("yinnotp_balance", String(n));
    localStorage.setItem(`yinnotp_last_sync:${uid || "global"}`, String(Date.now()));
  } catch {}
}

/**
 * Hook saldo:
 * - tampil 0 dulu (anti-kedip)
 * - animasi ke nilai cache
 * - lalu sync ke backend /deposit/me biar selalu bener walau belum buka halaman deposit
 */
export function useAnimatedBalance({ durationMs = 650 } = {}) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [uid, setUid] = useState("");
  const [displayBalance, setDisplayBalance] = useState(0);
  const [realBalance, setRealBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const animRef = useRef(null);

  const animateTo = useCallback(
    (to) => {
      const target = Number(to || 0) || 0;

      if (animRef.current) cancelAnimationFrame(animRef.current);

      const from = Number(displayBalance || 0) || 0;
      const start = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - start) / Math.max(1, durationMs));
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const val = Math.round(from + (target - from) * eased);
        setDisplayBalance(val);
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };

      animRef.current = requestAnimationFrame(step);
    },
    [displayBalance, durationMs]
  );

  const refresh = useCallback(async () => {
    try {
      if (!backend) return;
      const curUid = getActiveUserId();
      const token = getToken();
      if (!curUid || !token) return;

      const r = await fetch(`${backend}/deposit/me?user_id=${encodeURIComponent(curUid)}`, {
        cache: "no-store",
        headers: authHeaders(curUid),
      });

      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      writeCachedBalance(curUid, bal);

      setRealBalance(bal);
      animateTo(bal);
    } catch {
      // diem aja biar gak ganggu UI
    }
  }, [backend, animateTo]);

  // init + anti-kedip user ganti
  useEffect(() => {
    if (typeof window === "undefined") return;

    const curUid = getActiveUserId();
    setUid(curUid);

    // tampil 0 dulu (anti kedip saldo akun sebelumnya)
    setDisplayBalance(0);
    setRealBalance(0);
    setLoading(true);

    // pakai cache dulu biar cepet
    const cached = readCachedBalance(curUid);
    setRealBalance(cached);
    animateTo(cached);

    setLoading(false);

    // sync beneran ke backend
    refresh();

    // ketika balik ke tab, refresh lagi biar update
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    // kalau user ganti (page lain set localStorage), kita cek berkala ringan
    let lastUid = curUid;
    const uidTimer = setInterval(() => {
      const u = getActiveUserId();
      if (u && u !== lastUid) {
        lastUid = u;
        setUid(u);

        setDisplayBalance(0);
        const c = readCachedBalance(u);
        setRealBalance(c);
        animateTo(c);
        refresh();
      }
    }, 800);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(uidTimer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { uid, displayBalance, realBalance, loading, refresh };
}