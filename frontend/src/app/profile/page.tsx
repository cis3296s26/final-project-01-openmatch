"use client";

import { authHeaders, getUser, isAuthenticated, updateUser } from "@/lib/auth";
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

const SPORT_COLORS: Record<string, string> = {
    "Soccer": "#4ade80",
    "Basketball": "#fb923c",
    "Tennis": "#facc15",
    "Pickleball": "#a78bfa",
    "Volleyball": "#f472b6",
    "Flag Football": "#60a5fa",
    "Badminton": "#34d399",
    "Softball": "#fbbf24",
    "Ultimate Frisbee": "#c084fc",
    "Hockey": "#38bdf8",
    "Rugby": "#fb7185",
    "Lacrosse": "#2dd4bf",
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
        if (!isAuthenticated()) { router.push("/login"); return; }
        const user = getUser();
        if (user) {
            fetchProfile(user.id);
            fetchSports();
            fetchProfileSports(user.id);
        }
    }, [router]);

    async function fetchProfile(userId: number) {
        try {
            const res = await fetch(`${API}/users/${userId}/profile`, { headers: authHeaders() });
            if (res.ok) {
                const profile = await res.json();
                setName(profile.display_name);
                setBio(profile.bio || "");
                setLocation(profile.location || "");
                setHasProfile(true);
            } else {
                const user = getUser();
                if (user) setName(`${user.first_name} ${user.last_name}`);
                setIsEditing(true);
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
            const user = getUser();
            if (user) setName(`${user.first_name} ${user.last_name}`);
            setIsEditing(true);
        } finally { setLoading(false); }
    }

    async function fetchSports() {
        try {
            const res = await fetch(`${API}/sports`);
            if (res.ok) { const data = await res.json(); setSports(data); }
        } catch (err) { console.error("Failed to fetch sports:", err); }
    }

    async function fetchProfileSports(userId: number) {
        setSportsLoading(true);
        try {
            const res = await fetch(`${API}/users/${userId}/profile-sports`, { headers: authHeaders() });
            if (res.ok) { const data = await res.json(); setProfileSports(data); }
        } catch (err) { console.error("Failed to fetch profile sports:", err); }
        finally { setSportsLoading(false); }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage("");
        try {
            const res = await fetch(`${API}/profiles`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ display_name: name, bio: bio || null, location: location || null }),
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
        } catch { setMessage("Error saving profile. Is the backend running?"); }
        finally { setSaving(false); }
    }

    function handleCancel() {
        const user = getUser();
        if (user && hasProfile) fetchProfile(user.id);
        setIsEditing(false);
        setMessage("");
    }

    async function handleAddSport() {
        if (!selectedSportId) { setSportsMessage("Please select a sport"); return; }
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
        } catch { setSportsMessage("Error adding sport. Is the backend running?"); }
        finally { setAddingSport(false); }
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
        } catch { setSportsMessage("Error removing sport. Is the backend running?"); }
    }

    const availableSports = sports.filter(
        (sport) => !profileSports.some((ps) => ps.sport_id === sport.id)
    );

    const user = getUser();
    const initials = user
        ? user.display_name
            ? user.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
            : `${user.first_name[0]}${user.last_name?.[0] ?? ""}`
        : "?";

    const totalWins   = profileSports.reduce((a, s) => a + s.wins, 0);
    const totalLosses = profileSports.reduce((a, s) => a + s.losses, 0);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .card { background: #0c0c0c; border: 1px solid #191919; border-radius: 20px; }

                .ghost-btn {
                    background: transparent; border: 1px solid #1e1e1e; border-radius: 10px;
                    padding: 10px 22px; font-size: 14px; color: #52525b; cursor: pointer;
                    font-family: 'DM Sans', sans-serif; font-weight: 500;
                    transition: border-color 0.15s, color 0.15s; white-space: nowrap;
                }
                .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
                .ghost-btn:disabled { opacity: 0.35; cursor: not-allowed; }

                .danger-btn {
                    background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.16);
                    border-radius: 10px; padding: 10px 22px; font-size: 14px; color: #ef4444;
                    cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500;
                    transition: background 0.15s;
                }
                .danger-btn:hover { background: rgba(239,68,68,0.09); }

                .primary-btn {
                    background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
                    border: none; border-radius: 10px; padding: 12px 28px; font-size: 14px;
                    font-weight: 700; color: #fff; cursor: pointer; font-family: inherit;
                    letter-spacing: -0.01em; transition: opacity 0.15s;

                }
                .primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                .nav-btn {
                    background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
                    font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif;
                    transition: all 0.15s; text-decoration: none; display: inline-block;
                }
                .nav-btn:hover { color: #a1a1aa; }
                .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }

                .form-input {
                    width: 100%; background: #111; border: 1px solid #1e1e1e; border-radius: 10px;
                    padding: 13px 16px; color: #e4e4e7; font-size: 15px; font-family: inherit;
                    transition: border-color 0.15s; line-height: 1.5;
                }
                .form-input:focus { outline: none; border-color: #34d399; }
                .form-input::placeholder { color: #3f3f46; }

                .form-label {
                    display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
                    text-transform: uppercase; color: #52525b; margin-bottom: 8px;
                }

                .tab-pill {
                    padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;
                    cursor: pointer; border: none; font-family: 'DM Sans', sans-serif;
                    transition: background 0.15s, color 0.15s; letter-spacing: -0.01em;
                }

                .stat-cell {
                    background: #0c0c0c; border: 1px solid #191919; border-radius: 12px; padding: 16px 20px;
                }

                .field-view {
                    background: #111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 20px 24px;
                }

                .sport-card {
                    background: #111; border: 1px solid #1e1e1e; border-radius: 20px;
                    padding: 28px 30px; display: flex; flex-direction: column; gap: 22px;
                    transition: border-color 0.2s;
                }
                .sport-card:hover { border-color: #2a2a2a; }
            `}</style>

            <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif" }}>

                {/* ── Header (identical to dashboard) ── */}
                <header style={{ borderBottom: "1px solid #141414", background: "rgba(8,8,8,0.97)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 50 }}>
                    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#080808", boxShadow: "0 0 18px rgba(52,211,153,0.35)" }}>
                                    OM
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.025em", color: "#fafafa" }}>OpenMatch</span>
                            </div>
                            <nav style={{ display: "flex", gap: 2 }}>
                                {[
                                    { label: "Dashboard", href: "/dashboard" },
                                    { label: "Find a Match", href: "/find-a-match" },
                                    { label: "My Teams", href: "/my-teams" },
                                    { label: "Fields", href: "/fields" },
                                    { label: "Profile", href: "/profile" },
                                ].map((item) => (
                                    <Link key={item.label} href={item.href} className={`nav-btn${item.label === "Profile" ? " active" : ""}`} style={{ textDecoration: "none" }}>
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#71717a" }}>
                            {initials}
                        </div>
                    </div>
                </header>

                <main style={{ maxWidth: 1280, margin: "0 auto", padding: "52px 28px 96px" }}>

                    {/* ── Hero row ── */}
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 44, gap: 24, flexWrap: "wrap" }}>
                        <div>
                            <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.045em", color: "#fafafa", lineHeight: 1 }}>
                                {hasProfile ? (name || "Your Profile") : "Set Up Profile"}
                            </h1>
                            <p style={{ marginTop: 12, fontSize: 14, color: "#3f3f46" }}>

                            </p>
                        </div>

                        {/* Tab switcher */}
                        <div style={{ display: "flex", gap: 4, background: "#0c0c0c", border: "1px solid #191919", borderRadius: 14, padding: 4 }}>
                            <button className="tab-pill" onClick={() => setActiveTab("profile")}
                                style={activeTab === "profile" ? { background: "#1e1e1e", color: "#fafafa" } : { background: "transparent", color: "#52525b" }}>
                                Profile
                            </button>
                            <button className="tab-pill" onClick={() => setActiveTab("sports")}
                                style={activeTab === "sports" ? { background: "#1e1e1e", color: "#fafafa" } : { background: "transparent", color: "#52525b" }}>
                                Sports &amp; Rankings
                            </button>
                        </div>
                    </div>

                    {/* ════════════ PROFILE TAB ════════════ */}
                    {activeTab === "profile" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>

                            {/* Main form / view card */}
                            <div className="card" style={{ padding: "44px 48px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
                                    <h2 style={{ fontSize: 18, fontWeight: 600, color: "#d4d4d8" }}>Profile Details</h2>
                                    {hasProfile && !isEditing && (
                                        <button className="ghost-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                                    )}
                                </div>

                                {loading ? (
                                    <div style={{ padding: "64px 0", textAlign: "center", color: "#3f3f46", fontSize: 15 }}>Loading...</div>
                                ) : isEditing ? (
                                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                            <div>
                                                <label className="form-label" htmlFor="name">Display Name</label>
                                                <input id="name" type="text" className="form-input" value={name}
                                                    onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor="location">Location</label>
                                                <input id="location" type="text" className="form-input" value={location}
                                                    onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label" htmlFor="bio">Bio</label>
                                            <textarea id="bio" className="form-input" value={bio}
                                                onChange={(e) => setBio(e.target.value)} rows={6}
                                                placeholder="Tell other players about yourself — your experience, favourite positions, availability..."
                                                style={{ resize: "none" }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
                                            <button type="submit" className="primary-btn" disabled={saving}>
                                                {saving ? "Saving..." : "Save Profile"}
                                            </button>
                                            {hasProfile && (
                                                <button type="button" className="ghost-btn" onClick={handleCancel}>Cancel</button>
                                            )}
                                            {message && (
                                                <span style={{ fontSize: 14, color: message.includes("successfully") ? "#4ade80" : "#ef4444" }}>
                                                    {message}
                                                </span>
                                            )}
                                        </div>
                                    </form>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                            <div className="field-view">
                                                <div className="form-label" style={{ marginBottom: 10 }}>Display Name</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: "#fafafa" }}>{name}</div>
                                            </div>
                                            <div className="field-view">
                                                <div className="form-label" style={{ marginBottom: 10 }}>Location</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: location ? "#fafafa" : "#3f3f46", fontStyle: location ? "normal" : "italic" }}>
                                                    {location || "Not set"}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="field-view">
                                            <div className="form-label" style={{ marginBottom: 10 }}>Bio</div>
                                            <div style={{ fontSize: 15, color: bio ? "#a1a1aa" : "#3f3f46", fontStyle: bio ? "normal" : "italic", lineHeight: 1.75 }}>
                                                {bio || "Not set"}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                                {/* Avatar + aggregate stats */}
                                <div className="card" style={{ padding: "36px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                                    <div style={{
                                        width: 96, height: 96, borderRadius: "50%",
                                        background: "linear-gradient(135deg, #181919, #101312)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 32, fontWeight: 800, color: "#777474",
                                    
                                    }}>
                                        {initials}
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: "#fafafa" }}>{name || "—"}</div>
                                        {location && <div style={{ fontSize: 13, color: "#52525b", marginTop: 5 }}>📍 {location}</div>}
                                    </div>
                                    <div style={{ width: "100%", height: 1, background: "#191919" }} />
                                    <div style={{ display: "flex", gap: 0, width: "100%" }}>
                                        {[
                                            { label: "Sports", value: profileSports.length, color: "#fafafa" },
                                            { label: "Wins", value: totalWins, color: "#4ade80" },
                                            { label: "Losses", value: totalLosses, color: "#f87171" },
                                        ].map((stat, i) => (
                                            <div key={stat.label} style={{ flex: 1, textAlign: "center", borderLeft: i > 0 ? "1px solid #191919" : "none", padding: "0 8px" }}>
                                                <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, letterSpacing: "-0.04em" }}>{stat.value}</div>
                                                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sport ranks summary */}
                                {profileSports.length > 0 && (
                                    <div className="card" style={{ padding: "28px 30px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: "#71717a", marginBottom: 18 }}>Sport Rankings</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {profileSports.map((ps) => {
                                                const sportColor = SPORT_COLORS[ps.sport_name] || "#4ade80";
                                                return (
                                                    <div key={ps.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: sportColor, boxShadow: `0 0 6px ${sportColor}99`, flexShrink: 0 }} />
                                                            <span style={{ fontSize: 14, color: "#d4d4d8", fontWeight: 500 }}>{ps.sport_name}</span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 7,
                                                            ...(ps.rank_tier === "Unranked"
                                                                ? { background: "#1e1e1e", color: "#52525b" }
                                                                : { background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" })
                                                        }}>
                                                            {ps.rank_tier}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════ SPORTS TAB ════════════ */}
                    {activeTab === "sports" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                            {!hasProfile ? (
                                <div className="card" style={{ padding: "40px 48px", borderColor: "rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.03)" }}>
                                    <p style={{ color: "#fbbf24", fontSize: 15 }}>Please create your profile first before adding sports.</p>
                                    <button onClick={() => setActiveTab("profile")}
                                        style={{ marginTop: 12, background: "transparent", border: "none", color: "#f59e0b", fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
                                        Go to Profile →
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Add sport panel */}
                                    <div className="card" style={{ padding: "36px 44px" }}>
                                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
                                            <div>
                                                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#d4d4d8" }}>Add a Sport</h2>
                                                <p style={{ marginTop: 6, fontSize: 13, color: "#3f3f46" }}>Track your MMR and rank across multiple sports</p>
                                            </div>
                                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                                                <div>
                                                    <label className="form-label" htmlFor="sport-select">Select Sport</label>
                                                    <select id="sport-select" className="form-input" style={{ width: 230 }}
                                                        value={selectedSportId ?? ""}
                                                        onChange={(e) => setSelectedSportId(e.target.value ? Number(e.target.value) : null)}>
                                                        <option value="">Choose a sport...</option>
                                                        {availableSports.map((sport) => (
                                                            <option key={sport.id} value={sport.id}>{sport.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button className="primary-btn" onClick={handleAddSport}
                                                    disabled={addingSport || !selectedSportId} style={{ padding: "13px 28px" }}>
                                                    {addingSport ? "Adding..." : "+ Add Sport"}
                                                </button>
                                            </div>
                                        </div>
                                        {availableSports.length === 0 && (
                                            <p style={{ marginTop: 18, fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>
                                                You've added all available sports to your profile.
                                            </p>
                                        )}
                                        {sportsMessage && (
                                            <p style={{ marginTop: 14, fontSize: 14, color: sportsMessage.includes("successfully") || sportsMessage.includes("removed") ? "#4ade80" : "#ef4444" }}>
                                                {sportsMessage}
                                            </p>
                                        )}
                                    </div>

                                    {/* Sports grid */}
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                                            <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Your Sports</h2>
                                            <span style={{ fontSize: 11, color: "#3f3f46" }}>
                                                {profileSports.length} sport{profileSports.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        {sportsLoading ? (
                                            <div style={{ padding: "64px 0", textAlign: "center", color: "#3f3f46", fontSize: 15 }}>Loading...</div>
                                        ) : profileSports.length === 0 ? (
                                            <div className="card" style={{ padding: "64px 48px", textAlign: "center" }}>
                                                <p style={{ color: "#3f3f46", fontStyle: "italic", fontSize: 15 }}>
                                                    No sports added yet — pick one above to get started!
                                                </p>
                                            </div>
                                        ) : (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                                                {profileSports.map((ps) => {
                                                    const sportColor = SPORT_COLORS[ps.sport_name] || "#4ade80";
                                                    const winRate = ps.matches_played > 0
                                                        ? Math.round((ps.wins / ps.matches_played) * 100)
                                                        : null;

                                                    return (
                                                        <div key={ps.id} className="sport-card">
                                                            {/* Sport header */}
                                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                                    <div style={{
                                                                        width: 46, height: 46, borderRadius: 12,
                                                                        background: `${sportColor}14`,
                                                                        border: `1px solid ${sportColor}30`,
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                        fontSize: 11, fontWeight: 800, color: sportColor, letterSpacing: "0.04em",
                                                                    }}>
                                                                        {ps.sport_name.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fafafa" }}>{ps.sport_name}</div>
                                                                        {winRate !== null && (
                                                                            <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>{winRate}% win rate</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span style={{
                                                                    padding: "5px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                                                                    ...(ps.rank_tier === "Unranked"
                                                                        ? { background: "#1e1e1e", color: "#52525b" }
                                                                        : { background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd" })
                                                                }}>
                                                                    {ps.rank_tier}
                                                                </span>
                                                            </div>

                                                            {/* MMR progress */}
                                                            <div>
                                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                                                    <span style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>MMR</span>
                                                                    <span style={{ fontSize: 18, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.03em" }}>{ps.mmr}</span>
                                                                </div>
                                                                <div style={{ height: 5, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" }}>
                                                                    <div style={{
                                                                        height: "100%",
                                                                        width: `${Math.min((ps.mmr / 2000) * 100, 100)}%`,
                                                                        background: `linear-gradient(90deg, ${sportColor}66, ${sportColor})`,
                                                                        borderRadius: 4,
                                                                    }} />
                                                                </div>
                                                            </div>

                                                            {/* Stats */}
                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                                                {[
                                                                    { label: "Matches", value: ps.matches_played, color: "#e4e4e7" },
                                                                    { label: "Wins", value: ps.wins, color: "#4ade80" },
                                                                    { label: "Losses", value: ps.losses, color: "#f87171" },
                                                                ].map(({ label, value, color }) => (
                                                                    <div key={label} className="stat-cell">
                                                                        <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 8 }}>{label}</div>
                                                                        <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.04em" }}>{value}</div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Placement notice */}
                                                            {ps.placement_matches_remaining > 0 && (
                                                                <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10, padding: "12px 16px" }}>
                                                                    <span style={{ fontSize: 13, color: "#fbbf24" }}>
                                                                        ⏳ {ps.placement_matches_remaining} placement match{ps.placement_matches_remaining !== 1 ? "es" : ""} remaining to rank
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Remove */}
                                                            <div style={{ borderTop: "1px solid #191919", paddingTop: 18 }}>
                                                                <button className="danger-btn" onClick={() => handleRemoveSport(ps.id)}>
                                                                    Remove Sport
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}