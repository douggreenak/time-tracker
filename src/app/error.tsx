"use client";

import { AccessDenied } from "@/components/AccessDenied";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <AccessDenied onRetry={reset} />;
}
