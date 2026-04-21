import * as React from "react";
import { Spinner } from "./Spinner";
import { VisuallyHidden } from "./VisuallyHidden";

type Variant = "primary" | "secondary" | "ghost" | "link" | "accent" | "danger";
type Size = "sm" | "md";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
};

type IconOnlyProps = CommonProps & {
  iconOnly: true;
  icon: React.ReactNode;
  "aria-label": string;
  leadingIcon?: never;
  trailingIcon?: never;
  children?: never;
};

type WithChildrenProps = CommonProps & {
  iconOnly?: false;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
};

export type ButtonProps =
  & (IconOnlyProps | WithChildrenProps)
  & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | "children">;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const { variant = "primary", size = "md", loading, className, ...rest } = props;
    const iconOnly = "iconOnly" in props && props.iconOnly === true;

    const classes = [
      "psd-button",
      `psd-button--${variant}`,
      `psd-button--${size}`,
      iconOnly ? "psd-button--icon-only" : null,
      className,
    ].filter(Boolean).join(" ");

    if (iconOnly) {
      const { icon, "aria-label": ariaLabel, ...buttonRest } =
        rest as IconOnlyProps & React.ButtonHTMLAttributes<HTMLButtonElement>;
      return (
        <button
          ref={ref}
          type="button"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className={classes}
          disabled={loading || (rest as React.ButtonHTMLAttributes<HTMLButtonElement>).disabled}
          {...buttonRest}
        >
          {loading ? <Spinner size="sm" label={ariaLabel} /> : icon}
        </button>
      );
    }

    const { leadingIcon, trailingIcon, children, ...buttonRest } =
      rest as WithChildrenProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

    return (
      <button
        ref={ref}
        type="button"
        aria-busy={loading || undefined}
        className={classes}
        disabled={loading || (rest as React.ButtonHTMLAttributes<HTMLButtonElement>).disabled}
        {...buttonRest}
      >
        {loading ? <Spinner size="sm" /> : leadingIcon}
        {children && <span>{children}</span>}
        {!loading && trailingIcon}
        {loading && <VisuallyHidden>Loading</VisuallyHidden>}
      </button>
    );
  }
);
