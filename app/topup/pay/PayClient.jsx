"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(text) {
  try {
    if (!text) return null;
    // kalau server balikin HTML (error page), jangan dipaksa JSON
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
  const d = new Date(Number(ts) * (String(ts).length <= 10 ? 1000 : 1)); // support unix seconds/millis
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

  // jangan pakai useMemo([]) buat uid/token — pas refresh kadang ke-lock value kosong
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");

  // query fallback (kadang kosong pas resume)
  const qpMethod = sp.get("method") || "qris";
  const qpAmount = Number(sp.get("amount") || 0) || 0;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [qr, setQr] = useState(""); // image url / data url
  const [status, setStatus] = useState("pending");

  const [amount, setAmount] = useState(qpAmount);
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(qpAmount);

  const [createdAt, setCreatedAt] = useState(null);
  const [expiredAt, setExpiredAt] = useState(null);

  const confirmedRef = useRef(false);
  const timerRef = useRef(null);
  const toastErrOnceRef = useRef(false);

  const cacheKey = useMemo(() => {
    if (!uid || !order_id) return "";
    return `deposit_qr:${uid}:${order_id}`;
  }, [uid, order_id]);

  const metaKey = useMemo(() => {
    if (!uid || !order_id) return "";
    return `deposit_meta:${uid}:${order_id}`;
  }, [uid, order_id]);

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

  async function getDetail() {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!order_id) throw new Error("Order ID kosong");
    if (!uid || !token) throw new Error("Session user tidak ketemu. Login dulu.");

    // coba route dulu, kalau gagal baru .php (biar aman)
    const urls = [
      `${backend}/deposit/detail?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(uid)}`,
      `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(uid)}`,
    ];

    let lastErr = null;
    for (const url of urls) {
      try {
        const { r, j } = await fetchAnyJson(url, { cache: "no-store", headers: authHeaders(uid) });
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

  function pickFromDetail(d) {
    // fleksibel sama format backend kamu
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

  async function createTx() {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!uid || !token) throw new Error("Session user tidak ketemu. Login dulu.");

    const body = {
      user_id: uid,
      order_id,
      method: "qris", // keep qris only biar konsisten
      amount: Number(amount || qpAmount || 2000) || 2000,
    };

    const urls = [
      `${backend}/deposit/create`,
      `${backend}/deposit/create.php`,
    ];

    let lastErr = null;

    for (const url of urls) {
      try {
        const { r, j } = await fetchAnyJson(url, {
          method: "POST",
          headers: authHeaders(uid),
          body: JSON.stringify(body),
        });

        if (!r.ok || !j) {
          lastErr = new Error(`Create invalid (HTTP ${r.status})`);
          continue;
        }
        if (j?.ok === false) {
          lastErr = new Error(String(j?.message || "Gagal buat transaksi"));
          continue;
        }

        // QR value (kalau backend ngirim langsung image url/dataurl)
        const qrV =
          j.qr || j.qr_image || j.qr_url || j.data?.qr || j.data?.qr_image || j.data?.qr_url || "";

        // meta
        const feeV = Number(j.fee || j.data?.fee || 0) || 0;
        const totalV = Number(j.total_payment || j.data?.total_payment || j.total || j.data?.total || 0) || 0;

        const expired = j.expired_at || j.data?.expired_at || j.payment?.expired_at || null;

        return { qrV, feeV, totalV, expired };
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Gagal buat transaksi");
  }

  async function confirmDeposit() {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const urls = [
      `${backend}/deposit/confirm`,
      `${backend}/deposit/confirm.php`,
    ];

    try {
      let ok = false;
      let msg = "";
      for (const url of urls) {
        const { r, j } = await fetchAnyJson(url, {
          method: "POST",
          headers: authHeaders(uid),
          body: JSON.stringify({ user_id: uid, order_id }),
        });

        if (r.ok && j?.ok) {
          ok = true;
          msg = j?.message || "";
          break;
        }
      }
      if (!ok) throw new Error(msg || "Gagal konfirmasi deposit");

      toast.success("Deposit sukses ✅", { id: "dep-ok" });
      stopPolling();

      // redirect ke halaman deposit biar balance/riwayat kebaca
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
      // 1) kalau resume, coba load meta cache dulu (biar refresh gak blank)
      if (resume && metaKey) {
        try {
          const m = safeJson(localStorage.getItem(metaKey));
          if (m?.amount) setAmount(Number(m.amount) || 0);
          if (m?.fee != null) setFee(Number(m.fee) || 0);
          if (m?.total) setTotal(Number(m.total) || 0);
          if (m?.createdAt) setCreatedAt(m.createdAt);
          if (m?.expiredAt) setExpiredAt(m.expiredAt);
        } catch {}
      }

      if (resume && cacheKey) {
        try {
          const cachedQR = localStorage.getItem(cacheKey);
          if (cachedQR) setQr(cachedQR);
        } catch {}
      }

      // 2) try detail
      let d = null;
      try {
        d = await getDetail();
      } catch (e) {
        d = null;
      }

      if (d) {
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

        // simpan meta biar refresh aman
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

        // kalau sudah completed, langsung confirm + redirect
        if (p.st === "completed") {
          setLoading(false);
          await confirmDeposit();
          return;
        }
      }

      // 3) kalau QR belum ada, create
      if (!qr) {
        const c = await createTx();
        if (c?.qrV) {
          setQr(String(c.qrV));
          if (cacheKey) localStorage.setItem(cacheKey, String(c.qrV));
        }
        if (c?.feeV != null) setFee(Number(c.feeV) || 0);
        if (c?.totalV) setTotal(Number(c.totalV) || 0);
        if (c?.expired) setExpiredAt(c.expired);

        // simpan meta
        if (metaKey) {
          localStorage.setItem(
            metaKey,
            JSON.stringify({
              amount: Number(amount || qpAmount || 2000) || 2000,
              fee: Number(c?.feeV || 0) || 0,
              total: Number(c?.totalV || 0) || 0,
              createdAt: createdAt || null,
              expiredAt: c?.expired || expiredAt || null,
            })
          );
        }
      }

      setLoading(false);
    } catch (e) {
      setLoading(false);
      const m = String(e?.message || "Pakasir response tidak sesuai");
      setErr(m);
      if (!toastErrOnceRef.current) {
        toastErrOnceRef.current = true;
        toast.error(m, { id: "pay-load-fail" });
      }
    }
  }

  async function pollOnce() {
    try {
      const d = await getDetail();
      const p = pickFromDetail(d);
      if (p.st) setStatus(p.st);
      if (p.amt) setAmount(p.amt);
      setFee(p.feeV || 0);
      setTotal(p.totalV || (p.amt + p.feeV));
      setCreatedAt(p.created);
      setExpiredAt(p.expired);

      if (p.qrV && !qr) {
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

      if (p.st === "completed") {
        await confirmDeposit();
      }
    } catch {
      // silent saat polling
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

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    // ambil uid/token setelah mount (fix refresh)
    const u = getActiveUserId();
    const t = getToken();
    setUid(u);
    setToken(t);

    // kalau belum login -> stop
    if (!u || !t) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu ya.");
      return;
    }

    ensureLoaded();

    stopPolling();
    timerRef.current = setInterval(() => {
      pollOnce();
    }, 3000);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  const isLoggedIn = Boolean(uid && token);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      {/* hologram animation css */}
      <style jsx global>{`
        @keyframes yinnShimmer {
          0% { transform: translateX(-40%) rotate(12deg); opacity: .0; }
          20% { opacity: .55; }
          60% { opacity: .55; }
          100% { transform: translateX(40%) rotate(12deg); opacity: .0; }
        }
        .yinn-holo::before{
          content:"";
          position:absolute;
          inset:-60px;
          background:
            linear-gradient(120deg,
              rgba(255, 0, 255, .12),
              rgba(0, 255, 255, .10),
              rgba(255, 255, 0, .10),
              rgba(255, 255, 255, .06)
            );
          mix-blend-mode: screen;
          filter: blur(.2px);
          opacity:.75;
          pointer-events:none;
        }
        .yinn-holo::after{
          content:"";
          position:absolute;
          inset:-80px;
          background:
            repeating-linear-gradient(45deg,
              rgba(255,255,255,.20) 0px,
              rgba(255,255,255,.20) 2px,
              transparent 2px,
              transparent 9px
            );
          opacity:.28;
          transform: rotate(10deg);
          pointer-events:none;
        }
        .yinn-shimmer{
          position:absolute;
          inset:-40%;
          background: radial-gradient(closest-side, rgba(255,255,255,.35), transparent 70%);
          animation: yinnShimmer 2.8s linear infinite;
          pointer-events:none;
        }
      `}</style>

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
            <div>
              Dibuat: <span className="font-semibold">{createdAt ? fmtDate(createdAt) : "—"}</span>
            </div>
            <div className="text-right">
              Expired: <span className="font-semibold">{expiredAt ? fmtDate(expiredAt) : "—"}</span>
            </div>
          </div>

          <div className="mt-4">
            {err ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
                <div className="text-sm font-extrabold">{isLoggedIn ? "Gagal" : "Belum login"}</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>

                <div className="mt-3 flex gap-2">
                  {!isLoggedIn ? (
                    <Link
                      href="/login"
                      className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                      style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                    >
                      Login
                    </Link>
                  ) : null}

                  <button
                    onClick={() => {
                      toastErrOnceRef.current = false;
                      ensureLoaded();
                    }}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Coba lagi
                  </button>

                  <Link
                    href="/topup"
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Balik
                  </Link>
                </div>
              </div>
            ) : loading ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                Menyiapkan pembayaran… jangan tutup halaman ini.
              </div>
            ) : (
              <>
                {/* QR + hologram ala BRImo */}
                <div
                  className="relative yinn-holo overflow-hidden rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{
                    background:
                      "radial-gradient(900px 320px at 20% 15%, rgba(99,102,241,.18), transparent 60%), radial-gradient(900px 320px at 85% 25%, rgba(56,189,248,.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0))",
                  }}
                >
                  <div className="yinn-shimmer" />
                  <div className="relative grid place-items-center">
                    <div className="rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,.18)]">
                      <img src={qr} alt="QRIS" className="block h-auto w-[280px] max-w-full" style={{ imageRendering: "pixelated" }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-bold">{String(status || "pending").toUpperCase()}</span> • auto-check 3 detik
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
                    onClick={() => confirmDeposit()}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-sm font-extrabold"
                  >
                    Saya sudah membayar
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}