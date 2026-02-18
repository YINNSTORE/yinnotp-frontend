"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import QRCode from "qrcode";
import Link from "next/link";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function getActiveUserId() {
  if (typeof window === "undefined") return "";
  const direct =
    localStorage.getItem("yinnotp_active_user") ||
    localStorage.getItem("yinnotp_user_id") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("username") ||
    "";
  if (direct) return direct;

  // fallback: last_session
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    const obj = raw ? JSON.parse(raw) : null;
    return obj?.username || "";
  } catch {
    return "";
  }
}

function k(uid, name) {
  return `yinnotp:${uid}:${name}`;
}

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text };
  }
}

function shortOrderId(orderId) {
  const s = String(orderId || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const timerRef = useRef(null);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  const method = (sp.get("method") || "qris").toLowerCase();
  const amountRaw = sp.get("amount") || "2000";
  const orderFromUrl = sp.get("order_id") || "";
  const resume = sp.get("resume") === "1";

  const amount = useMemo(() => {
    const n = Number(String(amountRaw).replace(/[^\d]/g, "")) || 2000;
    return clamp(n, 2000, 1000000);
  }, [amountRaw]);

  const [mounted, setMounted] = useState(false);
  const [orderId, setOrderId] = useState(orderFromUrl);
  const [loading, setLoading] = useState(true);
  const [qrText, setQrText] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(amount);
  const [status, setStatus] = useState("pending"); // pending | completed | failed
  const [err, setErr] = useState("");

  const uid = useMemo(() => getActiveUserId(), [mounted]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // kalau order_id kosong, bikin dan replace URL (biar konsisten)
    if (!mounted) return;
    if (orderId) return;
    const r = Math.random().toString(16).slice(2, 8).toUpperCase();
    const oid = `YINN-${Date.now()}-${r}`;
    setOrderId(oid);
    router.replace(
      `/topup/pay?method=${encodeURIComponent(method)}&amount=${encodeURIComponent(
        String(amount)
      )}&order_id=${encodeURIComponent(oid)}`
    );
  }, [mounted, orderId, router, method, amount]);

  useEffect(() => {
    if (!mounted) return;
    if (!backend) {
      setErr("NEXT_PUBLIC_BACKEND_URL belum diset di Vercel");
      setLoading(false);
      return;
    }
    if (!orderId) return;

    // ❌ jangan auto redirect ke login, bikin UX kacau
    if (!uid) {
      setErr("Session user tidak ketemu. Login dulu ya.");
      setLoading(false);
      return;
    }

    const tid = toast.loading("Menyiapkan pembayaran...");

    const startPoll = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        checkStatus().catch(() => {});
      }, 3000);
    };

    const makeQr = async (text) => {
      const dataUrl = await QRCode.toDataURL(text, {
        margin: 1,
        width: 360,
        errorCorrectionLevel: "M",
      });
      setQrImg(dataUrl);
    };

    const loadFromCacheIfAny = async () => {
      const cached = localStorage.getItem(k(uid, `deposit_qr:${orderId}`));
      if (cached) {
        setQrText(cached);
        await makeQr(cached);
        setLoading(false);
        toast.success("QR berhasil dimuat", { id: tid });
        startPoll();
        // kalau resume, langsung cek status biar cepat
        if (resume) checkStatus().catch(() => {});
        return true;
      }
      return false;
    };

    const createTx = async () => {
      setErr("");
      setLoading(true);

      const res = await fetch(`${backend}/deposit/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid,
        },
        body: JSON.stringify({
          user_id: uid,
          order_id: orderId,
          amount,
          method,
        }),
      });

      const j = await readJsonSafe(res);

      if (!res.ok || !j?.ok) {
        const msg =
          j?.message ||
          j?.error ||
          (j?.__raw ? "Respon backend bukan JSON" : "") ||
          "Gagal membuat transaksi";
        throw new Error(msg);
      }

      const pay = j?.data?.payment_number || j?.data?.qr_string || "";
      const feeVal = Number(j?.data?.fee || 0) || 0;
      const totalVal = Number(j?.data?.total || j?.data?.total_payment || amount) || amount;

      if (!pay) throw new Error("QR/payment_number kosong dari backend");

      // cache QR per order biar klik riwayat pending bisa kebuka lagi
      localStorage.setItem(k(uid, `deposit_qr:${orderId}`), String(pay));

      // cache history per user (pending)
      try {
        const hk = k(uid, "deposit_history");
        const old = JSON.parse(localStorage.getItem(hk) || "[]");
        const arr = Array.isArray(old) ? old : [];
        const exists = arr.some((x) => x?.order_id === orderId);
        const next = exists
          ? arr
          : [
              {
                order_id: orderId,
                amount,
                method,
                status: "pending",
                created_at: new Date().toISOString(),
              },
              ...arr,
            ];
        localStorage.setItem(hk, JSON.stringify(next));
        // legacy key (biar page lain gak blank)
        localStorage.setItem("yinnotp_deposit_history", JSON.stringify(next));
      } catch {}

      setQrText(pay);
      setFee(feeVal);
      setTotal(totalVal);
      await makeQr(pay);

      setLoading(false);
      toast.success("QR siap, silakan scan", { id: tid });

      startPoll();
    };

    const run = async () => {
      try {
        const cachedOk = await loadFromCacheIfAny();
        if (!cachedOk) await createTx();
      } catch (e) {
        setErr(String(e?.message || e));
        setLoading(false);
        toast.error(String(e?.message || e), { id: tid });
      }
    };

    run();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, backend, uid, orderId, amount, method, resume]);

  const checkStatus = async () => {
    if (!backend || !uid || !orderId) return;

    const res = await fetch(
      `${backend}/deposit/detail?order_id=${encodeURIComponent(
        orderId
      )}&amount=${encodeURIComponent(String(amount))}&method=${encodeURIComponent(
        method
      )}`,
      { cache: "no-store", headers: { "x-user-id": uid } }
    );

    const j = await readJsonSafe(res);
    if (!res.ok || !j?.ok) return;

    const st = String(j?.data?.status || j?.status || "").toLowerCase();

    if (st === "completed" || st === "success" || st === "paid") {
      setStatus("completed");

      // confirm / credit (kalau backend lu idempotent, aman dipanggil berkali-kali)
      try {
        const cr = await fetch(`${backend}/deposit/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": uid,
          },
          body: JSON.stringify({ user_id: uid, order_id: orderId, amount, method }),
        });
        const cj = await readJsonSafe(cr);

        // update cache saldo & history per user kalau backend ngasih
        const newBal = Number(cj?.balance ?? cj?.data?.balance);
        const hist = cj?.history ?? cj?.data?.history;

        if (Number.isFinite(newBal)) {
          localStorage.setItem(k(uid, "balance"), String(newBal));
          localStorage.setItem("yinnotp_balance", String(newBal)); // legacy
        }
        if (Array.isArray(hist)) {
          localStorage.setItem(k(uid, "deposit_history"), JSON.stringify(hist));
          localStorage.setItem("yinnotp_deposit_history", JSON.stringify(hist));
        }
      } catch {}

      if (timerRef.current) clearInterval(timerRef.current);
      toast.success("Pembayaran sukses ✅");

      router.replace(
        `/topup/success?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(
          String(amount)
        )}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit via {method.toUpperCase()}</div>
          <div className="mt-1 text-sm text-[var(--yinn-muted)]">
            Order ID: <span className="font-semibold">{shortOrderId(orderId)}</span>
          </div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-extrabold">{formatIDR(amount)}</span>
          </div>
          {fee ? (
            <div className="text-sm text-[var(--yinn-muted)]">
              Fee: <span className="font-bold">{formatIDR(fee)}</span>
            </div>
          ) : null}
          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-extrabold">{formatIDR(total)}</span>
          </div>

          {!uid ? (
            <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
              <div className="text-sm font-extrabold">Belum login</div>
              <div className="mt-1 text-sm text-[var(--yinn-muted)]">
                {err || "Silakan login dulu biar deposit nempel ke akun yang benar."}
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                >
                  Login
                </Link>
                <Link
                  href="/topup"
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Balik
                </Link>
              </div>
            </div>
          ) : null}

          {uid ? (
            <>
              <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
                {loading ? (
                  <div className="text-sm font-bold text-[var(--yinn-muted)]">
                    Menyiapkan pembayaran... Jangan tutup halaman ini.
                  </div>
                ) : err ? (
                  <div>
                    <div className="text-sm font-extrabold">Error</div>
                    <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>
                  </div>
                ) : (
                  <div className="grid place-items-center">
                    {qrImg ? (
                      <img
                        src={qrImg}
                        alt="QRIS"
                        className="rounded-2xl border border-[var(--yinn-border)]"
                        style={{ width: 320, height: 320 }}
                      />
                    ) : (
                      <div className="text-sm text-[var(--yinn-muted)]">
                        QR belum tersedia
                      </div>
                    )}
                    <div className="mt-3 text-sm font-bold">
                      Scan QR di atas, lalu tunggu otomatis sukses.
                    </div>
                    <div className="mt-1 text-xs text-[var(--yinn-muted)]">
                      Auto-check tiap 3 detik. Tombol manual juga ada.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => checkStatus().catch(() => {})}
                  className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))",
                  }}
                  disabled={loading || !!err}
                >
                  Saya sudah membayar
                </button>
                <Link
                  href="/topup"
                  className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                >
                  Balik ke Deposit
                </Link>
              </div>

              {status === "completed" ? (
                <div className="mt-3 text-sm font-extrabold text-green-500">
                  Status: Sukses ✅
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}