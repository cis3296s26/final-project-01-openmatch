"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Status = "success" | "error" | "loading";

function VerificationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<Status>("loading");
    const [message, setMessage] = useState("Verifying...");

    useEffect(() => {
        async function verify() {
            const plaintext_token = searchParams.get("token");

            if (!plaintext_token) {
                setStatus("error");
                setMessage("Invalid token in verification link!");
                return;
            }

            try {
                const res = await fetch(`${API}/verify?token=${encodeURIComponent(plaintext_token)}`);

                if (!res.ok) {
                    throw new Error("Verification failed");
                }

                setStatus("success");
                setMessage("Verification successful! Redirecting to login...");
                setTimeout(() => router.push("/login"), 2000);
            } catch {
                setStatus("error");
                setMessage("Uh oh! Something went wrong!");
            }
        }

        verify();
    }, [searchParams, router]);

    return (
        <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">
            <div className="flex items-center justify-center">
                <section className="mx-auto w-3/5 min-w-xs rounded-lg border p-8 space-y-3">
                    <p>{message}</p>
                </section>
            </div>
        </main>
    );
}

export default function VerificationPage() {
    return (
        <Suspense fallback={<p className="p-8">Loading...</p>}>
            <VerificationContent />
        </Suspense>
    );
}