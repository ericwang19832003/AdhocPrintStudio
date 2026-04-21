"use client";
import * as React from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "../icons";

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox({ label, className, ...rest }, ref) {
    const id = React.useId();
    const cb = (
      <RadixCheckbox.Root ref={ref} id={id} className={`psd-checkbox ${className ?? ""}`} {...rest}>
        <RadixCheckbox.Indicator className="psd-checkbox-indicator">
          <Check size={11} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
    );
    if (!label) return cb;
    return (
      <span className="psd-checkbox-row">
        {cb}
        <label htmlFor={id} style={{ cursor: "pointer" }}>{label}</label>
      </span>
    );
  }
);
