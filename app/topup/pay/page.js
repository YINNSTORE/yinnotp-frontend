"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

function safeJson(t) {
  try {
    if (!t) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function normalizeStatus(obj) {
  // toleran untuk banyak bentuk response
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
    obj?.payment?.qr ||
    obj?.data?.payment?.qr ||
    obj?.payment?.qris ||
    obj?.data?.payment?.qris ||
    ""
  );
}

function pickMeta(obj) {
  const amount =
    obj?.amount ??
    obj?.data?.amount ??
    obj?.payment?.amount ??
    obj?.data?.payment?.amount ??
    0;

  const method =
    obj?.method ??
    obj?.data?.method ??
    obj?.payment?.payment_method ??
    obj?.data?.payment?.payment_method ??
    "qris";

  const total =
    obj?.total_payment ??
    obj?.data?.total_payment ??
    obj?.payment?.total_payment ??
    obj?.data?.payment?.total_payment ??
    amount;

  return {
    amount: Number(amount || 0) || 0,
    total: Number(total || 0) || 0,
    method: String(method || "qris"),
  };
}

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

async function qrDataUrlFromString(qrString) {
  // generate QR PNG dataURL via lib qrcode (yang sudah lu install)
  const QRCode = (await import("qrcode")).default;
  return await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
  });
}

export default function TopupPayPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const timerRef = useRef(null);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const order_id = useMemo(() => sp.get("order_id") || "", [sp]);
  const qpAmount = useMemo(() => Number(sp.get("amount") || 0) || 0, [sp]);
  const qpMethod = useMemo(() => sp.get("method") || "qris", [sp]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState("pending");
  const [amount, setAmount] = useState(qpAmount);
  const [total, setTotal] = useState(qpAmount);
  const [method, setMethod] = useState(qpMethod);

  const [qrString, setQrString] = useState("");
  const [qrUrl, setQrUrl] = useState(""); // dataURL

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("yinnotp_token") || "";
  }, []);

  const user_id = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("yinnotp_active_user") ||
      ""
    );
  }, []);

  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) {
      h["X-Token"] = token;
      h["Authorization"] = `Bearer ${token}`;
    }
    if (user_id) h["X-User-Id"] = user_id;
    return h;
  }, [token, user_id]);

  async function fetchDetail() {
    if (!backend) throw new Error("BACKEND URL belum di set");
    if (!order_id) throw new Error("Order ID kosong");
    // detail.php harus mengembalikan status + (opsional) payment_number
    const url = `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}${user_id ? `&user_id=${encodeURIComponent(user_id)}` : ""}`;
    const r = await fetch(url, { cache: "no-store", headers });
    const t = await r.text();
    const j = safeJson(t);

    if (!r.ok || !j) {
      // kasih potongan text biar kebaca
      throw new Error("Pakasir response tidak sesuai");
    }
    if (j?.ok === false) {
      throw new Error(j?.message || "Pakasir response tidak sesuai");
    }

    const st = normalizeStatus(j);
    const meta = pickMeta(j);
    const payNum = pickPaymentNumber(j);

    return { raw: j, status: st, ...meta, payment_number: payNum };
  }

  async function createIfMissing() {
    // kalau detail gak punya payment_number, coba create ulang via create.php (idempotent tergantung backend lo)
    if (!backend) throw new Error("BACKEND URL belum di set");
    if (!user_id || !token) throw new Error("Session user tidak ketemu. Login dulu.");

    const body = {
      user_id,
      order_id,
      amount: amount || 2000,
      method: method || "qris",
    };

    const r = await fetch(`${backend}/deposit/create.php`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const t = await r.text();
    const j = safeJson(t);

    if (!r.ok || !j) throw new Error("Create payment gagal (response invalid)");
    if (j?.ok === false) throw new Error(j?.message || "Create payment gagal");

    const payNum = pickPaymentNumber(j);
    const meta = pickMeta(j);
    return { payment_number: payNum, ...meta };
  }

  async function ensureQR() {
    setErr("");
    setLoading(true);
    try {
      // 1) ambil detail dulu
      let d = null;
      try {
        d = await fetchDetail();
      } catch {
        d = null;
      }

      // 2) pastiin kita punya amount/method/total
      if (d?.amount) setAmount(d.amount);
      if (d?.total) setTotal(d.total);
      if (d?.method) setMethod(d.method);
      if (d?.status) setStatus(d.status);

      // 3) payment string
      let payNum = d?.payment_number || "";

      if (!payNum) {
        // fallback: create
        const c = await createIfMissing();
        if (c?.amount) setAmount(c.amount);
        if (c?.total) setTotal(c.total);
        if (c?.method) setMethod(c.method);
        payNum = c?.payment_number || "";
      }

      if (!payNum) throw new Error("QRIS string kosong (backend belum ngirim)");

      setQrString(payNum);
      const dataUrl = await qrDataUrlFromString(payNum);
      setQrUrl(dataUrl);

      setLoading(false);
      return true;
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || "Pakasir response tidak sesuai"));
      return false;
    }
  }

  async function confirmIfCompleted() {
    // optional: kalau lu punya confirm.php untuk nambah saldo
    try {
      if (!backend) return;
      if (!user_id || !token) return;

      await fetch(`${backend}/deposit/confirm.php`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id, order_id }),
      }).catch(() => {});
    } catch {}
  }

  async function checkNow({ silent = false } = {}) {
    if (!backend || !order_id) return;

    try {
      const d = await fetchDetail();
      setStatus(d.status);

      if (d.amount) setAmount(d.amount);
      if (d.total) setTotal(d.total);
      if (d.method) setMethod(d.method);

      if (d.status === "completed") {
        await confirmIfCompleted();
        if (!silent) toast.success("Pembayaran sukses ✅");
        // redirect ke success biar rapi
        router.replace(`/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(d.amount || amount || 0)}`);
        return true;
      }

      if (d.status === "failed") {
        if (!silent) toast.error("Pembayaran gagal/expired");
        return true;
      }

      if (!silent) toast("Masih menunggu pembayaran…");
      return true;
    } catch (e) {
      if (!silent) toast.error(String(e?.message || "Pakasir response tidak sesuai"));
      setErr(String(e?.message || "Pakasir response tidak sesuai"));
      return false;
    }
  }

  function startAutoCheck() {
    stopAutoCheck();
    timerRef.current = setInterval(() => {
      checkNow({ silent: true });
    }, 3000);
  }

  function stopAutoCheck() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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

    (async () => {
      const ok = await ensureQR();
      if (ok) startAutoCheck();
    })();

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
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>
          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">{formatIDR(amount)}</span>
          </div>

          {total ? (
            <div className="text-sm text-[var(--yinn-muted)]">
              Total: <span className="font-semibold">{formatIDR(total)}</span>
            </div>
          ) : null}

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4 text-sm text-[var(--yinn-muted)]">
                Menyiapkan pembayaran… jangan tutup halaman ini.
              </div>
            ) : err ? (
              <div className="rounded-2xl border border-[var(--yinn-border)] p-4">
                <div className="text-sm font-extrabold">Error</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => ensureQR()}
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
                </div>
              </div>
            ) : (
              <>
                {/* QR BOX + HOLOGRAM */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{
                    background:
                      "radial-gradient(1200px 400px at 10% 10%, rgba(99,102,241,.16), transparent 60%), radial-gradient(1200px 400px at 90% 30%, rgba(56,189,248,.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0))",
                  }}
                >
                  {/* hologram shimmer overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      background:
                        "linear-gradient(115deg, rgba(255,0,255,.10), rgba(0,255,255,.08), rgba(255,255,0,.08)), radial-gradient(900px 200px at 20% 20%, rgba(255,255,255,.25), transparent 60%)",
                      mixBlendMode: "screen",
                      filter: "blur(0.2px)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -inset-24 opacity-40"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0px, rgba(255,255,255,.18) 2px, transparent 2px, transparent 10px)",
                      transform: "rotate(10deg)",
                    }}
                  />

                  <div className="relative grid place-items-center">
                    <div className="rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,.18)]">
                      <img
                        src={qrUrl}
                        alt="QRIS"
                        className="block h-auto w-[280px] max-w-full"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[var(--yinn-muted)]">
                  Scan QR di atas. Sistem auto-check tiap 3 detik. Status:{" "}
                  <span className="font-bold">{String(status || "pending").toUpperCase()}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => checkNow({ silent: false })}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-3 text-sm font-extrabold"
                  >
                    Cek sekarang
                  </button>

                  <button
                    onClick={downloadQR}
                    className="rounded-xl px-4 py-3 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Download QRIS
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