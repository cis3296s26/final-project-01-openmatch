"use client"

import { saveAuth, type AuthResponse } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type LoginInput = {
    login: string;
    password: string;
};

type LoginError = {
    status: number;
    status_text: string;
};

export default function LoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState<LoginInput>({
        login: "",
        password: "",
    });

    const [loginErrorState, setLoginErrorState] = useState<LoginError>({
        status: 0,
        status_text: ""
    })

    const [label, setLabel] = useState("Click here to send a new verification link!");

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();

        try {
            const authResponse = await loginUser(formData);
            saveAuth(authResponse);
            toast.success("Logged in successfully");
            router.push("../dashboard");
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to Login");
        }
    }

    async function loginUser(data: LoginInput): Promise<AuthResponse> {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const error = await res.json();
            setLoginErrorState({
                status: res.status,
                status_text: res.statusText
            })
            throw new Error(error.detail || "Failed to login");
        }

        return res.json();
    }

    async function handleResendVerification(e: React.MouseEvent) {
        e.preventDefault();
        setLabel("Sending...")

        const payload = formData;
        const res = await fetch(`${API}/resendVerification`, {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        setLabel("Sent!")
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
                *, *::before, *::after { box-sizing: border-box; }

                .login-input {
                    width: 100%;
                    background: #111;
                    border: 1px solid #222;
                    border-radius: 10px;
                    padding: 11px 14px;
                    font-size: 13px;
                    color: #e4e4e7;
                    font-family: 'DM Sans', sans-serif;
                    outline: none;
                    transition: border-color 0.15s;
                    display: block;
                    margin-top: 6px;
                }
                .login-input::placeholder { color: #3f3f46; }
                .login-input:focus { border-color: rgba(52,211,153,0.35); }

                .cta-primary {
                    display: inline-flex; align-items: center; justify-content: center;
                    background: linear-gradient(135deg, #047857, #10b981 55%, #34d399);
                    color: #fff; border: none; border-radius: 12px;
                    padding: 13px 28px; font-size: 14px; font-weight: 700;
                    letter-spacing: 0.01em; cursor: pointer; font-family: 'DM Sans', sans-serif;
                    transition: transform 0.1s, box-shadow 0.2s;
                    text-decoration: none; width: 100%;
                }
                .cta-primary:active { transform: scale(0.97); }

                .cta-ghost {
                    display: inline-flex; align-items: center; justify-content: center;
                    background: transparent; border: 1px solid #222; border-radius: 12px;
                    padding: 13px 28px; font-size: 14px; font-weight: 600; color: #71717a;
                    cursor: pointer; font-family: 'DM Sans', sans-serif;
                    transition: border-color 0.15s, color 0.15s;
                    text-decoration: none; width: 100%;
                }
                .cta-ghost:hover { border-color: #333; color: #d4d4d8; }
            `}</style>

            <main style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px", position: "relative" }}>

                {/* Glow orb */}
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />

                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#080808" }}>
                        OM
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.025em", color: "#fafafa" }}>OpenMatch</span>
                </div>

                {/* Card */}
                <section style={{ width: "100%", maxWidth: 420, background: "#0c0c0c", border: "1px solid #191919", borderRadius: 22, padding: "36px 32px", boxShadow: "0 40px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(52,211,153,0.04)", position: "relative", zIndex: 1 }}>

                    {/* Header */}
                    <header style={{ marginBottom: 28, textAlign: "center" }}>
                        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", margin: 0 }}>Welcome back</h1>
                        <p style={{ fontSize: 13, color: "#8d8d8d", marginTop: 6 }}>Sign in to your OpenMatch account</p>
                    </header>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Username or Email</label>
                            <input
                                className="login-input"
                                type="text"
                                name="login"
                                value={formData.login}
                                onChange={handleChange}
                                placeholder="Username or email"
                            />
                        </div>

                        <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Password</label>
                            <input
                                className="login-input"
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                            />
                        </div>

                        <div style={{ textAlign: "right", marginBottom: 24 }}>
                            <a href="FORGOT_PASSWORD_LINK_PLACEHOLDER" style={{ fontSize: 12, color: "#34d399", textDecoration: "none" }}
                                onMouseOver={e => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseOut={e => (e.currentTarget.style.textDecoration = "none")}
                            >
                                Forgot password?
                            </a>
                        </div>

                        <button type="submit" className="cta-primary">
                            Sign in
                        </button>
                    </form>

                    {/* Error state */}
                    {loginErrorState?.status === 403 && (
                        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#a1a1aa" }}>
                            <p>Email for this account is not verified.</p>
                            <Link
                                href="google.com"
                                onClick={handleResendVerification}
                                style={{ color: "#34d399", textDecoration: "none", fontWeight: 600 }}
                                onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "none")}
                            >
                                {label}
                            </Link>
                        </div>
                    )}

                    {/* Divider */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "#191919" }} />
                        <span style={{ fontSize: 11, color: "#3f3f46", letterSpacing: "0.08em" }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: "#191919" }} />
                    </div>

                    {/* Create account */}
                    <Link href="/login/register" className="cta-ghost">
                        Create new account
                    </Link>
                </section>

                {/* Back link */}
                <Link href="/" style={{ marginTop: 28, fontSize: 13, color: "#34d399", textDecoration: "none", position: "relative", zIndex: 1 }}
                    onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "none")}
                >
                    ← Back to home
                </Link>

            </main>
        </>
    );
}