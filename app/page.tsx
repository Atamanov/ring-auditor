"use client";

import dynamic from "next/dynamic";

const Auditor = dynamic(() => import("@/components/Auditor"), { ssr: false });

export default function Page() {
  return <Auditor />;
}
