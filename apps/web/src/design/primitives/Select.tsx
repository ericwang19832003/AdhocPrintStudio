"use client";
import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "../icons";

const Root = RadixSelect.Root;
const Value = RadixSelect.Value;

const Trigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(function SelectTrigger({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Trigger ref={ref} className={`psd-select-trigger ${className ?? ""}`} {...rest}>
      {children}
      <RadixSelect.Icon><ChevronDown size={14} /></RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

const Content = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(function SelectContent({ className, children, position = "popper", ...rest }, ref) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content ref={ref} position={position} className={`psd-select-content ${className ?? ""}`} {...rest}>
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
});

const Item = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item ref={ref} className={`psd-select-item ${className ?? ""}`} {...rest}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator style={{ marginLeft: 8 }}><Check size={12} /></RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

export const Select = Object.assign(Root, { Value, Trigger, Content, Item });
