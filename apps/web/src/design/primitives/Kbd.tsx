import * as React from "react";

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function Kbd({ className, children, ...rest }, ref) {
    return (
      <kbd ref={ref} className={`psd-kbd ${className ?? ""}`} {...rest}>
        {children}
      </kbd>
    );
  }
);
