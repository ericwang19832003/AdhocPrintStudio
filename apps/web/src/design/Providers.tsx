"use client";
import * as React from "react";
import { TooltipProvider } from "./primitives/Tooltip";
import { ToastProvider } from "./primitives/Toast";

export function DesignProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  );
}
