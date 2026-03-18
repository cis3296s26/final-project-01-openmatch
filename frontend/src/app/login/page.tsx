import Link from "next/link";
import { type } from '../../../.next/dev/types/routes';

export default function LoginPage() {
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
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Username</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "email"
                            placeholder="Username"
                        ></input>
                    </div>
                    <div className="mb-4">
                        <label className="text-xl font-medium mb-2">Password</label>
                        <input className="w-full bg-gray border rounded-md px-3 py-1"
                            type = "password"
                            placeholder="********"
                        ></input>
                        <a className="text-l text-blue-400 decoration-white hover:underline"
                            href="FORGOT_PASSWORD_LINK_PLACEHOLDER"
                        >Forgot Password?</a>
                    </div>

                    {/* Sign in Button */}
                    <div className="flex justify-center mb-8">
                        <button className="w-1/2 border rounded-md px-3 py-2 hover:underline">
                            Sign in
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex-1 h-px bg-white mb-8"></div>

                    {/* Create Account Button */}
                    <div className="flex justify-center mb-4">
                        <button className="w-1/2 border rounded-md px-3 py-2 hover:underline">
                            Create New Account
                        </button>
                    </div>

                </section>
            </div>

            <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                ← Back to home
            </Link>
        </main>
    );
}