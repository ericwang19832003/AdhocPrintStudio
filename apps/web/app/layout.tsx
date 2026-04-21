import type { ReactNode } from "react";
import "@/design/reset.css";
import "./globals.css";
import "@/design/tokens.css";
import "@/design/styles/primitives.css";
import { sans, serif, mono } from "@/design/fonts";

export const metadata = {
  title: "AdhocPrintStudio",
  description: "AdhocPrintStudio web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/*
        Font CSS variables (--font-sans, --font-serif, --font-mono) are attached
        to <body> so they're available to design-system primitives. The existing
        Builder font-family rules in globals.css continue to win for legacy code.
        New design components opt in via var(--font-sans) etc. inside their own CSS.
      */}
      <body className={`app-body ${sans.variable} ${serif.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
