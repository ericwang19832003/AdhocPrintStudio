import * as React from "react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description, className, children, ...rest }: EmptyStateProps) {
  return (
    <div className={`psd-empty-state ${className ?? ""}`} {...rest}>
      {icon && <div className="psd-empty-state__icon">{icon}</div>}
      <div className="psd-empty-state__title">{title}</div>
      {description && <div className="psd-empty-state__description">{description}</div>}
      {children && <div className="psd-empty-state__actions">{children}</div>}
    </div>
  );
}
