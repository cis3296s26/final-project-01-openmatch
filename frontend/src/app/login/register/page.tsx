"use client"

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

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

        if (formData.password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        try{
            await registerUser(formData);
            toast.success("User registered successfully");
            router.push("/");
        } 
        catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to register user");
        }
    }

    async function registerUser(data: RegisterInput) {
        const res = await fetch(`${API}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        
        if(!res.ok){
            throw new Error("Failed to register user");
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
    <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">
        <div className="flex items-center justify-center">
            {/* Border around account creation interface */}
            <section className="mx-auto w-5/6 min-w-xs rounded-lg border p-40 space-y-3">
               <header className="mb-8 flex justify-center space-y-2">
                  <h1 className="text-3xl font-bold">Create Account</h1>
               </header>

                {/* Account Creation Fields */}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">First Name</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "text"
                            name = "first_name"
                            value = {formData.first_name} onChange={handleChange}
                            placeholder="First Name"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Last Name</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "text"
                            name = "last_name"
                            value = {formData.last_name} onChange={handleChange}
                            placeholder="Last Name"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Email</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "email"
                            name = "email"
                            value = {formData.email} onChange={handleChange}
                            placeholder="Email"
                        ></input>
                    </div>
                    <div className="mb-4">
                    <label className="text-xl font-medium mb-2">Username</label>
                    <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "text"
                            name = "username"
                            value = {formData.username} onChange={handleChange}
                            placeholder="Username"
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
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Confirm Password</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "password"
                            value = {confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="********"
                        ></input>
                    </div>

                    {/* Create Account Button */}
                    <div className="flex justify-center mb-4">
                        <button type="submit" className="w-1/2 border rounded-md px-3 py-2 text-center cursor-pointer hover:underline flex justify-center items-center">
                            Create Account
                        </button>
                    </div>
                </form>    
                <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                    ← Back to home
                </Link>
            </section>  
        </div>
    </main>
    );
}