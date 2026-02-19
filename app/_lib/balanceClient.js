"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function getActiveUserId() {
  try {
    return (
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("username") ||
      ""
    );
  } catch {
    return "";
  }
}

function readBalanceForUser(uid) {
  try {
    if (!uid) return 0;
    const raw = localStorage.getItem(`yinnotp_balance:${uid}`);
    const n = Number(String(raw || "0").replace(/[^\d]/g, "")) || 0;
    return n;
  } catch {
    return 0;
  }
}

function animateNumber(from, to, ms, onUpdate) {
  const start = performance.now();
  const diff = to - from;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  let raf = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const v = Math.round(from + diff * easeOutCubic(t));
    onUpdate(v);
    if (t < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * UI balance anti-kedip:
 * - kalau user berubah -> displayBalance langsung 0
 * - habis itu ambil saldo per-user -> animate naik
 * - listen event "storage" + custom event "yinnotp:user_changed"
 */
export function useAnimatedBalance({ durationMs = 650 } = {}) {
  const [uid, setUid] = useState("");
  const [displayBalance, setDisplayBalance] = useState(0);
  const [realBalance, setRealBalance] = useState(0);

  const cancelRef = useRef(null);

  const refresh = () => {
    const nextUid = getActiveUserId();
    setUid(nextUid);

    const nextReal = readBalanceForUser(nextUid);
    setRealBalance(nextReal);

    // reset dulu biar gak kedip saldo akun lama
    setDisplayBalance(0);

    // animate ke saldo bener
    if (cancelRef.current) cancelRef.current();
    cancelRef.current = animateNumber(0, nextReal, durationMs, setDisplayBalance);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    refresh();

    const onStorage = (e) => {
      // kalau ada perubahan user/balance di tab lain
      if (!e) return;
      if (
        e.key === "yinnotp_active_user" ||
        e.key === "yinnotp_user_id" ||
        e.key === "yinnotp_username" ||
        (uid && e.key === `yinnotp_balance:${uid}`) ||
        (e.key && String(e.key).startsWith("yinnotp_balance:"))
      ) {
        refresh();
      }
    };

    const onUserChanged = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener("yinnotp:user_changed", onUserChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("yinnotp:user_changed", onUserChanged);
      if (cancelRef.current) cancelRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      uid,
      displayBalance,
      realBalance,
      refresh,
    }),
    [uid, displayBalance, realBalance]
  );
}