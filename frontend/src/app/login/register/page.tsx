"use client"

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type RegisterInput = {
    first_name: string;
    last_name: string;
    email: string;
    username: string;
    password: string;
};

export default function RegisterPage() {
    const router = useRouter();

    useEffect(() => {
        if (getToken()) router.replace("/dashboard");
    }, [router]);

    const [formData, setFormData] = useState<RegisterInput>({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        password: "",
    });

    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("submit fired");

    if (formData.password !== confirmPassword) {
        console.log("password mismatch");
        toast.error("Passwords do not match");
        return;
    }

    try {
        console.log("sending request", formData);
        await registerUser(formData);
        console.log("register success");
        toast.success("User registered successfully");
        router.push("/login");
    } catch (err) {
        console.error("register failed", err);
        toast.error(err instanceof Error ? err.message : "Failed to register user");
    }
};

    async function registerUser(data: RegisterInput) {
        const res = await fetch(`${API}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if(!res.ok){
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || "Failed to register user");
        }

        const user = await res.json();
        return user;
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

                .register-input {
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
                .register-input::placeholder { color: #3f3f46; }
                .register-input:focus { border-color: rgba(52,211,153,0.35); }

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
                        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", margin: 0 }}>Create account</h1>
                        <p style={{ fontSize: 13, color: "#8d8d8d", marginTop: 6 }}>Join OpenMatch and get on the field</p>
                    </header>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>

                        {/* First & Last name row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>First name</label>
                                <input
                                    className="register-input"
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    placeholder="First"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Last name</label>
                                <input
                                    className="register-input"
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    placeholder="Last"
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Email</label>
                            <input
                                className="register-input"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Username</label>
                            <input
                                className="register-input"
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Pick a username"
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Password</label>
                            <input
                                className="register-input"
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                            />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.01em" }}>Confirm password</label>
                            <input
                                className="register-input"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className="cta-primary">
                            Create account
                        </button>
                    </form>

                    {/* Divider */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "#191919" }} />
                        <span style={{ fontSize: 11, color: "#3f3f46", letterSpacing: "0.08em" }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: "#191919" }} />
                    </div>

                    {/* Sign in link */}
                    <Link href="/login" className="cta-ghost">
                        Already have an account? Sign in
                    </Link>

                </section>

                {/* Back link */}
                <Link
                    href="/"
                    style={{ marginTop: 28, fontSize: 13, color: "#34d399", textDecoration: "none", position: "relative", zIndex: 1 }}
                    onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.textDecoration = "none")}
                >
                    ← Back to home
                </Link>

            </main>
        </>
    );
}