import { Suspense } from "react";
import PayClient from "./PayClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-[var(--yinn-bg)] text-[var(--yinn-text)]">
          <div className="text-center">
            <div className="font-extrabold">Menyiapkan pembayaran...</div>
            <div className="text-sm text-[var(--yinn-muted)]">Jangan tutup halaman ini.</div>
          </div>
        </div>
      }
    >
      <PayClient />
    </Suspense>
  );
}