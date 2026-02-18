import { Suspense } from "react";
import PayClient from "./pay-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">Menyiapkan pembayaran...</div>}>
      <PayClient />
    </Suspense>
  );
}