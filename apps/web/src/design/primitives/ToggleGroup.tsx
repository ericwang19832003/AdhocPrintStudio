"use client";
import * as React from "react";
import * as RadixToggleGroup from "@radix-ui/react-toggle-group";

const Root = React.forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Root>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Root>
>(function ToggleGroup({ className, ...rest }, ref) {
  return <RadixToggleGroup.Root ref={ref} className={`psd-toggle-group ${className ?? ""}`} {...rest} />;
});

const Item = React.forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Item>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Item>
>(function ToggleGroupItem({ className, ...rest }, ref) {
  return <RadixToggleGroup.Item ref={ref} className={`psd-toggle-group-item ${className ?? ""}`} {...rest} />;
});

export const ToggleGroup = Object.assign(Root, { Item });
