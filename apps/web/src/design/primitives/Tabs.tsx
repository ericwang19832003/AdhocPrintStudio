"use client";
import * as React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";

const Root = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Root>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Root>
>(function Tabs({ className, ...rest }, ref) {
  return <RadixTabs.Root ref={ref} className={`psd-tabs ${className ?? ""}`} {...rest} />;
});

const List = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(function TabsList({ className, ...rest }, ref) {
  return <RadixTabs.List ref={ref} className={`psd-tabs-list ${className ?? ""}`} {...rest} />;
});

const Trigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
  return <RadixTabs.Trigger ref={ref} className={`psd-tab ${className ?? ""}`} {...rest} />;
});

const Panel = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(function TabsPanel({ className, ...rest }, ref) {
  return <RadixTabs.Content ref={ref} className={`psd-tab-panel ${className ?? ""}`} {...rest} />;
});

export const Tabs = Object.assign(Root, { List, Trigger, Panel });
