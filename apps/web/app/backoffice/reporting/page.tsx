import { Suspense } from "react";
import ReportingClient from "./reporting-client";

export default function ReportingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
          <p className="mono-note">Initializing reporting module...</p>
        </div>
      }
    >
      <ReportingClient />
    </Suspense>
  );
}
