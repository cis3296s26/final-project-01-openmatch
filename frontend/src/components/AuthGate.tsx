"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setAllowed(true);
    }
  }, [router]);

  if (!allowed) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid #222", borderTopColor: "#34d399", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
