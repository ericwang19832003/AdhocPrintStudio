"use client";
import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

export interface TooltipProps {
  content: React.ReactNode;
  delayMs?: number;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}

export function Tooltip({ content, delayMs = 200, side = "top", children }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delayMs}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={6} className="psd-tooltip-content">
          {content}
          <RadixTooltip.Arrow className="psd-tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;
