"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button className="btn btn-ghost no-print" onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </button>
  );
}
