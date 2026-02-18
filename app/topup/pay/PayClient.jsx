"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(text) {
  try {
    if (!text) return null;
    const t = String(text).trim();
    if (t.startsWith("<!DOCTYPE") || t.startsWith("<html") || t.startsWith("<HTML")) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function normBackend(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function readLastSession() {
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = Number(obj?.ts || 0);
    if (!ts || Date.now() - ts > TTL) return null;
    return obj;
  } catch {
    return null;
  }
}

function pickUidTokenFromStorage() {
  const last = readLastSession();

  // UID: coba semua key yang mungkin
  const uid =
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("yinnotp_username") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("username") ||
    last?.username ||
    "";

  // TOKEN: coba semua key yang mungkin
  const token =
    localStorage.getItem("yinnotp_token") ||
    localStorage.getItem("yinnotp_token_active") ||
    localStorage.getItem("token") ||
    last?.token ||
    "";

  return {
    uid: String(uid || "").trim(),
    token: String(token || "").trim(),
    email: String(last?.email || "").trim(),
  };
}

function rehydrateSessionIfFound() {
  try {
    const { uid, token, email } = pickUidTokenFromStorage();
    if (uid) {
      localStorage.setItem("yinnotp_user_id", uid);
      localStorage.setItem("yinnotp_username", uid);
      localStorage.setItem("yinnotp_active_user", uid);
      localStorage.setItem("yinnotp_name", uid);
    }
    if (email) localStorage.setItem("yinnotp_email", email);
    if (token) {
      localStorage.setItem("yinnotp_token", token);
      localStorage.setItem("yinnotp_token_active", token);
    }
    return { uid, token };
  } catch {
    return { uid: "", token: "" };
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

function normalizeStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["paid", "success", "sukses", "completed", "settlement", "done"].includes(s)) return "completed";
  if (["pending", "process", "processing", "menunggu", "unpaid", "waiting"].includes(s)) return "pending";
  if (["expire", "expired", "failed", "cancel", "canceled", "cancelled"].includes(s)) return "failed";
  return s || "unknown";
}

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function fmtDate(ts) {
  if (!ts) return "—";
  const num = Number(ts);
  const d = new Date(String(ts).length <= 10 ? num * 1000 : num);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const backend = normBackend(process.env.NEXT_PUBLIC_BACKEND_URL);

  const order_id = sp.get("order_id") || "";
  const resume = sp.get("resume") === "1";

  const qpAmount = Number(sp.get("amount") || 0) || 0;

  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("pending");

  const [amount, setAmount] = useState(qpAmount);
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(qpAmount);

  const [createdAt, setCreatedAt] = useState(null);
  const [expiredAt, setExpiredAt] = useState(null);

  const confirmedRef = useRef(false);
  const timerRef = useRef(null);

  const cacheKey = useMemo(() => (uid && order_id ? `deposit_qr:${uid}:${order_id}` : ""), [uid, order_id]);
  const metaKey = useMemo(() => (uid && order_id ? `deposit_meta:${uid}:${order_id}` : ""), [uid, order_id]);

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function fetchAnyJson(url, opt) {
    const r = await fetch(url, opt);
    const t = await r.text();
    const j = safeJson(t);
    return { r, t, j };
  }

  function pickFromDetail(d) {
    const st = normalizeStatus(d?.status || d?.data?.status || d?.payment?.status || d?.data?.payment?.status);

    const amt =
      Number(d?.amount || d?.data?.amount || d?.payment?.amount || d?.data?.payment?.amount || amount || 0) || 0;

    const feeV =
      Number(d?.fee || d?.data?.fee || d?.payment?.fee || d?.data?.payment?.fee || 0) || 0;

    const totalV =
      Number(
        d?.total_payment ||
          d?.data?.total_payment ||
          d?.payment?.total_payment ||
          d?.data?.payment?.total_payment ||
          (amt + feeV)
      ) || 0;

    const qrV =
      d?.qr ||
      d?.qr_image ||
      d?.qr_url ||
      d?.data?.qr ||
      d?.data?.qr_image ||
      d?.data?.qr_url ||
      d?.payment?.qr ||
      d?.payment?.qr_image ||
      d?.payment?.qr_url ||
      d?.data?.payment?.qr ||
      "";

    const created =
      d?.created_at || d?.data?.created_at || d?.payment?.created_at || d?.data?.payment?.created_at || null;

    const expired =
      d?.expired_at || d?.data?.expired_at || d?.payment?.expired_at || d?.data?.payment?.expired_at || null;

    return { st, amt, feeV, totalV, qrV, created, expired };
  }

  async function getDetail() {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!order_id) throw new Error("Order ID kosong");
    if (!uid || !token) throw new Error("Session user tidak ketemu. Login dulu.");

    const urls = [
      `${backend}/deposit/detail?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(uid)}`,
      `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(uid)}`,
    ];

    let lastErr = null;
    for (const url of urls) {
      try {
        const { r, j } = await fetchAnyJson(url, { cache: "no-store", headers: authHeaders(uid, token) });
        if (!r.ok || !j) {
          lastErr = new Error(`Detail invalid (HTTP ${r.status})`);
          continue;
        }
        if (j?.ok === false) {
          lastErr = new Error(String(j?.message || "Detail gagal"));
          continue;
        }
        return j;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Pakasir response tidak sesuai");
  }

  async function confirmDeposit() {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const urls = [`${backend}/deposit/confirm`, `${backend}/deposit/confirm.php`];

    try {
      let ok = false;
      for (const url of urls) {
        const { r, j } = await fetchAnyJson(url, {
          method: "POST",
          headers: authHeaders(uid, token),
          body: JSON.stringify({ user_id: uid, order_id }),
        });
        if (r.ok && j?.ok) {
          ok = true;
          break;
        }
      }
      if (!ok) throw new Error("Gagal konfirmasi deposit");

      toast.success("Deposit sukses ✅", { id: "dep-ok" });
      stopPolling();
      router.replace("/topup");
    } catch (e) {
      confirmedRef.current = false;
      toast.error(String(e?.message || "Gagal konfirmasi deposit"), { id: "dep-confirm-fail" });
    }
  }

  async function ensureLoaded() {
    setErr("");
    setLoading(true);

    try {
      // restore cache biar refresh aman
      if (resume && cacheKey) {
        const cachedQR = localStorage.getItem(cacheKey);
        if (cachedQR) setQr(cachedQR);
      }
      if (resume && metaKey) {
        const m = safeJson(localStorage.getItem(metaKey));
        if (m?.amount) setAmount(Number(m.amount) || 0);
        if (m?.fee != null) setFee(Number(m.fee) || 0);
        if (m?.total) setTotal(Number(m.total) || 0);
        if (m?.createdAt) setCreatedAt(m.createdAt);
        if (m?.expiredAt) setExpiredAt(m.expiredAt);
      }

      const d = await getDetail();
      const p = pickFromDetail(d);

      setStatus(p.st);
      if (p.amt) setAmount(p.amt);
      setFee(p.feeV || 0);
      setTotal(p.totalV || (p.amt + p.feeV));
      setCreatedAt(p.created);
      setExpiredAt(p.expired);

      if (p.qrV) {
        setQr(String(p.qrV));
        if (cacheKey) localStorage.setItem(cacheKey, String(p.qrV));
      }

      if (metaKey) {
        localStorage.setItem(
          metaKey,
          JSON.stringify({
            amount: p.amt,
            fee: p.feeV,
            total: p.totalV || (p.amt + p.feeV),
            createdAt: p.created,
            expiredAt: p.expired,
          })
        );
      }

      setLoading(false);

      if (p.st === "completed") {
        await confirmDeposit();
      }
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || "Pakasir response tidak sesuai"));
    }
  }

  async function pollOnce() {
    try {
      const d = await getDetail();
      const p = pickFromDetail(d);
      if (p.st) setStatus(p.st);

      if (p.st === "completed") {
        await confirmDeposit();
      }
    } catch {
      // silent
    }
  }

  async function downloadQR() {
    try {
      if (!qr) return toast.error("QR belum siap");
      const a = document.createElement("a");
      a.href = qr;
      a.download = `${order_id || "qris"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("QRIS berhasil didownload ✅");
    } catch {
      toast.error("Gagal download");
    }
  }

  function reloadSessionAndRetry() {
    const s = rehydrateSessionIfFound();
    setUid(s.uid);
    setToken(s.token);
    if (!s.uid || !s.token) {
      setErr("Session user tidak ketemu. Login dulu.");
      return;
    }
    ensureLoaded();
  }

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    // ambil session + rehydrate supaya konsisten
    const s = rehydrateSessionIfFound();
    setUid(s.uid);
    setToken(s.token);

    if (!s.uid || !s.token) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu.");
      return;
    }

    ensureLoaded();

    stopPolling();
    timerRef.current = setInterval(() => pollOnce(), 3000);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

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
            Nominal: <span className="font-semibold">{formatIDR(amount)}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Fee: <span className="font-semibold">{formatIDR(fee)}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-semibold">{formatIDR(total || (amount + fee))}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-[var(--yinn-muted)]">
            <div>Dibuat: <span className="font-semibold">{createdAt ? fmtDate(createdAt) : "—"}</span></div>
            <div className="text-right">Expired: <span className="font-semibold">{expiredAt ? fmtDate(expiredAt) : "—"}</span></div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
            {err ? (
              <>
                <div className="text-sm font-extrabold">Gagal</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={reloadSessionAndRetry}
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Coba lagi
                  </button>
                  <Link
                    href="/topup"
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Balik
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Login
                  </Link>
                </div>
              </>
            ) : loading ? (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">Menyiapkan pembayaran…</div>
            ) : qr ? (
              <div className="grid place-items-center gap-3">
                <div className="text-sm font-bold">Scan QR di bawah</div>
                <div className="rounded-2xl border border-[var(--yinn-border)] bg-white p-3">
                  <img src={qr} alt="QRIS" className="h-[240px] w-[240px]" />
                </div>

                <div className="text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-semibold">{String(status).toUpperCase()}</span> • auto-check 3 detik
                </div>

                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={downloadQR}
                    className="rounded-xl px-4 py-3 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Download QRIS
                  </button>

                  <button
                    onClick={confirmDeposit}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-sm font-extrabold"
                  >
                    Saya sudah membayar
                  </button>
                </div>

                <Link
                  href="/topup"
                  className="w-full rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] py-3 text-center text-sm font-bold"
                >
                  Balik ke Deposit
                </Link>
              </div>
            ) : (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">QR belum tersedia. Coba lagi.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}