"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function safeNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

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
    if (!uid) return safeNum(localStorage.getItem("yinnotp_balance") || "0");

    // prioritas per-user
    const perUser = localStorage.getItem(`yinnotp_balance:${uid}`);
    if (perUser != null) return safeNum(perUser);

    // fallback legacy global
    return safeNum(localStorage.getItem("yinnotp_balance") || "0");
  } catch {
    return 0;
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * useAnimatedBalance
 * - displayBalance: angka yang ditampilin (animasi)
 * - realBalance: angka real terakhir yang kebaca dari storage
 *
 * Behavior:
 * - saat user berubah => displayBalance langsung 0 (biar gak “kedip” saldo akun lama)
 * - lalu animasi menuju balance user baru
 * - listen storage event (kalau saldo diupdate dari halaman lain)
 */
export function useAnimatedBalance({ durationMs = 650 } = {}) {
  const [activeUid, setActiveUid] = useState("");
  const [realBalance, setRealBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState(0);

  const rafRef = useRef(0);
  const animRef = useRef({
    from: 0,
    to: 0,
    start: 0,
    dur: durationMs,
  });

  const balanceKeys = useMemo(() => {
    // key yang kita pantau
    const uid = activeUid || "";
    return new Set([
      "yinnotp_active_user",
      "yinnotp_user_id",
      "yinnotp_username",
      "yinnotp_balance",
      uid ? `yinnotp_balance:${uid}` : "",
    ]);
  }, [activeUid]);

  function stopAnim() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }

  function animateTo(target) {
    stopAnim();

    const from = Number(displayBalance) || 0;
    const to = Number(target) || 0;

    if (from === to) return;

    animRef.current = { from, to, start: performance.now(), dur: durationMs };

    const tick = (now) => {
      const { from, to, start, dur } = animRef.current;
      const t = Math.min(1, (now - start) / Math.max(1, dur));
      const v = Math.round(from + (to - from) * easeOutCubic(t));
      setDisplayBalance(v);

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function hardResetAndLoad() {
    const uid = getActiveUserId();
    setActiveUid(uid);

    // reset tampilan dulu biar gak kedip saldo akun lama
    stopAnim();
    setDisplayBalance(0);

    const b = readBalanceForUser(uid);
    setRealBalance(b);

    // animasi ke saldo baru
    // kasih microtask biar render 0 dulu
    Promise.resolve().then(() => animateTo(b));
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    hardResetAndLoad();

    const onStorage = (e) => {
      // kalau key yg relevan berubah, reload
      const k = String(e?.key || "");
      if (!k) return;
      if (balanceKeys.has(k)) {
        hardResetAndLoad();
      }
      // kalau per-user berubah tapi uid belum ke-set (awal), tetap reload
      if (k.startsWith("yinnotp_balance:")) {
        hardResetAndLoad();
      }
    };

    window.addEventListener("storage", onStorage);

    // jaga-jaga: kalau user ganti lewat code yg gak trigger storage (same tab),
    // kita poll ringan tiap 1.5s cek uid
    let lastUid = getActiveUserId();
    const itv = setInterval(() => {
      const cur = getActiveUserId();
      if (cur !== lastUid) {
        lastUid = cur;
        hardResetAndLoad();
      }
    }, 1500);

    return () => {
      stopAnim();
      window.removeEventListener("storage", onStorage);
      clearInterval(itv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceKeys]);

  return { displayBalance, realBalance, activeUid };
}