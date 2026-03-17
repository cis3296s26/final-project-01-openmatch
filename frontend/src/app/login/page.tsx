import Link from "next/link";

export default function LoginPage() {
    return (
        <main className="min-h-screen p-8 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold">Login</h1>
            <p className="text-gray-600 mt-2">Login page — fields need to be added</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                ← Back to home
            </Link>
        </main>
    );
}