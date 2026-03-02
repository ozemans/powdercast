"use client";

import { UnitProvider } from "@/contexts/UnitContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <UnitProvider>{children}</UnitProvider>;
}
