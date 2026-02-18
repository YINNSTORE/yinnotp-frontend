import { Suspense } from "react";
import PayClient from "./PayClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          Loading...
        </div>
      }
    >
      <PayClient />
    </Suspense>
  );
}