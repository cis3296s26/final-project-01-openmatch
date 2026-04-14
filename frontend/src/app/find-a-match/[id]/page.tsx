"use client";

import AuthGate from "@/components/AuthGate";
import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

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

type Participant = {
  id: number;
  match_post_id: number;
  user_id: number;
  username: string | null;
  side: string;
  team_id: number | null;
  selected_for_match: boolean;
  ready: boolean;
  joined_at: string;
};

type PostDetail = {
  id: number;
  user_id: number;
  team_id: number | null;
  sport_id: number;
  sport_name: string;
  team_name: string | null;
  title: string;
  skill: string;
  location: string | null;
  note: string | null;
  status: string;
  players_per_side: number;
  locked_by_team_id: number | null;
  locked_by_user_id: number | null;
  locked_at: string | null;
  ready_deadline_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  participants: Participant[];
};

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function MatchLobbyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  const myParticipant = useMemo(() => {
    if (!post || !user) return null;
    return post.participants.find((p) => p.user_id === user.id) || null;
  }, [post, user]);

  useEffect(() => { setUser(getUser()); }, []);
  function handleLogout() { clearAuth(); router.push("/login"); }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLeft = useMemo(() => {
    if (!post?.ready_deadline_at) return null;
    const diffMs = new Date(post.ready_deadline_at).getTime() - now;
    if (diffMs <= 0) return "0:00";
    const totalSec = Math.floor(diffMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [post?.ready_deadline_at, now]);

  const sideCounts = useMemo(() => {
    if (!post) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const p of post.participants) {
      counts[p.side] = (counts[p.side] || 0) + 1;
    }
    return counts;
  }, [post]);

  const readyCounts = useMemo(() => {
    if (!post) return { total: 0, ready: 0 };
    const selected = post.participants.filter((p) => p.selected_for_match);
    return { total: selected.length, ready: selected.filter((p) => p.ready).length };
  }, [post]);

  async function refresh() {
    try {
      const res = await fetch(`${API}/posts/${postId}`);
      if (!res.ok) { setMsg("Post not found."); setPost(null); return; }
      setPost(await res.json());
    } finally { setLoading(false); }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    const t = setInterval(refresh, 3500);
    return () => clearInterval(t);
  }, [postId]);

  async function joinPost() {
    setMsg("");
    try {
      const endpoint = post?.team_id ? `${API}/posts/${postId}/join` : `${API}/posts/${postId}/accept-individual`;
      const res = await fetch(endpoint, { method: "POST", headers: authHeaders(), body: JSON.stringify({}) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setMsg(err.detail || "Failed to join."); return; }
      await refresh();
    } catch { setMsg("Backend not reachable."); }
  }

  async function leavePost() {
    setMsg("");
    try {
      const res = await fetch(`${API}/posts/${postId}/leave`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setMsg(err.detail || "Failed to leave."); return; }
      await refresh();
    } catch { setMsg("Backend not reachable."); }
  }

  async function readyUp() {
    setMsg("");
    try {
      const res = await fetch(`${API}/posts/${postId}/ready`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setMsg(err.detail || "Failed to ready."); return; }
      await refresh();
    } catch { setMsg("Backend not reachable."); }
  }

  const isTeam = post?.team_id !== null;
  const pps = post?.players_per_side ?? 5;
  const sideALabel = isTeam ? "Poster" : "Side A";
  const sideBLabel = isTeam ? "Opponent" : "Side B";
  const sideAKey = isTeam ? "poster" : "A";
  const sideBKey = isTeam ? "opponent" : "B";
  const sideACount = sideCounts[sideAKey] ?? 0;
  const sideBCount = sideCounts[sideBKey] ?? 0;

  const isOpen = post?.status === "open";
  const isReadyPending = post?.status === "ready_pending";
  const isConfirmed = post?.status === "confirmed";
  const sportColor = post ? (SPORT_COLORS[post.sport_name] || "#4ade80") : "#4ade80";

  const sideAParticipants = post?.participants.filter((p) => p.side === sideAKey) ?? [];
  const sideBParticipants = post?.participants.filter((p) => p.side === sideBKey) ?? [];

  return (
    <AuthGate>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .card { background: #0c0c0c; border: 1px solid #191919; border-radius: 18px; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
        .nav-btn {
          background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
          font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }
        .ghost-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 9px;
          padding: 6px 14px; font-size: 12px; color: #52525b; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s;
        }
        .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        .ready-btn {
          position: relative; overflow: hidden; width: 100%; border: none;
          cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 700;
          font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase;
          padding: 12px 16px; border-radius: 11px;
          transition: transform 0.1s ease, box-shadow 0.25s ease;
        }
        .ready-btn:active { transform: scale(0.96); }
        .ready-btn.is-ready {
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          color: #fff;
          box-shadow: 0 0 0 1px rgba(52,211,153,0.3), 0 0 22px rgba(52,211,153,0.45), 0 0 55px rgba(16,185,129,0.15);
          animation: ready-pulse 2.2s ease-in-out infinite;
        }
        .ready-btn.is-ready:hover {
          box-shadow: 0 0 0 1px rgba(52,211,153,0.5), 0 0 32px rgba(52,211,153,0.65), 0 0 65px rgba(16,185,129,0.28);
        }
        .ready-btn.not-ready {
          background: #111; border: 1px solid #222; color: #3f3f46; box-shadow: none;
        }
        .ready-btn.not-ready:hover {
          border-color: #2e2e2e; color: #71717a; box-shadow: 0 0 15px rgba(52,211,153,0.06);
        }
        @keyframes ready-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(52,211,153,0.3), 0 0 22px rgba(52,211,153,0.45), 0 0 55px rgba(16,185,129,0.15); }
          50%       { box-shadow: 0 0 0 1px rgba(52,211,153,0.5), 0 0 36px rgba(52,211,153,0.68), 0 0 72px rgba(16,185,129,0.3); }
        }
        .ripple {
          position: absolute; border-radius: 50%; background: rgba(255,255,255,0.2);
          transform: scale(0); animation: ripple-out 0.55s linear forwards; pointer-events: none;
        }
        @keyframes ripple-out { to { transform: scale(4.5); opacity: 0; } }
        .countdown-glow {
          animation: count-pulse 1s ease-in-out infinite;
        }
        @keyframes count-pulse {
          0%, 100% { text-shadow: 0 0 8px rgba(250,204,21,0.4); }
          50%       { text-shadow: 0 0 20px rgba(250,204,21,0.7); }
        }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Header ── */}
        <header style={{ borderBottom: "1px solid #141414", background: "rgba(8,8,8,0.97)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#080808", boxShadow: "0 0 18px rgba(52,211,153,0.35)" }}>OM</div>
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
                  <Link key={item.label} href={item.href} className={`nav-btn${item.label === "Find a Match" ? " active" : ""}`} style={{ textDecoration: "none" }}>{item.label}</Link>
                ))}
              </nav>
            </div>
            <div style={{ position: "relative" }}>
              <div onClick={() => setMenuOpen((o) => !o)} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#71717a", cursor: "pointer" }}>
                {user ? user.display_name ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : `${user.first_name[0]}${user.last_name?.[0] ?? ""}` : "?"}
              </div>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: 42, right: 0, zIndex: 50, background: "#0f0f0f", border: "1px solid #222", borderRadius: 12, padding: "6px", minWidth: 160, boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#3f3f46", borderBottom: "1px solid #1a1a1a", marginBottom: 4 }}>
                      {user ? (user.display_name || `${user.first_name} ${user.last_name ?? ""}`.trim()) : "Account"}
                    </div>
                    <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#a1a1aa", borderRadius: 8, textDecoration: "none" }}>Profile</Link>
                    <button type="button" onClick={handleLogout} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 12px", fontSize: 13, color: "#ef4444", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Log out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>

          {/* Back breadcrumb */}
          <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/find-a-match" style={{ color: "#52525b", textDecoration: "none", fontSize: 13, transition: "color 0.15s" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#a1a1aa")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#52525b")}
            >
              ← Back to posts
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#52525b" }}>Loading lobby...</div>
          ) : !post ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p style={{ color: "#52525b" }}>Post not found or has expired.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

              {/* ── LEFT COLUMN: Post info + participants ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Post header card */}
                <div className="card" style={{ padding: "22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: sportColor }}>
                      {post.sport_name.toUpperCase()}
                    </span>
                    <span style={{ color: "#222" }}>·</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                      background: isTeam ? "rgba(96,165,250,0.1)" : "rgba(168,85,247,0.1)",
                      border: `1px solid ${isTeam ? "rgba(96,165,250,0.2)" : "rgba(168,85,247,0.2)"}`,
                      color: isTeam ? "#93c5fd" : "#c4b5fd",
                    }}>
                      {isTeam ? "Team" : "Individual"}
                    </span>
                    <span style={{ color: "#222" }}>·</span>
                    <span style={{ fontSize: 11, color: "#3f3f46" }}>{post.skill}</span>
                    <span style={{ color: "#222" }}>·</span>
                    <span style={{ fontSize: 11, color: "#3f3f46" }}>{pps}v{pps}</span>
                    {post.team_name && (
                      <>
                        <span style={{ color: "#222" }}>·</span>
                        <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>{post.team_name}</span>
                      </>
                    )}
                  </div>

                  <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa", lineHeight: 1.15 }}>
                    {post.title}
                    {post.location && <span style={{ color: "#52525b", fontWeight: 500 }}> · {post.location}</span>}
                  </h1>

                  {post.note && (
                    <p style={{ marginTop: 10, fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>
                      &quot;{post.note}&quot;
                    </p>
                  )}
                </div>

                {/* Side-by-side rosters */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Side A */}
                  <div className="card" style={{ padding: "18px 20px", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8" }}>{sideALabel}</h3>
                      <span style={{ fontSize: 11, color: "#3f3f46" }}>{sideACount}/{pps}</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 3, background: "#191919", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (sideACount / pps) * 100)}%`, background: sportColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>

                    {sideAParticipants.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#3f3f46", padding: "12px 0", textAlign: "center" }}>Waiting for players...</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {sideAParticipants.map((p, i) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < sideAParticipants.length - 1 ? "1px solid #141414" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: p.ready ? "rgba(52,211,153,0.08)" : "#111",
                                border: `1px solid ${p.ready ? "rgba(52,211,153,0.2)" : "#1e1e1e"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 800, color: p.ready ? "#34d399" : "#52525b",
                                transition: "all 0.3s",
                              }}>
                                {p.username ? initials(p.username) : `U${p.user_id}`}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{p.username ?? `User ${p.user_id}`}</div>
                                {p.team_id && <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 1 }}>Team {p.team_id}</div>}
                              </div>
                            </div>
                            {p.selected_for_match && (
                              <span style={{
                                padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: p.ready ? "rgba(52,211,153,0.08)" : "rgba(161,161,170,0.06)",
                                border: `1px solid ${p.ready ? "rgba(52,211,153,0.2)" : "rgba(161,161,170,0.12)"}`,
                                color: p.ready ? "#34d399" : "#52525b",
                              }}>
                                {p.ready ? "READY" : "NOT READY"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Side B */}
                  <div className="card" style={{ padding: "18px 20px", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8" }}>{sideBLabel}</h3>
                      <span style={{ fontSize: 11, color: "#3f3f46" }}>{sideBCount}/{pps}</span>
                    </div>

                    <div style={{ height: 3, background: "#191919", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (sideBCount / pps) * 100)}%`, background: sportColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>

                    {sideBParticipants.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#3f3f46", padding: "12px 0", textAlign: "center" }}>Waiting for players...</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {sideBParticipants.map((p, i) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < sideBParticipants.length - 1 ? "1px solid #141414" : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: p.ready ? "rgba(52,211,153,0.08)" : "#111",
                                border: `1px solid ${p.ready ? "rgba(52,211,153,0.2)" : "#1e1e1e"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 800, color: p.ready ? "#34d399" : "#52525b",
                                transition: "all 0.3s",
                              }}>
                                {p.username ? initials(p.username) : `U${p.user_id}`}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{p.username ?? `User ${p.user_id}`}</div>
                                {p.team_id && <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 1 }}>Team {p.team_id}</div>}
                              </div>
                            </div>
                            {p.selected_for_match && (
                              <span style={{
                                padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: p.ready ? "rgba(52,211,153,0.08)" : "rgba(161,161,170,0.06)",
                                border: `1px solid ${p.ready ? "rgba(52,211,153,0.2)" : "rgba(161,161,170,0.12)"}`,
                                color: p.ready ? "#34d399" : "#52525b",
                              }}>
                                {p.ready ? "READY" : "NOT READY"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: Status panel + actions ── */}
              <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Status card */}
                <div className="card" style={{ padding: "22px 20px" }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3f3f46", marginBottom: 16 }}>Status</h3>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase",
                      background: isConfirmed ? "rgba(52,211,153,0.08)" : isReadyPending ? "rgba(250,204,21,0.08)" : "rgba(161,161,170,0.06)",
                      border: `1px solid ${isConfirmed ? "rgba(52,211,153,0.2)" : isReadyPending ? "rgba(250,204,21,0.2)" : "rgba(161,161,170,0.12)"}`,
                      color: isConfirmed ? "#34d399" : isReadyPending ? "#facc15" : "#71717a",
                    }}>
                      {post.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Countdown */}
                  {isReadyPending && timeLeft !== null && (
                    <div style={{ textAlign: "center", marginBottom: 18 }}>
                      <div className="countdown-glow" style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#facc15", lineHeight: 1 }}>
                        {timeLeft}
                      </div>
                      <div style={{ fontSize: 10, color: "#52525b", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>time to ready up</div>
                    </div>
                  )}

                  {/* Ready progress */}
                  {isReadyPending && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#71717a" }}>Ready progress</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>{readyCounts.ready}/{readyCounts.total}</span>
                      </div>
                      <div style={{ height: 4, background: "#191919", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: readyCounts.total > 0 ? `${(readyCounts.ready / readyCounts.total) * 100}%` : "0%",
                          background: "linear-gradient(90deg, #047857, #34d399)",
                          borderRadius: 3, transition: "width 0.4s ease",
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Confirmed state */}
                  {isConfirmed && (
                    <div style={{
                      padding: "14px 16px", borderRadius: 12, textAlign: "center",
                      background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)",
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#34d399" }}>Match Confirmed</div>
                      <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>All players are ready. Game on!</div>
                    </div>
                  )}

                  {/* Fill progress (open state) */}
                  {isOpen && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#71717a" }}>{sideALabel}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>{sideACount}/{pps}</span>
                      </div>
                      <div style={{ height: 4, background: "#191919", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (sideACount / pps) * 100)}%`, background: sportColor, borderRadius: 3, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#71717a" }}>{sideBLabel}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>{sideBCount}/{pps}</span>
                      </div>
                      <div style={{ height: 4, background: "#191919", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (sideBCount / pps) * 100)}%`, background: sportColor, borderRadius: 3, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  )}

                  {/* Your status */}
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "#0a0a0a", border: "1px solid #151515", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Your status</div>
                    {!user ? (
                      <div style={{ fontSize: 12, color: "#52525b" }}>Not logged in</div>
                    ) : !myParticipant ? (
                      <div style={{ fontSize: 12, color: "#71717a" }}>Not joined yet</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#d4d4d8" }}>
                        Joined · {myParticipant.side} side
                        {myParticipant.ready && <span style={{ color: "#34d399", fontWeight: 600 }}> · Ready</span>}
                        {!myParticipant.ready && isReadyPending && <span style={{ color: "#facc15", fontWeight: 600 }}> · Awaiting ready</span>}
                      </div>
                    )}
                  </div>

                  {msg && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 14 }}>{msg}</div>}
                </div>

                {/* Action buttons */}
                {isOpen && !myParticipant && (
                  <button
                    className="ready-btn not-ready"
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const rect = btn.getBoundingClientRect();
                      const size = Math.max(rect.width, rect.height);
                      const x = e.clientX - rect.left - size / 2;
                      const y = e.clientY - rect.top - size / 2;
                      const el = document.createElement("span");
                      el.className = "ripple";
                      el.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
                      btn.appendChild(el);
                      setTimeout(() => el.remove(), 560);
                      joinPost();
                    }}
                  >
                    {isTeam ? "Join for my team" : "Accept & Join"}
                  </button>
                )}

                {isReadyPending && myParticipant && !myParticipant.ready && (
                  <button
                    className="ready-btn is-ready"
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const rect = btn.getBoundingClientRect();
                      const size = Math.max(rect.width, rect.height);
                      const x = e.clientX - rect.left - size / 2;
                      const y = e.clientY - rect.top - size / 2;
                      const el = document.createElement("span");
                      el.className = "ripple";
                      el.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
                      btn.appendChild(el);
                      setTimeout(() => el.remove(), 560);
                      readyUp();
                    }}
                  >
                    Ready Up
                  </button>
                )}

                {myParticipant?.ready && !isConfirmed && (
                  <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>You are ready</div>
                    <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 4 }}>Waiting for other players...</div>
                  </div>
                )}

                {myParticipant && !isConfirmed && (
                  <button
                    className="ghost-btn"
                    onClick={leavePost}
                    style={{ width: "100%", padding: "10px 16px", fontSize: 12, color: "#ef4444", borderColor: "#2a1515" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.04)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "#2a1515"; e.currentTarget.style.background = "transparent"; }}
                  >
                    Leave match
                  </button>
                )}
              </aside>
            </div>
          )}
        </main>
      </div>
    </AuthGate>
  );
}
