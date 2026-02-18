"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // contoh ambil query param
    const amount = sp.get("amount");      // misal ?amount=20000
    const orderId = sp.get("order_id");   // misal ?order_id=INVxxx

    // kalau param wajib gak ada, balikin ke /topup
    if (!amount || !orderId) {
      router.replace("/topup");
      return;
    }

    // ✅ DI SINI: taro logic lu (redirect ke pakasir / call backend)
    // contoh kalau pakai URL redirect:
    // window.location.href = `${process.env.NEXT_PUBLIC_PAKASIR_PAY_URL}/${amount}?order_id=${orderId}`;

  }, [sp, router]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] grid place-items-center px-4">
      <div className="text-center">
        <div className="text-base font-extrabold">Menyiapkan pembayaran…</div>
        <div className="mt-1 text-sm text-[var(--yinn-muted)]">
          Jangan tutup halaman ini.
        </div>
      </div>
    </div>
  );
}