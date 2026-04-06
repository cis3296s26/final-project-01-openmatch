"use client";

import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type TeamMember = {
    id: number;
    user_id: number;
    name: string;
    role: "captain" | "member";
    joined_at: string;
};

type TeamMatch = {
    id: number;
    opponent: string;
    location: string;
    played_at: string;
    score_us: number;
    score_them: number;
    result: "win" | "loss" | "draw";
};

type Team = {
    id: number;
    name: string;
    sport: string;
    city: string;
    rank: string;
    wins: number;
    losses: number;
    draws: number;
    member_count: number;
    created_at: string;
    description: string | null;
    mmr: number;
};

// TODO: Replace with API fetch calls using team id from route params

const STATIC_TEAM: Team = {
    id: 1,
    name: "Broad St Ballers",
    sport: "Soccer",
    city: "Philadelphia",
    rank: "Gold II",
    wins: 14,
    losses: 5,
    draws: 2,
    member_count: 9,
    created_at: "2024-09-01T00:00:00Z",
    description: "A competitive rec soccer squad based in South Philly. We play most weekends at FDR Park and Clark Park. Always looking for subs!",
    mmr: 1680,
};

const STATIC_MEMBERS: TeamMember[] = [
    { id: 1, user_id: 1, name: "Jordan M.", role: "captain", joined_at: "2024-09-01T00:00:00Z" },
    { id: 2, user_id: 2, name: "Marco R.", role: "member", joined_at: "2024-09-04T00:00:00Z" },
    { id: 3, user_id: 3, name: "Priya K.", role: "member", joined_at: "2024-09-10T00:00:00Z" },
    { id: 4, user_id: 4, name: "Devon L.", role: "member", joined_at: "2024-10-01T00:00:00Z" },
    { id: 5, user_id: 5, name: "Sam T.", role: "member", joined_at: "2024-10-15T00:00:00Z" },
];

const STATIC_MATCHES: TeamMatch[] = [
    { id: 1, opponent: "Eastside FC", location: "FDR Park", played_at: "2025-03-27T14:00:00Z", score_us: 3, score_them: 1, result: "win" },
    { id: 2, opponent: "North Philly Rovers", location: "Clark Park", played_at: "2025-03-24T10:00:00Z", score_us: 0, score_them: 2, result: "loss" },
    { id: 3, opponent: "South Street Squad", location: "Cobb's Creek", played_at: "2025-03-18T11:00:00Z", score_us: 2, score_them: 1, result: "win" },
    { id: 4, opponent: "Fishtown United", location: "Penn Treaty Park", played_at: "2025-03-10T13:00:00Z", score_us: 1, score_them: 1, result: "draw" },
    { id: 5, opponent: "Manayunk FC", location: "Pretzel Park", played_at: "2025-03-03T09:00:00Z", score_us: 4, score_them: 0, result: "win" },
];

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

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string): string {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function TeamProfilePage() {
    const router = useRouter();
    const params = useParams();
    const teamId = params?.id; // TODO: use teamId in fetch calls below

    const [menuOpen, setMenuOpen] = useState(false);
    const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

    // Data state — swap STATIC_ values for real API data when backend is ready
    const [team, setTeam] = useState<Team | null>(STATIC_TEAM);
    const [members, setMembers] = useState<TeamMember[]>(STATIC_MEMBERS);
    const [matches, setMatches] = useState<TeamMatch[]>(STATIC_MATCHES);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const currentUser = getUser();
        setUser(currentUser);

        // TODO: uncomment and implement when backend endpoints are ready
        // fetchTeam(teamId);
        // fetchTeamMembers(teamId);
        // fetchTeamMatches(teamId);
    }, [teamId]);

    async function fetchTeam(id: string | string[]) {
        setLoading(true);
        try {
        const res = await fetch(`${API}/teams/${id}`, { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            setTeam(data);
        } else if (res.status === 401) {
            router.push("/login");
        }
        } catch (err) {
        console.error("Failed to fetch team:", err);
        } finally {
        setLoading(false);
        }
    }

    async function fetchTeamMembers(id: string | string[]) {
        try {
        const res = await fetch(`${API}/teams/${id}/members`, { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            setMembers(data);
        }
        } catch (err) {
        console.error("Failed to fetch members:", err);
        }
    }

    async function fetchTeamMatches(id: string | string[]) {
        try {
        const res = await fetch(`${API}/teams/${id}/matches`, { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            setMatches(data);
        }
        } catch (err) {
        console.error("Failed to fetch matches:", err);
        }
    }

    function handleLogout() {
        clearAuth();
        router.push("../login");
    }

    const sportColor = team ? (SPORT_COLORS[team.sport] || "#4ade80") : "#4ade80";
    const totalGames = team ? team.wins + team.losses + team.draws : 0;
    const winRate = totalGames > 0 && team ? Math.round((team.wins / totalGames) * 100) : 0;

  // MMR/Rank tier config/calculations
const TIERS = [
    { name: "Bronze III", min: 0,    max: 299  },
    { name: "Bronze II",  min: 300,  max: 599  },
    { name: "Bronze I",   min: 600,  max: 899  },
    { name: "Silver III", min: 900,  max: 1099 },
    { name: "Silver II",  min: 1100, max: 1249 },
    { name: "Silver I",   min: 1250, max: 1399 },
    { name: "Gold III",   min: 1400, max: 1549 },
    { name: "Gold II",    min: 1550, max: 1699 }, // current tier in static data
    { name: "Gold I",     min: 1700, max: 1849 },
    { name: "Platinum III",min:1850, max: 1999 },
    { name: "Platinum II", min:2000, max: 2149 },
    { name: "Platinum I",  min:2150, max: 2299 },
    { name: "Diamond",    min: 2300, max: 2599 },
    { name: "Champion",   min: 2600, max: 9999 },
];

const RANK_META: Record<string, { color: string; fill: string; icon: string }> = {
    Bronze:   { color: "#d97706", fill: "#92400e", icon: "🥉" },
    Silver:   { color: "#a1a1aa", fill: "#52525b", icon: "🥈" },
    Gold:     { color: "#facc15", fill: "#92400e", icon: "🥇" },
    Platinum: { color: "#2dd4bf", fill: "#0f766e", icon: "💎" },
    Diamond:  { color: "#818cf8", fill: "#4338ca", icon: "💠" },
    Champion: { color: "#f472b6", fill: "#9d174d", icon: "🏆" },
};

const currentTier = TIERS.find(t => (team?.mmr ?? 0) >= t.min && (team?.mmr ?? 0) <= t.max) ?? TIERS[0];
const nextTier = TIERS[TIERS.indexOf(currentTier) + 1] ?? null;
const tierSpan = currentTier.max - currentTier.min + 1;
const ptsInTier = (team?.mmr ?? 0) - currentTier.min;
const progress = Math.round((ptsInTier / tierSpan) * 100);
const tierKey = Object.keys(RANK_META).find(k => currentTier.name.startsWith(k)) ?? "Gold";
const { color: rankColor, fill: rankFill, icon: rankIcon } = RANK_META[tierKey];

// TODO: replace with real match result history from backend
const recentResults = ["W","W","L","W","L","W","W","W","L","W"];

    if (loading) {
        return (
        <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontFamily: "'DM Sans', sans-serif" }}>
            Loading team...
        </div>
        );
    }

    if (!team) {
        return (
        <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontFamily: "'DM Sans', sans-serif" }}>
            Team not found.
        </div>
        );
    }

    return (
        <>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            .card { background: #0c0c0c; border: 1px solid #191919; border-radius: 18px; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
            .row { transition: background 0.12s; }
            .row:hover { background: rgba(255,255,255,0.015); }

            .ghost-btn {
            background: transparent; border: 1px solid #1e1e1e; border-radius: 9px;
            padding: 6px 14px; font-size: 12px; color: #52525b; cursor: pointer;
            font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s;
            }
            .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }

            .nav-btn {
            background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
            font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
            }
            .nav-btn:hover { color: #a1a1aa; }
            .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }

            .stat-card {
            background: #0c0c0c; border: 1px solid #191919; border-radius: 14px;
            padding: 20px; flex: 1;
            }
        `}</style>

        <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Header ── */}
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
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`nav-btn${item.label === "My Teams" ? " active" : ""}`}
                    style={{ textDecoration: "none" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Avatar / dropdown */}
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setMenuOpen((o) => !o)}
                style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#71717a", cursor: "pointer" }}
              >
                {user
                  ? user.display_name
                    ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                    : `${user.first_name[0]}${user.last_name?.[0] ?? ""}`
                  : "?"}
              </div>

              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: 42, right: 0, zIndex: 50, background: "#0f0f0f", border: "1px solid #222", borderRadius: 12, padding: "6px", minWidth: 160, boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#3f3f46", borderBottom: "1px solid #1a1a1a", marginBottom: 4 }}>
                      {user ? (user.display_name || `${user.first_name} ${user.last_name ?? ""}`.trim()) : "Account"}
                    </div>
                    <Link href="../profile" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#a1a1aa", borderRadius: 8, textDecoration: "none" }}>
                      Profile
                    </Link>
                    <button onClick={handleLogout} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 12px", fontSize: 13, color: "#ef4444", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>

          {/* Back link */}
          <Link href="/my-teams" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#52525b", textDecoration: "none", marginBottom: 28 }}>
            ← My Teams
          </Link>

          {/* ── Team Hero ── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 36, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* Team avatar */}
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#52525b", flexShrink: 0 }}>
                {getInitials(team.name)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: sportColor }}>
                    {team.sport.toUpperCase()}
                  </span>
                  <span style={{ color: "#222" }}>·</span>
                  <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)", color: "#93c5fd" }}>
                    {team.rank}
                  </span>
                </div>
                <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>
                  {team.name}
                </h1>
                <p style={{ marginTop: 6, fontSize: 13, color: "#3f3f46" }}>
                  {team.city} · {team.member_count} members · Est. {formatDate(team.created_at)}
                </p>
              </div>
            </div>

            {/* TODO: show Edit button only if current user is captain */}
            <button className="ghost-btn" style={{ alignSelf: "flex-start" }}>Edit Team</button>
          </div>

          {/* Description */}
          {team.description && (
            <div className="card" style={{ padding: "18px 22px", marginBottom: 28 }}>
              <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.6, fontStyle: "italic" }}>
                &quot;{team.description}&quot;
              </p>
            </div>
          )}
            {/* ── MMR / Rank Bar ── */}
            <div className="card" style={{ padding: "20px 22px", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#111", border: `1px solid ${rankColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {rankIcon}
                </div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa", lineHeight: 1 }}>{currentTier.name}</div>
                    <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Team MMR</div>
                </div>
                </div>
                <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.05em", color: "#fafafa", lineHeight: 1 }}>{team.mmr.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rating</div>
                </div>
            </div>

            {/* Progress label */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#3f3f46" }}>
                {nextTier ? `Progress to ${nextTier.name}` : "Maximum rank"}
                </span>
                <span style={{ fontSize: 11, color: "#71717a" }}>{ptsInTier} / {tierSpan} pts</span>
            </div>

            {/* Bar */}
            <div style={{ position: "relative", height: 10, background: "#111", borderRadius: 99, border: "1px solid #1e1e1e", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`, background: rankFill, borderRadius: 99, transition: "width 0.9s cubic-bezier(.22,1,.36,1)" }} />
            </div>

            {/* Segment pips */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                {Array.from({ length: 6 }, (_, i) => {
                const pipMmr = Math.round(currentTier.min + (i / 5) * tierSpan);
                return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: team.mmr >= pipMmr ? rankColor : "#1e1e1e" }} />
                    <span style={{ fontSize: 10, color: "#3f3f46" }}>{pipMmr}</span>
                    </div>
                );
                })}
            </div>

            {/* W/L history */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent</span>
                <div style={{ display: "flex", gap: 4 }}>
                {recentResults.map((r, i) => (
                    <div key={i} style={{ width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, background: r === "W" ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)", border: `1px solid ${r === "W" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`, color: r === "W" ? "#86efac" : "#fca5a5" }}>
                    {r}
                    </div>
                ))}
                </div>
            </div>
            </div>
          {/* ── Stats Row ── */}
          <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
            {[
              { label: "Wins", value: team.wins, color: "#4ade80" },
              { label: "Losses", value: team.losses, color: "#f87171" },
              { label: "Draws", value: team.draws, color: "#facc15" },
              { label: "Win Rate", value: `${winRate}%`, color: sportColor },
              { label: "Games Played", value: totalGames, color: "#71717a" },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Two-column: members + match history ── */}
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 28, alignItems: "start" }}>

            {/* ── Members ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Members</h2>
                <span style={{ fontSize: 11, color: "#3f3f46" }}>{members.length} players</span>
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                {members.map((member, i) => (
                  <div
                    key={member.id}
                    className="row"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i !== members.length - 1 ? "1px solid #131313" : "none" }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#52525b", flexShrink: 0 }}>
                      {getInitials(member.name)}
                    </div>

                    {/* Name + role */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 2 }}>Joined {formatDate(member.joined_at)}</div>
                    </div>

                    {/* Captain badge */}
                    {member.role === "captain" && (
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `rgba(${sportColor === "#4ade80" ? "74,222,128" : "52,211,153"},0.07)`, border: `1px solid ${sportColor}30`, color: sportColor }}>
                        Captain
                      </span>
                    )}
                  </div>
                ))}

                {/* TODO: show Invite button if current user is captain */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid #131313" }}>
                  <button className="ghost-btn" style={{ width: "100%" }}>+ Invite Player</button>
                </div>
              </div>
            </div>

            {/* ── Match History ── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Match History</h2>
                <button className="ghost-btn">View all</button>
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                {matches.map((match, i) => (
                  <div
                    key={match.id}
                    className="row"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: i !== matches.length - 1 ? "1px solid #131313" : "none" }}
                  >
                    {/* Result icon + info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: match.result === "win" ? "rgba(74,222,128,0.06)" : match.result === "loss" ? "rgba(248,113,113,0.06)" : "rgba(250,204,21,0.06)",
                        border: `1px solid ${match.result === "win" ? "rgba(74,222,128,0.14)" : match.result === "loss" ? "rgba(248,113,113,0.14)" : "rgba(250,204,21,0.14)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800,
                        color: match.result === "win" ? "#4ade80" : match.result === "loss" ? "#f87171" : "#facc15",
                      }}>
                        {match.result === "win" ? "W" : match.result === "loss" ? "L" : "D"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>{match.opponent}</div>
                        <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 2 }}>{match.location} · {formatDate(match.played_at)}</div>
                      </div>
                    </div>

                    {/* Score + badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#52525b" }}>
                        {match.score_us} – {match.score_them}
                      </div>
                      <span style={{
                        padding: "3px 9px", borderRadius: 7, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
                        background: match.result === "win" ? "rgba(74,222,128,0.07)" : match.result === "loss" ? "rgba(248,113,113,0.07)" : "rgba(250,204,21,0.07)",
                        border: `1px solid ${match.result === "win" ? "rgba(74,222,128,0.16)" : match.result === "loss" ? "rgba(248,113,113,0.16)" : "rgba(250,204,21,0.16)"}`,
                        color: match.result === "win" ? "#86efac" : match.result === "loss" ? "#fca5a5" : "#fde047",
                      }}>
                        {match.result.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}