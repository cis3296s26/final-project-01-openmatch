import Link from "next/link";

export default function RegisterPage() {
    return (
        <main className="min-h-screen max-w-5xl mx-auto p-8 space-y-10">

            <div className="flex justify-center mb-4">
                <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                    ← Back to home
                </Link>
            </div>
        </main>
    );
}