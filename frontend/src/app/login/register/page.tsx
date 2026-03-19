import Link from "next/link";

type User ={
    id: number;
    display_name: string;
    email: string;
    username: string;
    password: string;
    sports: string[];
    location: string;
    skill_level: string;
    bio: string;
    created_at: string;
    updated_at: string;
}

export default function RegisterPage() {
    return (
<main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">

            <div className="flex items-center justify-center">
                {/* Border around login interface */}
                <section className="mx-auto w-5/6 min-w-xs rounded-lg border p-40 space-y-3">
                    {/* Login Header */}
                    <header className="mb-8 flex justify-center space-y-2">
                        <h1 className="text-3xl font-bold">Create Account</h1>
                    </header>

                    {/* Account Creation Fields */}
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Email</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "email"
                            placeholder="Email"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Username</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "username"
                            placeholder="Username"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Password</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "password"
                            placeholder="********"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Confirm Password</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "password"
                            placeholder="********"
                        ></input>
                    </div>


                    {/* Create Account Button */}
                    <div className="flex justify-center mb-4">
                        <Link href="/login/register" className="w-1/2 border rounded-md px-3 py-2 text-center hover:underline flex justify-center items-center">
                            Create Account
                        </Link>
                    </div>

                    <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                        ← Back to home
                    </Link>

                </section>
            
            </div>
        </main>
    );
}