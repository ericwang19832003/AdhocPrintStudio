"use client";

import dynamic from "next/dynamic";

const BuilderClient = dynamic(() => import("./BuilderClient"), { ssr: false });

export default function ClientShell() {
  return <BuilderClient />;
}
