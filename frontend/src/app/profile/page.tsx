"use client";

import { authHeaders, getUser, isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function ProfilePage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [location, setLocation] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/login");
            return;
        }

        const user = getUser();
        if (user) {
            fetchProfile(user.id);
        }
    }, [router]);

    async function fetchProfile(userId: number) {
        try {
            const res = await fetch(`${API}/users/${userId}/profile`, {
                headers: authHeaders(),
            });

            if (res.ok) {
                const profile = await res.json();
                setName(profile.display_name);
                setBio(profile.bio || "");
                setLocation(profile.location || "");
                setHasProfile(true);
            } else {
                const user = getUser();
                if (user) {
                    setName(`${user.first_name} ${user.last_name}`);
                }
                setIsEditing(true);
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
            const user = getUser();
            if (user) {
                setName(`${user.first_name} ${user.last_name}`);
            }
            setIsEditing(true);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            const res = await fetch(`${API}/profiles`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    display_name: name,
                    bio: bio || null,
                    location: location || null,
                }),
            });

            if (res.ok) {
                setMessage("Profile saved successfully!");
                setHasProfile(true);
                setIsEditing(false);
            } else if (res.status === 401) {
                setMessage("Session expired. Please log in again.");
                router.push("/login");
            } else {
                const err = await res.json();
                setMessage(err.detail || "Failed to save profile.");
            }
        } catch {
            setMessage("Error saving profile. Is the backend running?");
        } finally {
            setSaving(false);
        }
    }

    function handleCancel() {
        const user = getUser();
        if (user && hasProfile) {
            fetchProfile(user.id);
        }
        setIsEditing(false);
        setMessage("");
    }

    return (
        <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-10">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold">Open Match</h1>
                    <Link
                        href="../dashboard"
                        className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        Back to Home
                    </Link>
                </div>
                <p className="text-gray-600">
                    {hasProfile ? "Your profile" : "Set up your profile"}
                </p>
            </header>

            <section className="p-4 rounded-lg border space-y-3">
                <h2 className="text-xl font-semibold">Profile Details</h2>

                {loading ? (
                    <div className="py-8 text-center text-gray-500">Loading...</div>
                ) : isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label htmlFor="name" className="text-sm text-gray-600">Display Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="border rounded p-2 w-full"
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="location" className="text-sm text-gray-600">Location</label>
                                <input
                                    id="location"
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="border rounded p-2 w-full"
                                    placeholder="City, State"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="bio" className="text-sm text-gray-600">Bio</label>
                            <textarea
                                id="bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={4}
                                className="border rounded p-2 w-full resize-none"
                                placeholder="Write a short bio about yourself..."
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="border rounded p-2 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Profile"}
                            </button>
                            {hasProfile && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="border rounded p-2 px-6 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            {message && (
                                <p className={`text-sm ${message.includes("successfully") ? "text-green-600" : "text-red-600"}`}>
                                    {message}
                                </p>
                            )}
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-sm text-gray-600">Display Name</span>
                                <p className="font-medium">{name}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-sm text-gray-600">Location</span>
                                <p className="font-medium">{location || <span className="text-gray-400 italic">Not set</span>}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-gray-600">Bio</span>
                            <p className="font-medium">{bio || <span className="text-gray-400 italic">Not set</span>}</p>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="border rounded p-2 px-6 hover:bg-gray-50 transition-colors"
                        >
                            Edit Profile
                        </button>
                    </div>
                )}
            </section>
        </main>
    );
}
