import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warn" | "danger" | "info";
  caps?: boolean;
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ tone = "neutral", caps, dot, className, children, ...rest }, ref) {
    const classes = [
      "psd-badge",
      tone !== "neutral" ? `psd-badge--${tone}` : null,
      caps ? "psd-badge--caps" : null,
      className,
    ].filter(Boolean).join(" ");

    return (
      <span ref={ref} className={classes} {...rest}>
        {dot && <span className="psd-badge__dot" />}
        {children}
      </span>
    );
  }
);
