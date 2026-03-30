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

export default function LoginPage() {
    const router = useRouter();

    const [formData, setFormData] = useState<LoginInput>({
        login: "",
        password: "",
    });

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
            throw new Error(error.detail || "Failed to login");
        }

        return res.json();
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">

            {/* Login Interface */}
            <div className="flex items-center justify-center">
                {/* Border around login interface */}
                <section className="mx-auto w-3/5 min-w-xs rounded-lg border p-8 space-y-3">
                    {/* Login Header */}
                    <header className="mb-8 flex justify-center space-y-2">
                        <h1 className="text-3xl font-bold">Login</h1>
                    </header>

                    {/* Username and Password fields */}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="text-xl font-medium mb-2">Username or Email</label>
                            <input className="w-full bg-gray border rounded-md px-3 py-1"
                                type = "text"
                                name = "login"
                                value = {formData.login} onChange={handleChange}
                                placeholder="Username or Email"
                            ></input>
                        </div>
                        <div className="mb-4">
                            <label className="text-xl font-medium mb-2">Password</label>
                            <input className="w-full bg-gray border rounded-md px-3 py-1"
                                type = "password"
                                name = "password"
                                value = {formData.password} onChange={handleChange}
                                placeholder="********"
                            ></input>
                            <a className="text-l text-blue-400 decoration-white hover:underline"
                                href="FORGOT_PASSWORD_LINK_PLACEHOLDER"
                            >Forgot Password?</a>
                        </div>
                        {/* Sign in Button */}
                        <div className="flex justify-center mb-8">
                            <button type="submit" className="w-1/2 border rounded-md px-3 py-2 cursor-pointer hover:underline">
                                Sign in
                            </button>
                        </div>
                    </form>

                    {/* Divider */}
                    <div className="flex-1 h-px bg-white mb-8"></div>

                    {/* Create Account Button */}
                    <div className="flex justify-center mb-4">
                        <Link href="/login/register" className="w-1/2 border rounded-md px-3 py-2 text-center hover:underline flex justify-center items-center">
                            Create New Account
                        </Link>
                    </div>

                </section>
            </div>

            <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                ← Back to home
            </Link>
        </main>
    );
}