import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] grid place-items-center">
          <div className="text-sm text-[var(--yinn-muted)]">Memuat status...</div>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}