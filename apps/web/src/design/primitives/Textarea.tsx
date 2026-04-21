import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  counter?: { total: number };
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ counter, className, value, defaultValue, onChange, ...rest }, ref) {
    const [innerValue, setInnerValue] = React.useState<string>(
      typeof value === "string" ? value : (defaultValue as string) ?? ""
    );

    React.useEffect(() => {
      if (typeof value === "string") setInnerValue(value);
    }, [value]);

    const len = innerValue.length;
    const paragraphs = Math.max(1, innerValue.split(/\n{2,}/).filter(Boolean).length || 1);

    return (
      <div>
        <textarea
          ref={ref}
          className={`psd-textarea ${className ?? ""}`}
          value={typeof value === "string" ? value : undefined}
          defaultValue={typeof value === "string" ? undefined : defaultValue}
          onChange={(e) => {
            setInnerValue(e.currentTarget.value);
            onChange?.(e);
          }}
          {...rest}
        />
        {counter && (
          <div className="psd-textarea__counter">
            {len} / {counter.total} chars · {paragraphs} paragraph{paragraphs === 1 ? "" : "s"}
          </div>
        )}
      </div>
    );
  }
);
