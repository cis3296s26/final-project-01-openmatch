"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type status = "success" | "error" | "loading";


export default function VerificationPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<status>("loading");
    const [message, setMessage] = useState("Verifying...");


    useEffect(() => {
        async function verify() {
            const plaintext_token = searchParams.get("token");

            //     Handle no token found in URL
            if (!plaintext_token) {
                setStatus("error");
                setMessage("Invalid token in verification link!");
            }

            try {
                const res = await fetch(`${API}/verify?token=${plaintext_token}`);

                if (!res.ok) throw new Error("Verification failed");

                setStatus("success");
                setMessage("Verification successful! Redirecting to login...");
                setTimeout(() => router.push("/login"), 2000);
            } catch (err) {
                setStatus("error");
                setMessage("Uh Oh!! Something went wrong!");
            }
        }

        verify()
    }, [searchParams, router]);

    return (
        <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">
            <div className="flex items-center justify-center">
                <section className="mx-auto w-3/5 min-w-xs rounded-lg border p-8 space-y-3">
                    {status === "success" && <p>{message}</p>}
                    {status === "error" && <p>{message}</p>}
                    {status === "loading" && <p>{message}</p>}
                </section>
            </div>
        </main>
    )
}
