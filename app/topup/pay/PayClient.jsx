"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

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
    // ✅ username/email boleh kosong
    return {
      username: String(obj?.username || ""),
      email: String(obj?.email || ""),
      token: String(obj?.token || ""),
      ts,
    };
  } catch {
    return null;
  }
}

function getActiveUserIdLoose() {
  try {
    // ✅ ambil dari semua key yang mungkin ada
    return (
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("yinnotp_name") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("username") ||
      readLastSession()?.username ||
      ""
    );
  } catch {
    return "";
  }
}

function getTokenLoose(uid) {
  try {
    const s = readLastSession();
    return (
      localStorage.getItem("yinnotp_token") ||
      localStorage.getItem("yinnotp_token_active") ||
      (uid ? localStorage.getItem(`yinnotp_token:${uid}`) : "") ||
      s?.token ||
      ""
    );
  } catch {
    return "";
  }
}

function authHeaders(uid, token) {
  const h = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  if (token) {
    h["X-Token"] = token;
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

function normalizeStatus(obj) {
  const raw =
    obj?.status ??
    obj?.data?.status ??
    obj?.payment?.status ??
    obj?.data?.payment?.status ??
    obj?.result?.status ??
    obj?.data?.result?.status ??
    "";

  const s = String(raw || "").toLowerCase();

  if (["paid", "success", "sukses", "completed", "settlement", "done"].includes(s)) return "completed";
  if (["pending", "process", "processing", "menunggu", "unpaid", "waiting"].includes(s)) return "pending";
  if (["expire", "expired", "failed", "cancel", "canceled", "cancelled"].includes(s)) return "failed";
  return s || "unknown";
}

function pickPaymentNumber(obj) {
  return (
    obj?.payment_number ||
    obj?.data?.payment_number ||
    obj?.payment?.payment_number ||
    obj?.data?.payment?.payment_number ||
    obj?.payment?.qr_string ||
    obj?.data?.payment?.qr_string ||
    obj?.qr_string ||
    obj?.data?.qr_string ||
    obj?.qr ||
    obj?.data?.qr ||
    obj?.qris ||
    obj?.data?.qris ||
    ""
  );
}

function pickMeta(obj) {
  const amount = obj?.amount ?? obj?.data?.amount ?? obj?.payment?.amount ?? obj?.data?.payment?.amount ?? 0;
  const total =
    obj?.total_payment ??
    obj?.data?.total_payment ??
    obj?.payment?.total_payment ??
    obj?.data?.payment?.total_payment ??
    amount;

  const fee = obj?.fee ?? obj?.data?.fee ?? obj?.payment?.fee ?? obj?.data?.payment?.fee ?? 0;

  const created =
    obj?.created_at ??
    obj?.data?.created_at ??
    obj?.payment?.created_at ??
    obj?.data?.payment?.created_at ??
    0;

  const exp =
    obj?.expired_at ??
    obj?.data?.expired_at ??
    obj?.payment?.expired_at ??
    obj?.data?.payment?.expired_at ??
    0;

  return {
    amount: Number(amount || 0) || 0,
    total: Number(total || 0) || 0,
    fee: Number(fee || 0) || 0,
    created_at: Number(created || 0) || 0,
    expired_at: Number(exp || 0) || 0,
  };
}

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000 || ts); // support seconds / ms
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function qrDataUrlFromString(qrString) {
  const QRCode = (await import("qrcode")).default;
  return await QRCode.toDataURL(qrString, { errorCorrectionLevel: "M", margin: 1, scale: 8 });
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const timerRef = useRef(null);
  const confirmingRef = useRef(false);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const order_id = sp.get("order_id") || "";
  const method = sp.get("method") || "qris";
  const amountQ = Number(sp.get("amount") || 0) || 0;

  // ✅ session disimpan di state, dibaca ulang pas mount (biar refresh aman)
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState("pending");
  const [amount, setAmount] = useState(amountQ);
  const [total, setTotal] = useState(amountQ);
  const [fee, setFee] = useState(0);
  const [createdAt, setCreatedAt] = useState(0);
  const [expiredAt, setExpiredAt] = useState(0);

  const [qrString, setQrString] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  const cacheKey = useMemo(() => (uid && order_id ? `deposit_qr:${uid}:${order_id}` : ""), [uid, order_id]);

  function stopAuto() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startAuto() {
    stopAuto();
    timerRef.current = setInterval(() => checkNow(true), 3000);
  }

  // ✅ baca session pas mount + tiap balik dari login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = getActiveUserIdLoose();
    const t = getTokenLoose(u);
    setUid(String(u || ""));
    setToken(String(t || ""));
  }, []);

  async function fetchDetail(u, t) {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!order_id) throw new Error("Order ID kosong");
    if (!u || !t) throw new Error("Session user tidak ketemu. Login dulu.");

    const headers = authHeaders(u, t);

    // ✅ fallback endpoint: /deposit/detail , /deposit/detail.php
    const urls = [
      `${backend}/deposit/detail?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(u)}`,
      `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(u)}`,
    ];

    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: "no-store", headers });
        const ttxt = await r.text();
        const j = safeJson(ttxt);
        if (!r.ok || !j) throw new Error("Pakasir response tidak sesuai");
        if (j?.ok === false) throw new Error(String(j?.message || "Pakasir response tidak sesuai"));
        return j;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Pakasir response tidak sesuai");
  }

  async function createTx(u, t) {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!u || !t) throw new Error("Session user tidak ketemu. Login dulu.");

    const headers = authHeaders(u, t);

    // ✅ fallback endpoint: /deposit/create , /deposit/create.php
    const urls = [`${backend}/deposit/create`, `${backend}/deposit/create.php`];

    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ user_id: u, order_id, amount: amount || amountQ || 2000, method }),
        });
        const ttxt = await r.text();
        const j = safeJson(ttxt);
        if (!r.ok || !j) throw new Error("Create payment gagal (response invalid)");
        if (j?.ok === false) throw new Error(String(j?.message || "Create payment gagal"));
        return j;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Create payment gagal");
  }

  async function confirmDeposit(u, t) {
    if (confirmingRef.current) return;
    confirmingRef.current = true;

    try {
      const headers = authHeaders(u, t);
      const urls = [`${backend}/deposit/confirm`, `${backend}/deposit/confirm.php`];

      let ok = false;
      let lastErr = null;

      for (const url of urls) {
        try {
          const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ user_id: u, order_id }) });
          const ttxt = await r.text();
          const j = safeJson(ttxt);
          if (!r.ok || !j) throw new Error("Confirm gagal");
          if (j?.ok === false) throw new Error(String(j?.message || "Confirm gagal"));
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!ok) throw lastErr || new Error("Confirm gagal");

      toast.success("Deposit sukses ✅");
      router.replace("/topup"); // balik ke deposit/home
    } catch (e) {
      confirmingRef.current = false;
      toast.error(String(e?.message || "Gagal konfirmasi deposit"));
    }
  }

  async function ensureQR(u, t) {
    setErr("");
    setLoading(true);

    try {
      // 1) detail dulu
      let d = null;
      try {
        d = await fetchDetail(u, t);
      } catch {
        d = null;
      }

      if (d) {
        const st = normalizeStatus(d);
        setStatus(st);

        const meta = pickMeta(d);
        if (meta.amount) setAmount(meta.amount);
        if (meta.total) setTotal(meta.total);
        if (meta.fee !== undefined) setFee(meta.fee);
        if (meta.created_at) setCreatedAt(meta.created_at);
        if (meta.expired_at) setExpiredAt(meta.expired_at);

        const pn = pickPaymentNumber(d);
        if (pn) {
          setQrString(pn);
          const dataUrl = await qrDataUrlFromString(pn);
          setQrUrl(dataUrl);
          if (cacheKey) localStorage.setItem(cacheKey, pn);
          setLoading(false);
          return true;
        }
      }

      // 2) kalau belum ada payment_number -> create
      const c = await createTx(u, t);
      const st2 = normalizeStatus(c);
      setStatus(st2);

      const meta2 = pickMeta(c);
      if (meta2.amount) setAmount(meta2.amount);
      if (meta2.total) setTotal(meta2.total);
      if (meta2.fee !== undefined) setFee(meta2.fee);
      if (meta2.created_at) setCreatedAt(meta2.created_at);
      if (meta2.expired_at) setExpiredAt(meta2.expired_at);

      const pn2 = pickPaymentNumber(c);
      if (!pn2) throw new Error("QRIS string kosong dari backend");

      setQrString(pn2);
      const dataUrl2 = await qrDataUrlFromString(pn2);
      setQrUrl(dataUrl2);
      if (cacheKey) localStorage.setItem(cacheKey, pn2);

      setLoading(false);
      return true;
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || "Error"));
      return false;
    }
  }

  async function checkNow(silent = false) {
    try {
      if (!uid || !token) return false;

      const d = await fetchDetail(uid, token);
      const st = normalizeStatus(d);
      setStatus(st);

      const meta = pickMeta(d);
      if (meta.amount) setAmount(meta.amount);
      if (meta.total) setTotal(meta.total);
      if (meta.fee !== undefined) setFee(meta.fee);
      if (meta.created_at) setCreatedAt(meta.created_at);
      if (meta.expired_at) setExpiredAt(meta.expired_at);

      if (st === "completed") {
        await confirmDeposit(uid, token);
        return true;
      }

      if (!silent) toast(st === "pending" ? "Masih pending…" : `Status: ${st}`);
      return true;
    } catch (e) {
      if (!silent) toast.error(String(e?.message || "Gagal cek status"));
      return false;
    }
  }

  async function downloadQR() {
    try {
      if (!qrUrl) return toast.error("QR belum siap");
      const a = document.createElement("a");
      a.href = qrUrl;
      a.download = `${order_id || "qris"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("QRIS didownload ✅");
    } catch {
      toast.error("Gagal download");
    }
  }

  // MAIN FLOW
  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    // ✅ kalau refresh, baca ulang session SEKARANG (biar gak ngandelin memo lama)
    const u = typeof window === "undefined" ? "" : getActiveUserIdLoose();
    const t = typeof window === "undefined" ? "" : getTokenLoose(u);
    if (u && t) {
      setUid(u);
      setToken(t);
    }
  }, [order_id, router]);

  useEffect(() => {
    if (!order_id) return;

    if (!uid || !token) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu.");
      stopAuto();
      return;
    }

    // kalau ada cache QR string, render cepat
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached && !qrString) {
          setQrString(cached);
          qrDataUrlFromString(cached).then(setQrUrl).catch(() => {});
        }
      } catch {}
    }

    let mounted = true;

    (async () => {
      const ok = await ensureQR(uid, token);
      if (!mounted) return;
      if (ok) startAuto();
    })();

    return () => {
      mounted = false;
      stopAuto();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token, order_id]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[520px]">
        <div className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5" style={{ boxShadow: "var(--yinn-soft)" }}>
          <div className="text-lg font-extrabold">Deposit via QRIS</div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">{formatIDR(amount || amountQ)}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Fee: <span className="font-semibold">{formatIDR(fee)}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-semibold">{formatIDR(total || amountQ)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-[var(--yinn-muted)]">
            <span>Dibuat: {createdAt ? formatDateTime(createdAt) : "—"}</span>
            <span>Expired: {expiredAt ? formatDateTime(expiredAt) : "—"}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
            {err ? (
              <>
                <div className="text-sm font-extrabold">Gagal</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      // coba re-read session (buat kasus user baru login di tab lain)
                      const u = getActiveUserIdLoose();
                      const t = getTokenLoose(u);
                      setUid(u);
                      setToken(t);
                      setErr("");
                      setLoading(true);
                    }}
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Coba lagi
                  </button>

                  <Link href="/topup" className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold">
                    Balik
                  </Link>

                  <Link href="/login" className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold">
                    Login
                  </Link>
                </div>
              </>
            ) : loading ? (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">Menyiapkan pembayaran…</div>
            ) : qrUrl ? (
              <>
                {/* HOLOGRAM SIMPLE (BRIMO-LIKE FEEL) */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{
                    background:
                      "radial-gradient(900px 260px at 20% 10%, rgba(99,102,241,.18), transparent 60%), radial-gradient(900px 260px at 85% 30%, rgba(56,189,248,.16), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0))",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      background:
                        "linear-gradient(120deg, rgba(0,255,255,.10), rgba(255,0,255,.10), rgba(255,255,0,.08)), radial-gradient(800px 200px at 30% 25%, rgba(255,255,255,.20), transparent 55%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -inset-24 opacity-35"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0px, rgba(255,255,255,.18) 2px, transparent 2px, transparent 12px)",
                      transform: "rotate(10deg)",
                    }}
                  />

                  <div className="relative grid place-items-center">
                    <div className="rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,.18)]">
                      <img src={qrUrl} alt="QRIS" className="block h-auto w-[280px] max-w-full" style={{ imageRendering: "pixelated" }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-bold">{String(status).toUpperCase()}</span> • auto-check 3 detik
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={downloadQR}
                    className="rounded-xl px-4 py-3 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Download QRIS
                  </button>

                  <button
                    onClick={() => checkNow(false)}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-sm font-extrabold"
                  >
                    Cek sekarang
                  </button>
                </div>

                <div className="mt-2">
                  <Link
                    href="/topup"
                    className="block rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-center text-sm font-bold"
                  >
                    Balik ke Deposit
                  </Link>
                </div>

                {/* debug kecil biar gampang kalau ada masalah */}
                {qrString ? (
                  <div className="mt-3 rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-3 text-[11px] text-[var(--yinn-muted)]">
                    QR Raw: {qrString.slice(0, 80)}{qrString.length > 80 ? "…" : ""}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">QR belum tersedia. Coba lagi.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}