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
    return obj;
  } catch {
    return null;
  }
}

function getActiveUserId() {
  try {
    return (
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_user_id") ||
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

function getTokenForUser(uid) {
  try {
    const s = readLastSession();
    if (s?.token) return String(s.token);

    // paling penting: token yg dipakai login page lu
    const direct =
      localStorage.getItem("yinnotp_token_active") ||
      localStorage.getItem("yinnotp_token") ||
      "";

    if (direct) return String(direct);
    if (uid) {
      const perUser = localStorage.getItem(`yinnotp_token:${uid}`);
      if (perUser) return String(perUser);
    }
    return "";
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

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["paid", "success", "completed", "settlement", "done"].includes(v)) return "completed";
  if (["pending", "process", "processing", "waiting", "unpaid"].includes(v)) return "pending";
  if (["expire", "expired", "failed", "cancel", "canceled", "cancelled"].includes(v)) return "failed";
  return v || "pending";
}

function fmtIDR(n) {
  const num = Number(n || 0) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtDT(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
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

  const backendRaw = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const backend = backendRaw.endsWith("/") ? backendRaw.slice(0, -1) : backendRaw;

  const order_id = sp.get("order_id") || "";
  const method = sp.get("method") || "qris";
  const amountQP = Number(sp.get("amount") || 0) || 0;

  // auth (HARUS stabil pas refresh)
  const uid = useMemo(() => (typeof window === "undefined" ? "" : getActiveUserId()), []);
  const token = useMemo(() => (typeof window === "undefined" ? "" : getTokenForUser(getActiveUserId())), []);

  const isLoggedIn = Boolean(uid && token);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState("pending");
  const [amount, setAmount] = useState(amountQP || 0);
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(amountQP || 0);

  const [createdAt, setCreatedAt] = useState("");
  const [expiredAt, setExpiredAt] = useState("");

  const [qrString, setQrString] = useState("");
  const [qrUrl, setQrUrl] = useState(""); // dataURL (generated)

  const intervalRef = useRef(null);
  const confirmingRef = useRef(false);

  async function makeQrDataUrl(str) {
    const QRCode = (await import("qrcode")).default;
    return QRCode.toDataURL(str, { errorCorrectionLevel: "M", margin: 1, scale: 8 });
  }

  async function fetchDetail() {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!order_id) throw new Error("Order ID kosong");
    const r = await fetch(
      `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}&user_id=${encodeURIComponent(uid)}`,
      { cache: "no-store", headers: authHeaders(uid, token) }
    );
    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j) throw new Error(j?.message || "Response invalid");
    if (j?.ok === false) throw new Error(j?.message || "Gagal ambil detail");
    return j;
  }

  async function createTx() {
    if (!backend) throw new Error("Backend URL belum diset");
    const body = {
      user_id: uid,
      order_id,
      amount: amount || amountQP || 2000,
      method: method || "qris",
    };

    const r = await fetch(`${backend}/deposit/create.php`, {
      method: "POST",
      headers: authHeaders(uid, token),
      body: JSON.stringify(body),
    });

    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j) throw new Error("Create payment gagal (response invalid)");
    if (j?.ok === false) throw new Error(j?.message || "Create payment gagal");

    const p = j.payment || {};
    return {
      status: normalizeStatus(p.status || "pending"),
      amount: Number(p.amount || body.amount) || 0,
      fee: Number(p.fee || 0) || 0,
      total: Number(p.total_payment || p.total || body.amount) || 0,
      payment_number: String(p.payment_number || ""),
      created_at: String(p.created_at || ""),
      expired_at: String(p.expired_at || ""),
    };
  }

  async function confirmIfCompleted() {
    if (confirmingRef.current) return;
    confirmingRef.current = true;

    try {
      const r = await fetch(`${backend}/deposit/confirm.php`, {
        method: "POST",
        headers: authHeaders(uid, token),
        body: JSON.stringify({ user_id: uid, order_id }),
      });

      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j) throw new Error("Confirm response invalid");
      if (!j.ok) throw new Error(j.message || "Gagal konfirmasi deposit");

      toast.success("Deposit sukses ✅", { id: "dep-ok" });
      router.replace(`/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount || 0)}`);
    } catch (e) {
      // kalau confirm gagal, biar bisa retry
      confirmingRef.current = false;
      toast.error(String(e?.message || "Gagal konfirmasi"), { id: "dep-confirm-fail" });
    }
  }

  function stopAutoCheck() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startAutoCheck() {
    stopAutoCheck();
    intervalRef.current = setInterval(async () => {
      try {
        const d = await fetchDetail();
        const st = normalizeStatus(d.status);
        setStatus(st);

        // update meta kalau ada
        if (d.created_at) setCreatedAt(d.created_at);
        if (d.expired_at) setExpiredAt(d.expired_at);

        // completed -> confirm + redirect
        if (st === "completed") {
          stopAutoCheck();
          await confirmIfCompleted();
        }
      } catch {
        // silent (jangan spam toast tiap 3 detik)
      }
    }, 3000);
  }

  async function ensurePaymentAndQR() {
    setLoading(true);
    setErr("");

    try {
      // 1) coba detail
      let d = null;
      try {
        d = await fetchDetail();
      } catch {
        d = null;
      }

      // 2) kalau detail belum ada (misal first open), create
      let payment_number = String(d?.payment_number || "");
      let st = normalizeStatus(d?.status || "pending");

      let amt = Number(d?.amount || amountQP || 0) || 0;
      let feeV = Number(d?.fee || 0) || 0;
      let tot = Number(d?.total_payment || amountQP || 0) || 0;

      if (d?.created_at) setCreatedAt(d.created_at);
      if (d?.expired_at) setExpiredAt(d.expired_at);

      if (!payment_number) {
        const c = await createTx();
        payment_number = c.payment_number;
        st = c.status;

        amt = c.amount;
        feeV = c.fee;
        tot = c.total;

        if (c.created_at) setCreatedAt(c.created_at);
        if (c.expired_at) setExpiredAt(c.expired_at);
      }

      if (!payment_number) throw new Error("QRIS string kosong");

      setStatus(st);
      setAmount(amt);
      setFee(feeV);
      setTotal(tot);

      setQrString(payment_number);
      const dataUrl = await makeQrDataUrl(payment_number);
      setQrUrl(dataUrl);

      setLoading(false);

      // kalau langsung completed
      if (st === "completed") {
        await confirmIfCompleted();
        return;
      }

      startAutoCheck();
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || "Error"));
    }
  }

  async function downloadQR() {
    if (!qrUrl) return toast.error("QR belum siap");
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${order_id || "qris"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("QRIS berhasil didownload ✅");
  }

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    if (!isLoggedIn) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu.");
      return;
    }

    ensurePaymentAndQR();

    return () => stopAutoCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit via QRIS</div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">{fmtIDR(amount)}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Fee: <span className="font-semibold">{fmtIDR(fee)}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-semibold">{fmtIDR(total)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--yinn-muted)]">
            <span>Dibuat: <span className="font-semibold text-[var(--yinn-text)]">{fmtDT(createdAt)}</span></span>
            <span>Expired: <span className="font-semibold text-[var(--yinn-text)]">{fmtDT(expiredAt)}</span></span>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                Menyiapkan pembayaran… jangan tutup halaman ini.
              </div>
            ) : err ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
                <div className="text-sm font-extrabold">Gagal</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={ensurePaymentAndQR}
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
              </div>
            ) : (
              <>
                {/* HOLOGRAM-ish frame */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{
                    background:
                      "radial-gradient(1200px 420px at 10% 10%, rgba(99,102,241,.18), transparent 60%), radial-gradient(900px 380px at 90% 25%, rgba(56,189,248,.16), transparent 55%), radial-gradient(900px 380px at 30% 90%, rgba(244,114,182,.12), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0))",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                      background:
                        "linear-gradient(115deg, rgba(255,0,255,.10), rgba(0,255,255,.09), rgba(255,255,0,.08)), radial-gradient(800px 260px at 20% 15%, rgba(255,255,255,.20), transparent 60%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -inset-24 opacity-35"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0px, rgba(255,255,255,.18) 2px, transparent 2px, transparent 10px)",
                      transform: "rotate(12deg)",
                    }}
                  />

                  <div className="relative grid place-items-center">
                    <div className="rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,.18)]">
                      <img src={qrUrl} alt="QRIS" className="block h-auto w-[280px] max-w-full" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-bold">{status.toUpperCase()}</span> • auto-check 3 detik
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
                    onClick={async () => {
                      try {
                        const d = await fetchDetail();
                        const st = normalizeStatus(d.status);
                        setStatus(st);
                        if (st === "completed") await confirmIfCompleted();
                        else toast("Masih menunggu pembayaran…");
                      } catch (e) {
                        toast.error(String(e?.message || "Gagal cek"));
                      }
                    }}
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

                {/* QR RAW jangan tampil full, bikin copy aja kalau lu mau */}
                {qrString ? (
                  <div className="mt-3 rounded-xl border border-[var(--yinn-border)] p-3 text-[11px] text-[var(--yinn-muted)]">
                    QR Raw: {qrString.slice(0, 36)}…{" "}
                    <button
                      className="underline font-bold"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(qrString);
                          toast.success("QR Raw disalin ✅");
                        } catch {
                          toast.error("Gagal salin");
                        }
                      }}
                    >
                      salin
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}