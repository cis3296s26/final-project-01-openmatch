"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Status = "success" | "error" | "loading";

export default function VerificationPage({
  params,
}: {
  params: { token: string };
}) {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = params.token;

      console.log("VERIFY TOKEN:", token);

      if (!token) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Invalid token in verification link!");
        }
        return;
      }

      try {
        const url = `${API}/verify?token=${encodeURIComponent(token)}`;
        console.log("VERIFY FETCH:", url);

        const res = await fetch(url);

        console.log("VERIFY STATUS:", res.status);

        if (!res.ok) {
          throw new Error("Verification failed");
        }

        if (!cancelled) {
          setStatus("success");
          setMessage("Verification successful! Redirecting to login...");

          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } catch (err) {
        console.error("VERIFY ERROR:", err);

        if (!cancelled) {
          setStatus("error");
          setMessage("Verification failed. Please try again.");
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [params.token, router]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-8 flex items-center justify-center">
      <section className="w-full max-w-md border rounded-lg p-6 text-center space-y-4">
        <h1 className="text-xl font-bold">Email Verification</h1>

        <p>{message}</p>

        {status === "success" && (
          <Link
            href="/login"
            className="text-blue-600 hover:underline block"
          >
            Go to login now
          </Link>
        )}
      </section>
    </main>
  );
}