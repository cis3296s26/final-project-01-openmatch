"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http/, "ws");

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

type MatchPost = {
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
  status?: string;
  players_per_side?: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
};

type Team = {
  id: number;
  name: string;
  sport: string;
  city: string;
};

type LiveMatchLookup = {
  id: number;
  status: string;
};

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}

export default function FindAMatchPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageByPost, setMessageByPost] = useState<Record<number, string>>({});
  const [joinTeamByPost, setJoinTeamByPost] = useState<Record<number, number | "">>({});
  const [liveMatchByPost, setLiveMatchByPost] = useState<Record<number, LiveMatchLookup>>({});

  useEffect(() => { setUser(getUser()); }, []);
  function handleLogout() { clearAuth(); router.push("/login"); }

  useEffect(() => {
    const userId = getUser()?.id;
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const [postsRes, teamsRes, userTeamsRes] = await Promise.all([
          fetch(`${API}/posts`),
          fetch(`${API}/teams`),
          fetch(`${API}/users/${userId}/teams`, { headers: authHeaders() })
        ]);
        if (postsRes.ok) setPosts(await postsRes.json());
        if (teamsRes.ok) setTeams(await teamsRes.json());
        if (userTeamsRes.ok) setUserTeams(await userTeamsRes.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Poll live match status for any confirmed/ready_pending posts
  const refreshLiveMatches = useCallback(async (currentPosts: MatchPost[]) => {
    const relevantPosts = currentPosts.filter(
      (p) => p.status === "confirmed" || p.status === "ready_pending"
    );
    if (relevantPosts.length === 0) return;

    const results = await Promise.allSettled(
      relevantPosts.map((p) =>
        fetch(`${API}/posts/${p.id}/live-match`, { headers: authHeaders() })
          .then((r) => (r.ok ? r.json().then((d: LiveMatchLookup) => ({ postId: p.id, data: d })) : null))
          .catch(() => null)
      )
    );

    setLiveMatchByPost((prev) => {
      const next = { ...prev };
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          next[result.value.postId] = result.value.data;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (posts.length === 0) return;
    refreshLiveMatches(posts);
  }, [posts, refreshLiveMatches]);

  useEffect(() => {
    if (!WS_BASE) return;

    const ws = new WebSocket(`${WS_BASE}/ws`);
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    ws.onopen = () => {
      console.log("WebSocket connected");

      // needed because backend waits on receive_text()
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 20000);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (
          msg.type === "post_updated" ||
          msg.type === "live_match_updated" ||
          msg.type === "match_started" ||
          msg.type === "match_ended"
        ) {
          const userId = getUser()?.id;
          if (!userId) return;

          const [postsRes, teamsRes, userTeamsRes] = await Promise.all([
            fetch(`${API}/posts`),
            fetch(`${API}/teams`),
            fetch(`${API}/users/${userId}/teams`, { headers: authHeaders() })
          ]);

          let nextPosts: MatchPost[] = [];

          if (postsRes.ok) {
            nextPosts = await postsRes.json();
            setPosts(nextPosts);
          }
          if (teamsRes.ok) setTeams(await teamsRes.json());
          if (userTeamsRes.ok) setUserTeams(await userTeamsRes.json());

          if (nextPosts.length > 0) {
            await refreshLiveMatches(nextPosts);
          } else {
            setLiveMatchByPost({});
          }
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
  }, [refreshLiveMatches]);

  async function joinTeamPost(postId: number, teamId?: number) {
    const resolvedTeamId = teamId ?? joinTeamByPost[postId];
    if (!resolvedTeamId) {
      setMessageByPost((m) => ({ ...m, [postId]: "No team found for this sport. How did you even get this error?" }));
      return;
    }
    try {
      const res = await fetch(`${API}/posts/${postId}/join`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ team_id: Number(resolvedTeamId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessageByPost((m) => ({ ...m, [postId]: err.detail || "Failed to join." }));
        return;
      }
      setMessageByPost((m) => ({ ...m, [postId]: "Joined! Open lobby to see status." }));
    } catch { setMessageByPost((m) => ({ ...m, [postId]: "Backend not reachable." })); }
  }

  async function acceptIndividual(postId: number) {
    setMessageByPost((m) => ({ ...m, [postId]: "" }));
    try {
      const res = await fetch(`${API}/posts/${postId}/accept-individual`, {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessageByPost((m) => ({ ...m, [postId]: err.detail || "Failed to accept." }));
        return;
      }
      setMessageByPost((m) => ({ ...m, [postId]: "Accepted! Open lobby to ready up when full." }));
    } catch { setMessageByPost((m) => ({ ...m, [postId]: "Backend not reachable." })); }
  }

  return (
    <AuthGate>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .card { background: #0c0c0c; border: 1px solid #191919; border-radius: 18px; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
        .ghost-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 9px;
          padding: 6px 14px; font-size: 12px; color: #52525b; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s;
        }
        .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        .primary-btn {
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          border: none; border-radius: 9px; padding: 8px 18px; font-size: 12px;
          font-weight: 600; color: #fff; cursor: pointer; font-family: inherit;
          transition: box-shadow 0.2s;
        }
        .primary-btn:hover { box-shadow: 0 0 22px rgba(52,211,153,0.35); }
        .primary-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        .live-btn {
          border: none; border-radius: 9px; padding: 8px 18px; font-size: 12px;
          font-weight: 700; color: #fff; cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, #065f46 0%, #10b981 45%, #34d399 100%);
          animation: live-pulse 2s ease-in-out infinite;
          letter-spacing: 0.04em;
        }
        .live-btn:active { transform: scale(0.97); }

        .nav-btn {
          background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
          font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }
        .form-input {
          width: 100%; background: #111; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 10px 12px; color: #e4e4e7; font-size: 13px; font-family: inherit;
        }
        .form-input:focus { outline: none; border-color: #34d399; }
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

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>Find a Match</h1>
            <p style={{ marginTop: 10, fontSize: 13, color: "#3f3f46" }}>Browse open match posts and jump in</p>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#52525b" }}>Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <p style={{ color: "#52525b", marginBottom: 8 }}>No active posts right now</p>
              <p style={{ fontSize: 12, color: "#3f3f46" }}>Create one from your Dashboard</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map((p) => {
                const isTeam = p.team_id !== null;
                const sportColor = SPORT_COLORS[p.sport_name] || "#4ade80";
                const pps = p.players_per_side ?? 5;
                const status = p.status ?? "open";
                const liveMatch = liveMatchByPost[p.id] ?? null;
                return (
                  <div key={p.id} className="card" style={{ padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Meta row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: sportColor }}>
                            {p.sport_name.toUpperCase()}
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
                          <span style={{ fontSize: 11, color: "#3f3f46" }}>{p.skill}</span>
                          <span style={{ color: "#222" }}>·</span>
                          <span style={{ fontSize: 11, color: "#3f3f46" }}>{pps}v{pps}</span>
                          {p.team_name && (
                            <>
                              <span style={{ color: "#222" }}>·</span>
                              <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>{p.team_name}</span>
                            </>
                          )}
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", color: "#fafafa", lineHeight: 1.2 }}>
                          {p.title}
                          {p.location && <span style={{ color: "#71717a" }}> · {p.location}</span>}
                        </h3>

                        {p.note && (
                          <p style={{ marginTop: 8, fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>
                            &quot;{p.note}&quot;
                          </p>
                        )}

                        {/* Status */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                          <span style={{
                            display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            background: status === "ready_pending" ? "rgba(250,204,21,0.08)" : status === "confirmed" ? "rgba(52,211,153,0.08)" : "rgba(161,161,170,0.06)",
                            border: `1px solid ${status === "ready_pending" ? "rgba(250,204,21,0.2)" : status === "confirmed" ? "rgba(52,211,153,0.2)" : "rgba(161,161,170,0.12)"}`,
                            color: status === "ready_pending" ? "#facc15" : status === "confirmed" ? "#34d399" : "#52525b",
                          }}>
                            {status.replace("_", " ")}
                          </span>
                          {p.user_name && <span style={{ fontSize: 11, color: "#3f3f46" }}>by {p.user_name}</span>}
                        </div>
                      </div>

                      {/* Right column */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#3f3f46", whiteSpace: "nowrap" }}>
                          {getTimeRemaining(p.expires_at)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: 14, marginTop: 16, gap: 12, flexWrap: "wrap" }}>
                      <Link
                        href={`/find-a-match/${p.id}`}
                        style={{ fontSize: 12, color: "#71717a", textDecoration: "none", transition: "color 0.15s" }}
                        onMouseOver={(e) => (e.currentTarget.style.color = "#d4d4d8")}
                        onMouseOut={(e) => (e.currentTarget.style.color = "#71717a")}
                      >
                        Open lobby →
                      </Link>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Live match button — shown instead of join when a live match exists */}
                        {liveMatch ? (
                          <button
                            className="live-btn"
                            onClick={() => router.push(`/find-a-match/${p.id}/live-match-page`)}
                          >
                            Enter Live Match
                          </button>
                        ) : isTeam ? (
                          <>
                            {(() => {
                              const team = userTeams.find((t) => t.sport === p.sport_name);
                              return (
                                <button
                                  className="primary-btn"
                                  onClick={() => {
                                    if (!team) {
                                      setMessageByPost((m) => ({ ...m, [p.id]: "You don't have a team for this sport." }));
                                      return;
                                    }
                                    joinTeamPost(p.id, team.id);
                                  }}
                                  disabled={status !== "open" || !team}
                                  style={!team ? { background: "linear-gradient(135deg, #3f3f46, #52525b)", cursor: "not-allowed" } : {}}
                                  title={!team ? "You don't have a team for this sport" : undefined}
                                >
                                  {team ? `Join as ${team.name}` : "No team for this sport"}
                                </button>
                              );
                            })()}
                          </>
                        ) : (
                          <button className="primary-btn" onClick={() => acceptIndividual(p.id)} disabled={status !== "open"}>
                            Accept
                          </button>
                        )}
                      </div>
                    </div>

                    {messageByPost[p.id] && (
                      <div style={{ marginTop: 10, fontSize: 12, color: messageByPost[p.id].startsWith("Joined") || messageByPost[p.id].startsWith("Accepted") ? "#34d399" : "#ef4444" }}>
                        {messageByPost[p.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
        </main>
      </div>
    </AuthGate>
  );
}