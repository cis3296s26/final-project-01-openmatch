"use client";

export const dynamic = "force-dynamic";

import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http/, "ws");

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
    ties: number;
    member_count: number;
    created_at: string;
    description: string | null;
    mmr: number;
    invite_only: boolean;
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

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string): string {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function TeamProfilePage() {
    const router = useRouter();
    const params = useParams();
    const teamId = Array.isArray(params?.id) ? params.id[0] : params?.id;

    const [menuOpen, setMenuOpen] = useState(false);
    const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [matches, setMatches] = useState<TeamMatch[]>([]);
    const [loading, setLoading] = useState(false);

    const [canEdit, setCanEdit] = useState(false);
    const [canInvite, setCanInvite] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteUsername, setInviteUsername] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [inviteCopied, setInviteCopied] = useState(false);

    const [editName, setEditName] = useState("");
    const [editInviteOnly, setEditInviteOnly] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        const currentUser = getUser();
        setUser(currentUser);

        fetchTeam(teamId);
        fetchTeamMembers(teamId);
        // fetchTeamMatches(teamId);
    }, [teamId]);

    useEffect(() => {
      if (!WS_BASE || !teamId) return;

      const ws = new WebSocket(`${WS_BASE}/ws`);
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
          console.log("WebSocket connected");

          heartbeat = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                  ws.send("ping");
              }
          }, 20000);
      };

      ws.onmessage = async (event) => {
          try {
              const msg = JSON.parse(event.data);

              if (msg.teamId && msg.teamId !== Number(teamId)) return;

              if (
                  msg.type === "team_updated" ||
                  msg.type === "team_member_joined" ||
                  msg.type === "team_deleted" ||
                  msg.type === "team_created"
              ) {
                  await fetchTeam(teamId);
                  await fetchTeamMembers(teamId);
                  // if you turn match history back on later:
                  // await fetchTeamMatches(teamId);
              }

              if (msg.type === "team_deleted") {
                  router.push("/my-teams");
              }
          } catch (err) {
              console.error("Bad websocket message:", err);
          }
      };

      ws.onclose = () => {
          console.log("WebSocket disconnected");
          if (heartbeat) clearInterval(heartbeat);
      };

      ws.onerror = (err) => {
          console.error("WebSocket error:", err);
      };

      return () => {
          if (heartbeat) clearInterval(heartbeat);
          ws.close();
      };
    }, [teamId, router]);

    async function fetchTeam(id: string | undefined) {
        setLoading(true);
        try {
        const res = await fetch(`${API}/teams/${id}/profile`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();

          setTeam({
            id: data.id,
            name: data.name,
            sport: data.sport,
            city: data.city,
            description: data.description,
            rank: data.rank,
            mmr: data.stats.team_mmr,
            wins: data.stats.wins,
            losses: data.stats.losses,
            ties: data.stats.ties,
            member_count: data.member_count,
            created_at: data.created_at,
            invite_only: Boolean(data.invite_only),
          });

          setMembers(data.members);
          setCanInvite(Boolean(data.viewer?.can_invite));
          setCanEdit(Boolean(data.viewer?.can_edit))
        } else if (res.status === 401) {
            router.push("/login");
        }
        } catch (err) {
        console.error("Failed to fetch team:", err);
        } finally {
        setLoading(false);
        }
    }

    async function fetchTeamMembers(id: string | undefined) {
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

    function openEditModal() {
        if (!team) return;
        setEditName(team.name);
        setEditInviteOnly(team.invite_only);
        setEditError(null);
        setDeleteConfirm(false);
        setDeleteError(null);
        setEditModalOpen(true);
    }

    function closeEditModal() {
        setEditModalOpen(false);
        setDeleteConfirm(false);
        setEditError(null);
        setDeleteError(null);
    }

    async function handleSaveName() {
        if (!team || !editName.trim()) return;
        setEditSaving(true);
        setEditError(null);
        try {
            const res = await fetch(`${API}/teams/${team.id}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ name: editName.trim(), invite_only: editInviteOnly }),
            });
            if (res.ok) {
                setTeam((prev) => prev ? { ...prev, name: editName.trim(), invite_only: editInviteOnly } : prev);
                closeEditModal();
            } else {
                const data = await res.json().catch(() => ({}));
                setEditError(data.message || "Failed to update team name. Does another team under this name and sport already exist?");
            }
        } catch {
            setEditError("Error making changes.");
        } finally {
            setEditSaving(false);
        }
    }

    function openInviteModal() {
        setInviteUsername("");
        setInviteError(null);
        setInviteUrl(null);
        setInviteCopied(false);
        setInviteModalOpen(true);
    }

    function closeInviteModal() {
        setInviteModalOpen(false);
        setInviteUsername("");
        setInviteError(null);
        setInviteUrl(null);
        setInviteCopied(false);
    }

    async function handleSendInvite() {
        if (!inviteUsername.trim()) return;
        setInviteLoading(true);
        setInviteError(null);
        try {
            const res = await fetch(`${API}/teams/${teamId}/invite`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ username: inviteUsername.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setInviteUrl(data.invite_url);
            } else {
                setInviteError(data.detail || "Failed to generate invite link.");
            }
        } catch {
            setInviteError("Network error. Please try again.");
        } finally {
            setInviteLoading(false);
        }
    }

    function handleCopyInvite() {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl).then(() => {
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        });
    }

    async function handleDeleteTeam() {
        if (!team) return;
        setEditSaving(true);
        setDeleteError(null);
        try {
            const res = await fetch(`${API}/teams/${team.id}`, {
                method: "DELETE",
                headers: authHeaders(),
            });
            if (res.ok) {
                router.push("/my-teams");
            } else {
                const data = await res.json().catch(() => ({}));
                setDeleteError(data.message || "Failed to delete team.");
            }
        } catch {
            setDeleteError("Network error. Please try again.");
        } finally {
            setEditSaving(false);
        }
    }

    const sportColor = team ? (SPORT_COLORS[team.sport] || "#4ade80") : "#4ade80";
    const totalGames = team ? team.wins + team.losses + team.ties : 0;
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


const recentResults = matches.slice(0, 10).map((m) => m.result === "win" ? "W" : m.result === "loss" ? "L" : "D");

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
        <AuthGate>
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

            .modal-overlay {
            position: fixed; inset: 0; z-index: 100;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            }
            .modal-box {
            background: #0f0f0f; border: 1px solid #1e1e1e; border-radius: 18px;
            padding: 28px; width: 100%; max-width: 420px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.7);
            }
            .modal-input {
            width: 100%; background: #111; border: 1px solid #2a2a2a; border-radius: 10px;
            padding: 10px 14px; font-size: 14px; color: #e4e4e7;
            font-family: 'DM Sans', sans-serif; outline: none;
            transition: border-color 0.15s;
            }
            .modal-input:focus { border-color: #3f3f46; }
            .modal-save-btn {
            background: #fafafa; color: #080808; border: none; border-radius: 10px;
            padding: 9px 22px; font-size: 13px; font-weight: 700;
            font-family: 'DM Sans', sans-serif; cursor: pointer; transition: opacity 0.15s;
            }
            .modal-save-btn:hover { opacity: 0.88; }
            .modal-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .modal-delete-btn {
            background: rgba(239,68,68,0.08); color: #ef4444;
            border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
            padding: 9px 22px; font-size: 13px; font-weight: 700;
            font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s, border-color 0.15s;
            }
            .modal-delete-btn:hover { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.35); }
            .modal-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .modal-cancel-btn {
            background: transparent; border: 1px solid #1e1e1e; border-radius: 10px;
            padding: 9px 22px; font-size: 13px; color: #52525b;
            font-family: 'DM Sans', sans-serif; cursor: pointer; transition: border-color 0.15s, color 0.15s;
            }
            .modal-cancel-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
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

            {/* Shows button only for captain */}
            {canEdit && (
              <button className="ghost-btn" style={{ alignSelf: "flex-start" }} onClick={openEditModal}>Edit Team</button>
            )}
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
              { label: "Ties", value: team.ties, color: "#facc15" },
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

                {/* Shows invite button if current user is captain */}
                {canInvite && (
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #131313" }}>
                    <button className="ghost-btn" style={{ width: "100%" }} onClick={openInviteModal}>
                      + Invite Player
                    </button>
                  </div>
                )}
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

      {/* ── Edit Team Modal ── */}
      {editModalOpen && (
          <div className="modal-overlay" onClick={closeEditModal}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", color: "#fafafa" }}>Edit Team</h2>
                      <button onClick={closeEditModal} style={{ background: "transparent", border: "none", color: "#52525b", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
                  </div>

                  {/* Rename section */}
                  <div style={{ marginBottom: 24 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Team Name
                      </label>
                      <input
                          className="modal-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          placeholder="Enter team name"
                          maxLength={60}
                      />
                      {editError && (
                          <p style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>{editError}</p>
                      )}
                  </div>

                  {/* Join policy toggle */}
                  <div style={{ marginBottom: 24 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Join Policy
                      </label>
                      <div style={{ display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, padding: 3, gap: 3 }}>
                          {[{ label: "Open", value: false }, { label: "Invite Only", value: true }].map(({ label, value }) => (
                              <button
                                  key={label}
                                  onClick={() => setEditInviteOnly(value)}
                                  style={{
                                      flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                                      background: editInviteOnly === value ? "#1e1e1e" : "transparent",
                                      color: editInviteOnly === value ? "#fafafa" : "#52525b",
                                      boxShadow: editInviteOnly === value ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
                                  }}
                              >
                              {label}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Save / Cancel */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
                      <button className="modal-save-btn" onClick={handleSaveName} disabled={editSaving || !editName.trim()}>
                          {editSaving ? "Saving…" : "Save Changes"}
                      </button>
                      <button className="modal-cancel-btn" onClick={closeEditModal} disabled={editSaving}>
                          Cancel
                      </button>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "#1a1a1a", marginBottom: 24 }} />

                  {/* Danger zone */}
                  <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                          ⚠️Danger Zone⚠️
                      </p>
                      {!deleteConfirm ? (
                          <button className="modal-delete-btn" onClick={() => setDeleteConfirm(true)}>
                              Delete Team
                          </button>
                      ) : (
                          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "16px" }}>
                              <p style={{ fontSize: 13, color: "#fca5a5", marginBottom: 14, lineHeight: 1.5 }}>
                                  Are you sure? This will permanently delete <strong>{team.name}</strong> and all its data. This cannot be undone.
                              </p>
                              {deleteError && (
                                  <p style={{ marginBottom: 10, fontSize: 12, color: "#f87171" }}>{deleteError}</p>
                              )}
                              <div style={{ display: "flex", gap: 10 }}>
                                  <button className="modal-delete-btn" onClick={handleDeleteTeam} disabled={editSaving}>
                                      {editSaving ? "Deleting…" : "Yes, Delete Team"}
                                  </button>
                                  <button className="modal-cancel-btn" onClick={() => setDeleteConfirm(false)} disabled={editSaving}>
                                      Cancel
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {/* ── Invite Player Modal ── */}
      {inviteModalOpen && (
          <div className="modal-overlay" onClick={closeInviteModal}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", color: "#fafafa" }}>Invite Player</h2>
                      <button onClick={closeInviteModal} style={{ background: "transparent", border: "none", color: "#52525b", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
                  </div>

                  {!inviteUrl ? (
                      <>
                          <div style={{ marginBottom: 20 }}>
                              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                  Username
                              </label>
                              <input
                                  className="modal-input"
                                  value={inviteUsername}
                                  onChange={(e) => setInviteUsername(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                                  placeholder="Enter player username"
                                  autoFocus
                              />
                              {inviteError && (
                                  <p style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>{inviteError}</p>
                              )}
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                              <button className="modal-save-btn" onClick={handleSendInvite} disabled={inviteLoading || !inviteUsername.trim()}>
                                  {inviteLoading ? "Generating…" : "Generate Invite Link"}
                              </button>
                              <button className="modal-cancel-btn" onClick={closeInviteModal} disabled={inviteLoading}>
                                  Cancel
                              </button>
                          </div>
                      </>
                  ) : (
                      <>
                          <p style={{ fontSize: 13, color: "#71717a", marginBottom: 16, lineHeight: 1.5 }}>
                              Share this link with <strong style={{ color: "#e4e4e7" }}>{inviteUsername}</strong>. It can only be used by them.
                          </p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
                              <span style={{ flex: 1, fontSize: 12, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {inviteUrl}
                              </span>
                              <button
                                  onClick={handleCopyInvite}
                                  style={{ flexShrink: 0, background: inviteCopied ? "rgba(74,222,128,0.1)" : "#1a1a1a", border: `1px solid ${inviteCopied ? "rgba(74,222,128,0.3)" : "#2a2a2a"}`, borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: inviteCopied ? "#4ade80" : "#a1a1aa", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                              >
                                  {inviteCopied ? "Copied!" : "Copy"}
                              </button>
                          </div>
                          <button className="modal-cancel-btn" onClick={closeInviteModal}>Done</button>
                      </>
                  )}
              </div>
          </div>
      )}
    </AuthGate>
  );
}