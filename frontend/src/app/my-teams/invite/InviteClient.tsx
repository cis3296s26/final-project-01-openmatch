"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Status = "success" | "error" | "loading";

export default function InviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    let cancelled = false;

    async function invite() {
      const token = searchParams.get("token");

      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Invalid token in invite link!");
        }
        return;
      }

      try {
        const url = `${API}/teams/invite?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
            method: "POST",
            headers: authHeaders()
        });


        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || "Joining from invite failed");
        }

        const { team_id } = await res.json();
        if (!cancelled) {
          setStatus("success");
          setMessage("Invite successful! Redirecting to team page...");
          setTimeout(() => router.push(`/my-teams/${team_id}`), 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Uh oh! Something went wrong!");
        }
      }
    }

    invite();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">
      <div className="flex items-center justify-center">
        <section className="mx-auto w-3/5 min-w-xs rounded-lg border p-8 space-y-3">
          <p>{message}</p>
          {status === "success" && (
            <Link href="/" className="text-blue-600 hover:underline">
              Return to home page
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}