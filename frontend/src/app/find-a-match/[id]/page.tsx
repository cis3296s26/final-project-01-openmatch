"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { authHeaders, clearAuth, getUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

const SPORT_COLORS: Record<string, string> = {
  Soccer: "#4ade80",
  Basketball: "#fb923c",
  Tennis: "#facc15",
  Pickleball: "#a78bfa",
  Volleyball: "#f472b6",
  "Flag Football": "#60a5fa",
  Badminton: "#34d399",
  Softball: "#fbbf24",
  "Ultimate Frisbee": "#c084fc",
  Hockey: "#38bdf8",
  Rugby: "#fb7185",
  Lacrosse: "#2dd4bf",
};

type Participant = {
  id: number;
  match_post_id: number;
  user_id: number;
  username: string | null;
  side: "A" | "B";
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

type LiveMatchLookup = {
  id: number;
  status: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCountdown(targetIso: string | null, nowMs: number): string | null {
  if (!targetIso) return null;
  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) return "0:00";
  const totalSec = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MatchLobbyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [liveMatch, setLiveMatch] = useState<LiveMatchLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [joining, setJoining] = useState(false);
  const [readying, setReadying] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [postRes, liveMatchRes] = await Promise.all([
        fetch(`${API}/posts/${postId}`),
        fetch(`${API}/posts/${postId}/live-match`, {
          headers: authHeaders(),
        }),
      ]);

      if (!postRes.ok) {
        setMsg("Post not found.");
        setPost(null);
        setLiveMatch(null);
        return;
      }

      const postData = (await postRes.json()) as PostDetail;
      setPost(postData);

      if (liveMatchRes.ok) {
        const liveMatchData = (await liveMatchRes.json()) as LiveMatchLookup;
        setLiveMatch({
          id: liveMatchData.id,
          status: liveMatchData.status,
        });
      } else if (liveMatchRes.status === 404) {
        setLiveMatch(null);
      } else if (liveMatchRes.status === 403) {
        setLiveMatch(null);
      } else {
        setLiveMatch(null);
      }
    } catch {
      setMsg("Backend not reachable.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const myParticipant = useMemo(() => {
    if (!post || !user) return null;
    const userId = Number((user as any).id ?? (user as any).sub ?? 0);
    return post.participants.find((p) => p.user_id === userId) ?? null;
  }, [post, user]);

  const countdown = useMemo(
    () => formatCountdown(post?.ready_deadline_at ?? null, now),
    [post?.ready_deadline_at, now]
  );

  const selectedParticipants = useMemo(
    () => (post ? post.participants.filter((p) => p.selected_for_match) : []),
    [post]
  );

  const readyCounts = useMemo(() => {
    const total = selectedParticipants.length;
    const ready = selectedParticipants.filter((p) => p.ready).length;
    return { total, ready };
  }, [selectedParticipants]);

  const sideAPlayers = useMemo(
    () => (post ? post.participants.filter((p) => p.side === "A") : []),
    [post]
  );

  const sideBPlayers = useMemo(
    () => (post ? post.participants.filter((p) => p.side === "B") : []),
    [post]
  );

  const sideASelected = useMemo(
    () => sideAPlayers.filter((p) => p.selected_for_match),
    [sideAPlayers]
  );

  const sideBSelected = useMemo(
    () => sideBPlayers.filter((p) => p.selected_for_match),
    [sideBPlayers]
  );

  const sportColor = post ? SPORT_COLORS[post.sport_name] || "#4ade80" : "#4ade80";
  const isTeam = post?.team_id !== null;
  const pps = post?.players_per_side ?? 5;

  const isOpen = post?.status === "open";
  const isReadyPending = post?.status === "ready_pending";
  const isConfirmed = post?.status === "confirmed";

  const canJoin = !!post && isOpen && !myParticipant;
  const canReady = !!post && isReadyPending && !!myParticipant && !myParticipant.ready;
  const canEnterLiveMatch =
    !!liveMatch &&
    !!myParticipant &&
    myParticipant.selected_for_match &&
    myParticipant.ready;

  useEffect(() => {
    if (!canEnterLiveMatch || !liveMatch) return;

    const key = `live-match-autoredirect-${liveMatch.id}`;
    const alreadyRedirected = sessionStorage.getItem(key);

    if (alreadyRedirected) return;

    sessionStorage.setItem(key, "1");

    const t = setTimeout(() => {
      router.push(`/find-a-match/${postId}/live-match-page`);
    }, 1200);

    return () => clearTimeout(t);
  }, [canEnterLiveMatch, liveMatch, postId, router]);

  async function joinPost() {
    if (!post || joining) return;
    setJoining(true);
    setMsg("");

    try {
      const endpoint = post.team_id
        ? `${API}/posts/${postId}/join`
        : `${API}/posts/${postId}/accept-individual`;

      const body = post.team_id ? JSON.stringify({}) : undefined;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.detail || "Failed to join.");
        return;
      }

      setMsg(post.team_id ? "Joined team post." : "Accepted individual post.");
      await refresh();
    } catch {
      setMsg("Backend not reachable.");
    } finally {
      setJoining(false);
    }
  }

  async function readyUp() {
    if (readying) return;
    setReadying(true);
    setMsg("");

    try {
      const res = await fetch(`${API}/posts/${postId}/ready`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.detail || "Failed to ready up.");
        return;
      }

      setMsg("You are ready.");
      await refresh();
    } catch {
      setMsg("Backend not reachable.");
    } finally {
      setReadying(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#52525b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Loading lobby...
      </div>
    );
  }

  if (!post) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#52525b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Post not found or expired.
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .card {
          background: #0c0c0c;
          border: 1px solid #191919;
          border-radius: 18px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.55);
        }
        .nav-btn {
          background: transparent;
          border: none;
          border-radius: 10px;
          padding: 6px 14px;
          font-size: 13px;
          color: #52525b;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
          text-decoration: none;
          display: inline-block;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }

        .primary-btn {
          width: 100%;
          border: none;
          border-radius: 11px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          color: white;
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          transition: transform 0.1s ease, opacity 0.2s ease, box-shadow 0.2s ease;
        }
        
        .primary-btn:active { transform: scale(0.98); }
        .primary-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

        .ghost-btn {
          width: 100%;
          background: #111;
          border: 1px solid #222;
          border-radius: 11px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #71717a;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s ease;
        }
        .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        .ghost-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .live-btn {
          width: 100%;
          border: none;
          border-radius: 11px;
          padding: 13px 16px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          color: white;
          background: linear-gradient(135deg, #065f46 0%, #10b981 45%, #34d399 100%);
        }
        .live-btn:active { transform: scale(0.98); }

        @keyframes live-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(52,211,153,0.38),
              0 0 28px rgba(52,211,153,0.38),
              0 0 70px rgba(16,185,129,0.18);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(52,211,153,0.55),
              0 0 42px rgba(52,211,153,0.58),
              0 0 90px rgba(16,185,129,0.28);
          }
        }

        .countdown-glow {
          animation: count-pulse 1s ease-in-out infinite;
        }
        @keyframes count-pulse {
          0%, 100% { text-shadow: 0 0 8px rgba(250,204,21,0.35); }
          50% { text-shadow: 0 0 22px rgba(250,204,21,0.7); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#e4e4e7",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #141414",
            background: "rgba(8,8,8,0.97)",
            backdropFilter: "blur(14px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "0 28px",
              height: 54,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#34d399",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 11,
                    color: "#080808",
                    boxShadow: "0 0 18px rgba(52,211,153,0.35)",
                  }}
                >
                  OM
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "-0.025em",
                    color: "#fafafa",
                  }}
                >
                  OpenMatch
                </span>
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
                    className={`nav-btn${item.label === "Find a Match" ? " active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div style={{ position: "relative" }}>
              <div
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1px solid #222",
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#71717a",
                  cursor: "pointer",
                }}
              >
                {user
                  ? (user as any).display_name
                    ? initials((user as any).display_name)
                    : `${(user as any).first_name?.[0] ?? ""}${(user as any).last_name?.[0] ?? ""}`.toUpperCase()
                  : "?"}
              </div>

              {menuOpen && (
                <>
                  <div
                    onClick={() => setMenuOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 42,
                      right: 0,
                      zIndex: 50,
                      background: "#0f0f0f",
                      border: "1px solid #222",
                      borderRadius: 12,
                      padding: 6,
                      minWidth: 160,
                      boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#3f3f46",
                        borderBottom: "1px solid #1a1a1a",
                        marginBottom: 4,
                      }}
                    >
                      {user
                        ? (user as any).display_name ||
                          `${(user as any).first_name ?? ""} ${(user as any).last_name ?? ""}`.trim()
                        : "Account"}
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: "block",
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#a1a1aa",
                        borderRadius: 8,
                        textDecoration: "none",
                      }}
                    >
                      Profile
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#ef4444",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>
          <div style={{ marginBottom: 28 }}>
            <Link
              href="/find-a-match"
              style={{
                color: "#52525b",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              ← Back to posts
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 24,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card" style={{ padding: "22px 24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: sportColor,
                    }}
                  >
                    {post.sport_name.toUpperCase()}
                  </span>

                  <span style={{ color: "#222" }}>·</span>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: isTeam
                        ? "rgba(96,165,250,0.1)"
                        : "rgba(168,85,247,0.1)",
                      border: `1px solid ${
                        isTeam ? "rgba(96,165,250,0.2)" : "rgba(168,85,247,0.2)"
                      }`,
                      color: isTeam ? "#93c5fd" : "#c4b5fd",
                    }}
                  >
                    {isTeam ? "Team" : "Individual"}
                  </span>

                  <span style={{ color: "#222" }}>·</span>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>{post.skill}</span>
                  <span style={{ color: "#222" }}>·</span>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                    {pps}v{pps}
                  </span>

                  {post.team_name && (
                    <>
                      <span style={{ color: "#222" }}>·</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#60a5fa",
                          fontWeight: 600,
                        }}
                      >
                        {post.team_name}
                      </span>
                    </>
                  )}
                </div>

                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#fafafa",
                    lineHeight: 1.15,
                  }}
                >
                  {post.title}
                  {post.location && (
                    <span style={{ color: "#52525b", fontWeight: 500 }}>
                      {" "}
                      · {post.location}
                    </span>
                  )}
                </h1>

                {post.note && (
                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: "#3f3f46",
                      fontStyle: "italic",
                    }}
                  >
                    &quot;{post.note}&quot;
                  </p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "Side A", players: sideAPlayers, selected: sideASelected },
                  { label: "Side B", players: sideBPlayers, selected: sideBSelected },
                ].map((side) => (
                  <div key={side.label} className="card" style={{ padding: "18px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                      }}
                    >
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8" }}>
                        {side.label}
                      </h3>
                      <span style={{ fontSize: 11, color: "#3f3f46" }}>
                        {side.players.length}/{pps}
                      </span>
                    </div>

                    <div
                      style={{
                        height: 3,
                        background: "#191919",
                        borderRadius: 2,
                        marginBottom: 16,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (side.players.length / pps) * 100)}%`,
                          background: sportColor,
                          borderRadius: 2,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    {side.players.length === 0 ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#3f3f46",
                          padding: "12px 0",
                          textAlign: "center",
                        }}
                      >
                        Waiting for players...
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {side.players.map((p, i) => (
                          <div
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 0",
                              borderBottom:
                                i < side.players.length - 1 ? "1px solid #141414" : "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  background: p.ready ? "rgba(52,211,153,0.08)" : "#111",
                                  border: `1px solid ${
                                    p.ready ? "rgba(52,211,153,0.2)" : "#1e1e1e"
                                  }`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: p.ready ? "#34d399" : "#52525b",
                                }}
                              >
                                {p.username ? initials(p.username) : `U${p.user_id}`}
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#e4e4e7",
                                  }}
                                >
                                  {p.username ?? `User ${p.user_id}`}
                                </div>
                                {p.team_id && (
                                  <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 1 }}>
                                    Team {p.team_id}
                                  </div>
                                )}
                              </div>
                            </div>

                            {p.selected_for_match && (
                              <span
                                style={{
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: p.ready
                                    ? "rgba(52,211,153,0.08)"
                                    : "rgba(161,161,170,0.06)",
                                  border: `1px solid ${
                                    p.ready
                                      ? "rgba(52,211,153,0.2)"
                                      : "rgba(161,161,170,0.12)"
                                  }`,
                                  color: p.ready ? "#34d399" : "#52525b",
                                }}
                              >
                                {p.ready ? "READY" : "NOT READY"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="card" style={{ padding: "22px 20px" }}>
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#3f3f46",
                    marginBottom: 16,
                  }}
                >
                  Status
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 7,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      background: canEnterLiveMatch
                        ? "rgba(52,211,153,0.08)"
                        : isConfirmed
                        ? "rgba(52,211,153,0.08)"
                        : isReadyPending
                        ? "rgba(250,204,21,0.08)"
                        : "rgba(161,161,170,0.06)",
                      border: `1px solid ${
                        canEnterLiveMatch
                          ? "rgba(52,211,153,0.2)"
                          : isConfirmed
                          ? "rgba(52,211,153,0.2)"
                          : isReadyPending
                          ? "rgba(250,204,21,0.2)"
                          : "rgba(161,161,170,0.12)"
                      }`,
                      color: canEnterLiveMatch
                        ? "#34d399"
                        : isConfirmed
                        ? "#34d399"
                        : isReadyPending
                        ? "#facc15"
                        : "#71717a",
                    }}
                  >
                    {canEnterLiveMatch
                      ? "live match ready"
                      : post.status.replace("_", " ")}
                  </span>
                </div>

                {isReadyPending && countdown !== null && (
                  <div style={{ textAlign: "center", marginBottom: 18 }}>
                    <div
                      className="countdown-glow"
                      style={{
                        fontSize: 36,
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: "#facc15",
                        lineHeight: 1,
                      }}
                    >
                      {countdown}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#52525b",
                        marginTop: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      time to ready up
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#71717a" }}>Side A</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>
                        {sideAPlayers.length}/{pps}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "#191919",
                        borderRadius: 3,
                        overflow: "hidden",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (sideAPlayers.length / pps) * 100)}%`,
                          background: sportColor,
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#71717a" }}>Side B</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>
                        {sideBPlayers.length}/{pps}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "#191919",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (sideBPlayers.length / pps) * 100)}%`,
                          background: sportColor,
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {isReadyPending && (
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#71717a" }}>Ready progress</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#d4d4d8" }}>
                        {readyCounts.ready}/{readyCounts.total}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "#191919",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width:
                            readyCounts.total > 0
                              ? `${(readyCounts.ready / readyCounts.total) * 100}%`
                              : "0%",
                          background: "linear-gradient(90deg, #047857, #34d399)",
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {isConfirmed && !liveMatch && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      textAlign: "center",
                      background: "rgba(52,211,153,0.06)",
                      border: "1px solid rgba(52,211,153,0.2)",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#34d399" }}>
                      Match Confirmed
                    </div>
                    <div style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>
                      Creating live match...
                    </div>
                  </div>
                )}

                {canEnterLiveMatch && liveMatch && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      textAlign: "center",
                      background: "rgba(52,211,153,0.08)",
                      border: "1px solid rgba(52,211,153,0.22)",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#34d399" }}>
                      Live Match Ready
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Redirecting to match #{liveMatch.id}...
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#0a0a0a",
                    border: "1px solid #151515",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#3f3f46",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    Your status
                  </div>

                  {!user ? (
                    <div style={{ fontSize: 12, color: "#52525b" }}>Not logged in</div>
                  ) : !myParticipant ? (
                    <div style={{ fontSize: 12, color: "#71717a" }}>Not joined yet</div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#d4d4d8" }}>
                      Joined · Side {myParticipant.side}
                      {myParticipant.ready && (
                        <span style={{ color: "#34d399", fontWeight: 600 }}> · Ready</span>
                      )}
                      {!myParticipant.ready && isReadyPending && (
                        <span style={{ color: "#facc15", fontWeight: 600 }}>
                          {" "}
                          · Awaiting ready
                        </span>
                      )}
                      {canEnterLiveMatch && (
                        <span style={{ color: "#34d399", fontWeight: 700 }}>
                          {" "}
                          · Match access granted
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {msg && (
                  <div
                    style={{
                      fontSize: 12,
                      color: msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("not")
                        ? "#ef4444"
                        : "#34d399",
                      marginBottom: 14,
                    }}
                  >
                    {msg}
                  </div>
                )}
              </div>

              {canJoin && (
                <button className="ghost-btn" disabled={joining} onClick={joinPost}>
                  {joining ? "Joining..." : isTeam ? "Join Match" : "Accept & Join"}
                </button>
              )}

              {canReady && (
                <button className="primary-btn" disabled={readying} onClick={readyUp}>
                  {readying ? "Submitting..." : "Ready Up"}
                </button>
              )}

              {myParticipant?.ready && !canEnterLiveMatch && isReadyPending && (
                <div className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                    You are ready
                  </div>
                  <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 4 }}>
                    Waiting for other players...
                  </div>
                </div>
              )}

              {canEnterLiveMatch && liveMatch && (
                <button
                  className="live-btn"
                  onClick={() => router.push(`/find-a-match/${postId}/live-match-page`)}
                >
                  Enter Live Match
                </button>
              )}
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}