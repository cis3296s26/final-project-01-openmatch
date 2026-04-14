"use client";

import { authHeaders, getUser, isAuthenticated, updateUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Sport = {
    id: number;
    name: string;
};

type ProfileSport = {
    id: number;
    profile_id: number;
    sport_id: number;
    sport_name: string;
    mmr: number;
    matches_played: number;
    wins: number;
    losses: number;
    placement_matches_remaining: number;
    rank_tier: string;
    created_at: string;
    updated_at: string;
};

export default function ProfilePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"profile" | "sports">("profile");

    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [location, setLocation] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);

    const [sports, setSports] = useState<Sport[]>([]);
    const [profileSports, setProfileSports] = useState<ProfileSport[]>([]);
    const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
    const [sportsLoading, setSportsLoading] = useState(true);
    const [sportsMessage, setSportsMessage] = useState("");
    const [addingSport, setAddingSport] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/login");
            return;
        }

        const user = getUser();
        if (user) {
            fetchProfile(user.id);
            fetchSports();
            fetchProfileSports(user.id);
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

    async function fetchSports() {
        try {
            const res = await fetch(`${API}/sports`);
            if (res.ok) {
                const data = await res.json();
                setSports(data);
            }
        } catch (err) {
            console.error("Failed to fetch sports:", err);
        }
    }

    async function fetchProfileSports(userId: number) {
        setSportsLoading(true);
        try {
            const res = await fetch(`${API}/users/${userId}/profile-sports`, {
                headers: authHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setProfileSports(data);
            }
        } catch (err) {
            console.error("Failed to fetch profile sports:", err);
        } finally {
            setSportsLoading(false);
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
                updateUser({ display_name: name });
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

    async function handleAddSport() {
        if (!selectedSportId) {
            setSportsMessage("Please select a sport");
            return;
        }

        setAddingSport(true);
        setSportsMessage("");

        try {
            const res = await fetch(`${API}/profile-sports`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ sport_id: selectedSportId }),
            });

            if (res.ok) {
                const newSport = await res.json();
                setProfileSports([...profileSports, newSport]);
                setSelectedSportId(null);
                setSportsMessage("Sport added successfully!");
            } else if (res.status === 401) {
                setSportsMessage("Session expired. Please log in again.");
                router.push("/login");
            } else {
                const err = await res.json();
                setSportsMessage(err.detail || "Failed to add sport.");
            }
        } catch {
            setSportsMessage("Error adding sport. Is the backend running?");
        } finally {
            setAddingSport(false);
        }
    }

    async function handleRemoveSport(profileSportId: number) {
        setSportsMessage("");

        try {
            const res = await fetch(`${API}/profile-sports/${profileSportId}`, {
                method: "DELETE",
                headers: authHeaders(),
            });

            if (res.ok) {
                setProfileSports(profileSports.filter((ps) => ps.id !== profileSportId));
                setSportsMessage("Sport removed from profile.");
            } else if (res.status === 401) {
                setSportsMessage("Session expired. Please log in again.");
                router.push("/login");
            } else {
                const err = await res.json();
                setSportsMessage(err.detail || "Failed to remove sport.");
            }
        } catch {
            setSportsMessage("Error removing sport. Is the backend running?");
        }
    }

    const availableSports = sports.filter(
        (sport) => !profileSports.some((ps) => ps.sport_id === sport.id)
    );

    return (
        <AuthGate>
        <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-10">
            <header className="space-y-2">
                <Link href="/dashboard" className="text-3xl font-bold hover:opacity-80 transition-opacity">
                    Open Match
                </Link>
                <p className="text-gray-600">
                    {hasProfile ? "Your profile" : "Set up your profile"}
                </p>
            </header>

            <div className="rounded-xl p-1 flex gap-2" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                <button
                    onClick={() => setActiveTab("profile")}
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                    style={activeTab === "profile" 
                        ? { background: "#1e1e1e", color: "#fafafa" }
                        : { background: "transparent", color: "#71717a" }
                    }
                >
                    Profile
                </button>
                <button
                    onClick={() => setActiveTab("sports")}
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
                    style={activeTab === "sports" 
                        ? { background: "#1e1e1e", color: "#fafafa" }
                        : { background: "transparent", color: "#71717a" }
                    }
                >
                    Sports Profile
                </button>
            </div>

            {activeTab === "profile" && (
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
            )}

            {activeTab === "sports" && (
                <section className="space-y-6">
                    {!hasProfile ? (
                        <div className="p-4 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <p style={{ color: "#fbbf24" }}>
                                Please create your profile first before adding sports.
                            </p>
                            <button
                                onClick={() => setActiveTab("profile")}
                                className="mt-2 underline transition-colors"
                                style={{ color: "#f59e0b" }}
                            >
                                Go to Profile
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="p-5 rounded-2xl space-y-4" style={{ background: "#0c0c0c", border: "1px solid #191919", boxShadow: "0 8px 40px rgba(0,0,0,0.55)" }}>
                                <h2 className="text-xl font-semibold" style={{ color: "#fafafa" }}>Add a Sport</h2>
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label htmlFor="sport-select" className="text-sm" style={{ color: "#71717a" }}>
                                            Select Sport
                                        </label>
                                        <select
                                            id="sport-select"
                                            value={selectedSportId ?? ""}
                                            onChange={(e) => setSelectedSportId(e.target.value ? Number(e.target.value) : null)}
                                            className="rounded-lg p-2.5 w-full"
                                            style={{ background: "#111", border: "1px solid #1e1e1e", color: "#e4e4e7" }}
                                        >
                                            <option value="">Choose a sport...</option>
                                            {availableSports.map((sport) => (
                                                <option key={sport.id} value={sport.id}>
                                                    {sport.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleAddSport}
                                        disabled={addingSport || !selectedSportId}
                                        className="rounded-lg p-2.5 px-6 transition-colors disabled:opacity-50"
                                        style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#a1a1aa" }}
                                    >
                                        {addingSport ? "Adding..." : "Add Sport"}
                                    </button>
                                </div>
                                {availableSports.length === 0 && (
                                    <p className="text-sm italic" style={{ color: "#52525b" }}>
                                        You have added all available sports to your profile.
                                    </p>
                                )}
                                {sportsMessage && (
                                    <p className={`text-sm ${sportsMessage.includes("successfully") || sportsMessage.includes("removed") ? "text-green-400" : "text-red-400"}`}>
                                        {sportsMessage}
                                    </p>
                                )}
                            </div>

                            <div className="p-5 rounded-2xl space-y-4" style={{ background: "#0c0c0c", border: "1px solid #191919", boxShadow: "0 8px 40px rgba(0,0,0,0.55)" }}>
                                <h2 className="text-xl font-semibold" style={{ color: "#fafafa" }}>Your Sports</h2>

                                {sportsLoading ? (
                                    <div className="py-8 text-center" style={{ color: "#52525b" }}>Loading...</div>
                                ) : profileSports.length === 0 ? (
                                    <p className="italic" style={{ color: "#52525b" }}>
                                        You haven&apos;t added any sports yet. Add a sport above to get started!
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {profileSports.map((ps) => (
                                            <div
                                                key={ps.id}
                                                className="p-4 rounded-xl space-y-3"
                                                style={{ background: "#111", border: "1px solid #1e1e1e" }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-semibold" style={{ color: "#fafafa" }}>{ps.sport_name}</h3>
                                                    <span 
                                                        className="px-2.5 py-1 rounded-md text-xs font-semibold"
                                                        style={ps.rank_tier === "Unranked" 
                                                            ? { background: "#1e1e1e", color: "#71717a" }
                                                            : { background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" }
                                                        }
                                                    >
                                                        {ps.rank_tier}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <span style={{ color: "#52525b" }}>MMR:</span>{" "}
                                                        <span className="font-medium" style={{ color: "#e4e4e7" }}>{ps.mmr}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: "#52525b" }}>Matches:</span>{" "}
                                                        <span className="font-medium" style={{ color: "#e4e4e7" }}>{ps.matches_played}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: "#52525b" }}>Wins:</span>{" "}
                                                        <span className="font-medium" style={{ color: "#4ade80" }}>{ps.wins}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: "#52525b" }}>Losses:</span>{" "}
                                                        <span className="font-medium" style={{ color: "#f87171" }}>{ps.losses}</span>
                                                    </div>
                                                </div>

                                                {ps.placement_matches_remaining > 0 && (
                                                    <p className="text-xs" style={{ color: "#52525b" }}>
                                                        {ps.placement_matches_remaining} placement match{ps.placement_matches_remaining !== 1 ? "es" : ""} remaining
                                                    </p>
                                                )}

                                                <button
                                                    onClick={() => handleRemoveSport(ps.id)}
                                                    className="text-sm transition-colors"
                                                    style={{ color: "#ef4444" }}
                                                >
                                                    Remove Sport
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            )}
        </main>
        </AuthGate>
    );
}
