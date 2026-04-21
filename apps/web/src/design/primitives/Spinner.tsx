import * as React from "react";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  function Spinner({ size = "md", label = "Loading", className, ...rest }, ref) {
    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        className={`psd-spinner psd-spinner--${size} ${className ?? ""}`}
        {...rest}
      >
        <span className="psd-visually-hidden">{label}</span>
      </span>
    );
  }
);
