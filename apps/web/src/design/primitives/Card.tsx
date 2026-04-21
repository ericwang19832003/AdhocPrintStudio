import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
}

const Root = React.forwardRef<HTMLDivElement, CardProps>(
  function Card({ padding = "md", interactive, className, children, ...rest }, ref) {
    const classes = [
      "psd-card",
      `psd-card--${padding}`,
      interactive ? "psd-card--interactive" : null,
      className,
    ].filter(Boolean).join(" ");

    return (
      <div ref={ref} className={classes} {...rest}>
        {children}
      </div>
    );
  }
);

const Header = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={`psd-card__header ${className ?? ""}`} {...rest}>
        {children}
      </div>
    );
  }
);

const Body = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={`psd-card__body ${className ?? ""}`} {...rest}>
        {children}
      </div>
    );
  }
);

export const Card = Object.assign(Root, { Header, Body });
