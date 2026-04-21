import * as React from "react";

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  function Divider({ orientation = "horizontal", className, ...rest }, ref) {
    return (
      <hr
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={`psd-divider psd-divider--${orientation} ${className ?? ""}`}
        {...rest}
      />
    );
  }
);
