"use client";
import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "./VisuallyHidden";

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const Root = ({ open, defaultOpen, onOpenChange, size = "md", children }: ModalProps) => (
  <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
    <ModalSizeContext.Provider value={size}>{children}</ModalSizeContext.Provider>
  </RadixDialog.Root>
);

const ModalSizeContext = React.createContext<"sm" | "md" | "lg">("md");

const Trigger = RadixDialog.Trigger;

interface ContentProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  hideTitle?: boolean;
}

const Content = React.forwardRef<HTMLDivElement, ContentProps>(
  function ModalContent({ title, description, hideTitle, className, children, ...rest }, ref) {
    const size = React.useContext(ModalSizeContext);
    return (
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="psd-modal-overlay" />
        <RadixDialog.Content
          ref={ref}
          className={`psd-modal-content psd-modal-content--${size} ${className ?? ""}`}
          {...rest}
        >
          {hideTitle ? (
            <VisuallyHidden>
              <RadixDialog.Title>{title}</RadixDialog.Title>
            </VisuallyHidden>
          ) : (
            <div className="psd-modal-header">
              <RadixDialog.Title className="psd-modal-title">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="psd-modal-description">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    );
  }
);

const Body = ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`psd-modal-body ${className ?? ""}`} {...rest}>{children}</div>
);

const Footer = ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`psd-modal-footer ${className ?? ""}`} {...rest}>{children}</div>
);

const Close = RadixDialog.Close;

export const Modal = Object.assign(Root, { Trigger, Content, Body, Footer, Close });
