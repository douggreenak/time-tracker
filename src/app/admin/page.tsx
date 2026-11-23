"use client";

import { DataBackup } from "@/components/DataBackup";
import { RequireAdmin } from "@/components/AuthProvider";

export default function Page() {
  return (
    <RequireAdmin>
      <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Data</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Back up everything in the app, or restore it from a backup. Admins only.</p>
        </div>
        <DataBackup />
      </div>
    </RequireAdmin>
  );
}
