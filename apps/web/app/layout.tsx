import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AdhocPrintStudio",
  description: "AdhocPrintStudio web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-body">{children}</body>
    </html>
  );
}
