import * as React from "react";
import { Search } from "../icons";
import { Kbd } from "./Kbd";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  leadingIcon?: React.ReactNode;
  trailingSlot?: React.ReactNode;
}

const Root = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ size = "md", leadingIcon, trailingSlot, className, ...rest }, ref) {
    return (
      <label className={`psd-input-root psd-input-root--${size} ${className ?? ""}`}>
        {leadingIcon && <span className="psd-input-root__leading">{leadingIcon}</span>}
        <input ref={ref} className="psd-input" {...rest} />
        {trailingSlot && <span className="psd-input-root__trailing">{trailingSlot}</span>}
      </label>
    );
  }
);

interface SearchProps extends Omit<InputProps, "leadingIcon" | "trailingSlot"> {
  hint?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchProps>(
  function InputSearch({ hint, ...rest }, ref) {
    return (
      <Root
        ref={ref}
        type="search"
        leadingIcon={<Search size={14} />}
        trailingSlot={hint ? <Kbd>{hint}</Kbd> : undefined}
        {...rest}
      />
    );
  }
);

export const Input = Object.assign(Root, { Search: SearchInput });
