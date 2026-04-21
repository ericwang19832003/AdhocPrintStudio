"use client";

import dynamic from "next/dynamic";

// Loads the legacy Builder from app/BuilderClient.tsx — unchanged.
const BuilderClient = dynamic(() => import("../BuilderClient"), { ssr: false });

export default function ClientShell() {
  return <BuilderClient />;
}
