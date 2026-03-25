"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Status = "success" | "error" | "loading";

export default function VerificationClient() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<Status>("loading");
    const [message, setMessage] = useState("Verifying...");

    useEffect(() => {
        let cancelled = false;

        async function verify() {
            const plaintextToken = searchParams.get("token");

            if (!plaintextToken) {
                if (!cancelled) {
                    setStatus("error");
                    setMessage("Invalid token in verification link!");
                }
                return;
            }

            try {
                const url = `${API}/verify?token=${encodeURIComponent(plaintextToken)}`;
                console.log("VERIFY FETCH TARGET:", url);

                const res = await fetch(url);

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
            } catch {
                if (!cancelled) {
                    setStatus("error");
                    setMessage("Uh oh! Something went wrong!");
                }
            }
        }

        verify();

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
                        <Link href="/login" className="text-blue-600 hover:underline">
                            Go to login now
                        </Link>
                    )}
                </section>
            </div>
        </main>
    );
}