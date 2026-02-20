"use client";

import { useEffect, useRef, useState } from "react";

export const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

function safeJson(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function readToken() {
  if (typeof window === "undefined") return "";
  try {
    // prioritas token aktif
    const t1 = localStorage.getItem("yinnotp_token_active");
    if (t1) return String(t1);

    const t2 = localStorage.getItem("yinnotp_token");
    if (t2) return String(t2);

    // fallback dari last_session
    const raw = localStorage.getItem("yinnotp:last_session");
    if (raw) {
      const j = JSON.parse(raw);
      if (j?.token) return String(j.token);
    }
  } catch {}
  return "";
}

function readActiveUserKey() {
  if (typeof window === "undefined") return "guest";
  try {
    return (
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("yinnotp_user_id") ||
      "guest"
    );
  } catch {
    return "guest";
  }
}

function cacheKey(uid) {
  return `yinnotp_balance:${uid || "guest"}`;
}

function writeCached(uid, n) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(uid), String(Math.max(0, Math.floor(n || 0))));
    // legacy cache (kalau masih dipakai komponen lain)
    localStorage.setItem("yinnotp_balance", String(Math.max(0, Math.floor(n || 0))));
  } catch {}
}

function readCached(uid) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * SOURCE OF TRUTH saldo: /api/auth/me (proxy -> backend auth/me.php)
 * karena backend admin update users.balance_idr (SQLite)
 */
export async function fetchBalance() {
  const uid = readActiveUserKey();
  const token = readToken();

  // 1) coba dari /api/auth/me (paling bener)
  if (token) {
    try {
      const r = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const txt = await r.text();
      const j = safeJson(txt);

      if (r.ok && j?.ok) {
        const bal =
          Number(j?.data?.balance_idr ?? j?.data?.balance ?? j?.balance_idr ?? 0) || 0;
        writeCached(uid, bal);
        return Math.max(0, Math.floor(bal));
      }
      // kalau token invalid / dibanned, biarin fallback ke cache
    } catch {
      // ignore -> fallback cache
    }
  }

  // 2) fallback: cache lokal (biar gak 0 terus)
  const cached = readCached(uid);
  return Math.max(0, Math.floor(cached || 0));
}

export function useAnimatedBalance() {
  const [balance, setBalance] = useState(0);
  const rafRef = useRef(0);
  const fromRef = useRef(0);

  async function refresh() {
    const next = await fetchBalance();

    // animasi halus (0.6s)
    const from = fromRef.current;
    const to = next;

    const dur = 600;
    const t0 = performance.now();

    cancelAnimationFrame(rafRef.current);

    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      // easeOut
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * e);
      setBalance(v);

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    // init dari cache biar gak “kedip 0”
    const uid = readActiveUserKey();
    const cached = readCached(uid);
    setBalance(cached);
    fromRef.current = cached;

    refresh();

    // auto refresh tiap 10s (tetap ringan)
    const id = setInterval(refresh, 10000);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { balance, refresh };
}