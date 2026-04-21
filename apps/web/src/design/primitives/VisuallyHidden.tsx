import * as React from "react";

export const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function VisuallyHidden({ className, children, ...rest }, ref) {
    return (
      <span ref={ref} className={`psd-visually-hidden ${className ?? ""}`} {...rest}>
        {children}
      </span>
    );
  }
);
