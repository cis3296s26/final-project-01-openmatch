"use client";

import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Sport = {
  id: number;
  name: string;
};

type Team = {
  id: number;
  name: string;
  sport: string;
  city: string;
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
  expires_at: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
};

type RecentMatch = {
  id: number;
  sport_id: number;
  sport_name: string;
  queue_type: "solo" | "team";
  title: string | null;
  skill: string | null;
  location: string | null;
  is_competitive: boolean;
  winner_side: "A" | "B" | null;
  score_side_a: number;
  score_side_b: number;
  ended_at: string | null;
  side: "A" | "B";
  mmr_before: number | null;
  mmr_after: number | null;
  team_id: number | null;
};

type MyTeam = {
  id: number;
  name: string;
  city: string;
  sport: string;
  member_count: number;
  rank: string;
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

const EXPIRATION_OPTIONS = [
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "24 hours", value: 1440 },
];

const SKILL_LEVELS = ["Casual", "Intermediate", "Competitive"];

function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) return "Expired";
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m left`;
  }
  return `${minutes}m left`;
}

function TimeRemaining({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("--");

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setTimeLeft(getTimeRemaining(expiresAt));
    });
    
    const interval = setInterval(() => {
      setTimeLeft(getTimeRemaining(expiresAt));
    }, 60000);
    
    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(interval);
    };
  }, [expiresAt]);

  return <>{timeLeft}</>;
}

export default function OpenMatchDashboard() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [recentMatchesLoading, setRecentMatchesLoading] = useState(true);
  const [sports, setSports] = useState<Sport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<MatchPost | null>(null);
  const [postMessage, setPostMessage] = useState("");
  const [formIsCompetitive, setFormIsCompetitive] = useState(false);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [myTeamsLoading, setMyTeamsLoading] = useState(true);
  const [mySports, setMySports] = useState<ProfileSport[]>([]);
  const [mySportsLoading, setMySportsLoading] = useState(true);

  const [formSportId, setFormSportId] = useState<number | null>(null);
  const [formTeamId, setFormTeamId] = useState<number | null>(null);
  const [formPostType, setFormPostType] = useState<"individual" | "team">("individual");
  const [formTitle, setFormTitle] = useState("");
  const [formSkill, setFormSkill] = useState("Casual");
  const [formLocation, setFormLocation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formExpiration, setFormExpiration] = useState(60);
  const [formPlayersPerSide, setFormPlayersPerSide] = useState(5);
  const [formSubmitting, setFormSubmitting] = useState(false);



  function handleLogout() {
    clearAuth();
    router.push("../login");
  }

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    fetchSports();
    fetchTeams();
    if (currentUser) {
      fetchUserPosts(currentUser.id);
      fetchRecentMatches(currentUser.id);
      fetchMyTeams(currentUser.id);
      fetchMySports(currentUser.id)
    }
  }, []);

  async function fetchMySports(userId: number) {
    setMySportsLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/profile-sports`, {
        headers: authHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setMySports(data);
      }
    } catch (err) {
      console.error("Failed to fetch my sports.")
    } finally {
      setMySportsLoading(false);
    }
  }

  async function fetchMyTeams(userId: number) {
    setMyTeamsLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/teams`, {
        headers: authHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setMyTeams(data);
      }
    } catch (err) {
      console.error("Failed to fetch my teams:", err);
    } finally {
      setMyTeamsLoading(false);
    }
  }

  async function fetchRecentMatches(userId: number) {
    setRecentMatchesLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/match-history`, {
        headers: authHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setRecentMatches(data);
      }
    } catch (err) {
      console.error("Failed to fetch recent matches:", err);
    } finally {
      setRecentMatchesLoading(false);
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

  async function fetchTeams() {
    try {
      const res = await fetch(`${API}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
  }

  async function fetchUserPosts(userId: number) {
    setPostsLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/posts`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }

  function openCreateModal() {
    setEditingPost(null);
    setFormSportId(null);
    setFormTeamId(null);
    setFormPostType("individual");
    setFormTitle("");
    setFormSkill("Casual");
    setFormLocation("");
    setFormNote("");
    setFormExpiration(60);
    setFormPlayersPerSide(5);
    setPostMessage("");
    setShowPostModal(true);
  }

  function openEditModal(post: MatchPost) {
    setEditingPost(post);
    setFormSportId(post.sport_id);
    setFormTitle(post.title);
    setFormSkill(post.skill);
    setFormIsCompetitive(post.skill === "Competitive");
    setFormLocation(post.location || "");
    setFormNote(post.note || "");
    setPostMessage("");
    setShowPostModal(true);
  }

  function closeModal() {
    setShowPostModal(false);
    setEditingPost(null);
    setPostMessage("");
  }

  async function handleCreatePost() {
    if (!formSportId || !formTitle || !formSkill) {
      setPostMessage("Please fill in required fields");
      return;
    }

    if (formPostType === "team" && !formTeamId) {
      setPostMessage("Please select a team for team posts");
      return;
    }

    setFormSubmitting(true);
    setPostMessage("");

    try {
      const res = await fetch(`${API}/posts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sport_id: formSportId,
          team_id: formTeamId || null,
          title: formTitle,
          skill: formSkill,
          is_competitive: formIsCompetitive,
          location: formLocation || null,
          note: formNote || null,
          expires_in_minutes: formExpiration,
          players_per_side: formPlayersPerSide,
        }),
      });

      if (res.ok) {
        const newPost = await res.json();
        setPosts([newPost, ...posts]);
        closeModal();
      } else if (res.status === 401) {
        setPostMessage("Session expired. Please log in again.");
        router.push("/login");
      } else {
        const err = await res.json();
        setPostMessage(err.detail || "Failed to create post");
      }
    } catch {
      setPostMessage("Error creating post. Is the backend running?");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleUpdatePost() {
    if (!editingPost || !formTitle || !formSkill) {
      setPostMessage("Please fill in required fields");
      return;
    }

    setFormSubmitting(true);
    setPostMessage("");

    try {
      const res = await fetch(`${API}/posts/${editingPost.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          title: formTitle,
          skill: formSkill,
          is_competitive: formIsCompetitive,
          location: formLocation || null,
          note: formNote || null,
        }),
      });

      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(posts.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p)));
        closeModal();
      } else if (res.status === 401) {
        setPostMessage("Session expired. Please log in again.");
        router.push("/login");
      } else {
        const err = await res.json();
        setPostMessage(err.detail || "Failed to update post");
      }
    } catch {
      setPostMessage("Error updating post. Is the backend running?");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeletePost(postId: number) {
    if (!confirm("Are you sure you want to remove this post?")) return;

    try {
      const res = await fetch(`${API}/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch {
      console.error("Error deleting post");
    }
  }

  const nearbyRequests = [
    { initials: "MR", name: "Marco R.", desc: "Casual 7v7 — Clark Park turf", tags: ["Soccer", "Casual", "7v7"], time: "5m", isTeam: false },
    { initials: "SP", name: "Sunrise Picklers", desc: "Doubles, any level welcome", tags: ["Pickleball", "Casual"], time: "12m", isTeam: true },
    { initials: "AL", name: "Ash L.", desc: "Street tennis doubles — LOVE Park", tags: ["Tennis", "Intermediate"], time: "31m", isTeam: false },
  ];


  return (
    <AuthGate>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .card { background: #0c0c0c; border: 1px solid #191919; border-radius: 18px; box-shadow: 0 8px 40px rgba(0,0,0,0.55); }
        .match-row { transition: background 0.12s; cursor: default; }
        .match-row:hover { background: rgba(255,255,255,0.015); }

        .ghost-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 9px;
          padding: 6px 14px; font-size: 12px; color: #52525b; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s;
        }
        .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        .danger-btn {
          background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.16);
          border-radius: 9px; padding: 6px 14px; font-size: 12px; color: #ef4444;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .danger-btn:hover { background: rgba(239,68,68,0.08); }
        .accept-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 5px 12px; font-size: 11px; color: #71717a; cursor: pointer;
          font-family: 'DM Sans', sans-serif; flex-shrink: 0; transition: border-color 0.15s, color 0.15s;
        }
        .accept-btn:hover { border-color: #2e2e2e; color: #d4d4d8; }
        .nav-btn {
          background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
          font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-content {
          background: #0c0c0c; border: 1px solid #1e1e1e; border-radius: 16px;
          padding: 24px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
        }
        .form-input {
          width: 100%; background: #111; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 10px 12px; color: #e4e4e7; font-size: 14px; font-family: inherit;
        }
        .form-input:focus { outline: none; border-color: #34d399; }
        .form-input::placeholder { color: #52525b; }
        .form-label { display: block; font-size: 12px; color: #71717a; margin-bottom: 6px; }
        .primary-btn {
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          border: none; border-radius: 9px; padding: 10px 20px; font-size: 13px;
          font-weight: 600; color: #fff; cursor: pointer; font-family: inherit;
        }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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
                      className={`nav-btn${item.label === "Dashboard" ? " active" : ""}`}
                      style={{ textDecoration: "none" }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
            </div>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setMenuOpen((o) => !o)}
                style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid #222", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#71717a", cursor: "pointer" }}
              >
                {user
                  ? user.display_name
                    ? user.display_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                    : `${user.first_name[0]}${user.last_name?.[0] ?? ""}`
                  : "?"}
              </div>

              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: 42, right: 0, zIndex: 50, background: "#0f0f0f", border: "1px solid #222", borderRadius: 12, padding: "6px", minWidth: 160, boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                    
                    {/* Name */}
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#3f3f46", borderBottom: "1px solid #1a1a1a", marginBottom: 4 }}>
                      {user ? (user.display_name || `${user.first_name} ${user.last_name ?? ""}`.trim()) : "Account"}
                    </div>

                    {/* Profile link */}
                    <Link
                      href="../profile"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#a1a1aa", borderRadius: 8, textDecoration: "none" }}
                    >
                      Profile
                    </Link>

                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 12px", fontSize: 13, color: "#ef4444", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Main two-column layout ── */}
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>

            {/* ── LEFT: greeting → active posts → recent matches ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* Greeting */}
              <div style={{ marginBottom: 36 }}>
                <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>
                  Hey, {user?.first_name || "there"}
                </h1>
                <p style={{ marginTop: 10, fontSize: 13, color: "#3f3f46" }}>Ready up per team to let nearby players find you</p>
              </div>

              {/* Active posts */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Active posts</h2>
                <button className="ghost-btn" onClick={openCreateModal}>+ New post</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {postsLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#52525b" }}>Loading posts...</div>
                ) : posts.length === 0 ? (
                  <div className="card" style={{ padding: 40, textAlign: "center" }}>
                    <p style={{ color: "#52525b", marginBottom: 12 }}>No active posts yet</p>
                    <button className="ghost-btn" onClick={openCreateModal}>Create your first post</button>
                  </div>
                ) : (
                  posts.map((post) => {
                    const sportColor = SPORT_COLORS[post.sport_name] || "#4ade80";
                    return (
                      <div key={post.id} className="card" style={{ padding: "20px 22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: sportColor }}>
                                {post.sport_name.toUpperCase()}
                              </span>
                              <span style={{ color: "#222" }}>·</span>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 5,
                                background: post.team_id ? "rgba(96,165,250,0.1)" : "rgba(168,85,247,0.1)",
                                border: `1px solid ${post.team_id ? "rgba(96,165,250,0.2)" : "rgba(168,85,247,0.2)"}`,
                                color: post.team_id ? "#93c5fd" : "#c4b5fd",
                              }}>
                                {post.team_id ? "Team" : "Individual"}
                              </span>
                              <span style={{ color: "#222" }}>·</span>
                              <span style={{ fontSize: 11, color: "#3f3f46" }}>{post.skill}</span>
                              {post.team_name && (
                                <>
                                  <span style={{ color: "#222" }}>·</span>
                                  <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>{post.team_name}</span>
                                </>
                              )}
                            </div>
                            <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", color: "#fafafa", lineHeight: 1.2 }}>
                              {post.title}
                              {post.location && <span style={{ color: "#71717a" }}> · {post.location}</span>}
                            </h3>
                            {post.note && (
                              <p style={{ marginTop: 8, fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>
                                &quot;{post.note}&quot;
                              </p>
                            )}
                          </div>
                          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#3f3f46", whiteSpace: "nowrap", alignSelf: "flex-start", flexShrink: 0 }}>
                            <TimeRemaining expiresAt={post.expires_at} />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", borderTop: "1px solid #161616", paddingTop: 14 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="ghost-btn" onClick={() => openEditModal(post)}>Edit</button>
                            <button className="danger-btn" onClick={() => handleDeletePost(post.id)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Recent matches */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Recent matches</h2>
                <button className="ghost-btn">View all</button>
              </div>

              <div className="card" style={{ overflow: "hidden" }}>
                {recentMatchesLoading ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#52525b" }}>
                    Loading recent matches...
                  </div>
                ) : recentMatches.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#52525b" }}>
                    No completed matches yet
                  </div>
                ) : (
                  recentMatches.map((match, i) => {
                    const win = match.winner_side === match.side;
                    const score = `${match.score_side_a} – ${match.score_side_b}`;
                    const postTypeLabel = match.queue_type === "team" ? "Team" : "Individual";
                    const sportColor = SPORT_COLORS[match.sport_name] || "#4ade80";

                    const mmrDelta =
                      match.mmr_before !== null && match.mmr_after !== null
                        ? match.mmr_after - match.mmr_before
                        : null;

                    let mmrText =
                      mmrDelta === null
                        ? null
                        : `${mmrDelta > 0 ? "+" : ""}${mmrDelta}`;

                    if (!match.is_competitive) {
                      mmrText = null;
                    }
                    const metaParts = [];
                    if (match.ended_at) {
                      metaParts.push(
                        new Date(match.ended_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      );
                    }
                    if (match.location) {
                      metaParts.push(match.location);
                    }

                    return (
                      <div
                        key={match.id}
                        className="match-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "13px 20px",
                          borderBottom: i !== recentMatches.length - 1 ? "1px solid #131313" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              background: win ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                              border: `1px solid ${win ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 800,
                              color: win ? "#4ade80" : "#f87171",
                            }}
                          >
                            {win ? "W" : "L"}
                          </div>
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
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
                                {match.sport_name.toUpperCase()}
                              </span>

                              <span style={{ color: "#222" }}>·</span>

                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 5,
                                  background:
                                    match.queue_type === "team"
                                      ? "rgba(96,165,250,0.1)"
                                      : "rgba(168,85,247,0.1)",
                                  border: `1px solid ${
                                    match.queue_type === "team"
                                      ? "rgba(96,165,250,0.2)"
                                      : "rgba(168,85,247,0.2)"
                                  }`,
                                  color: match.queue_type === "team" ? "#93c5fd" : "#c4b5fd",
                                }}
                              >
                                {postTypeLabel}
                              </span>

                              {match.skill && (
                                <>
                                  <span style={{ color: "#222" }}>·</span>
                                  <span style={{ fontSize: 11, color: "#3f3f46" }}>{match.skill}</span>
                                </>
                              )}
                            </div>

                            <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>
                              {match.title || "Match"}
                            </div>

                            <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 2 }}>
                              {metaParts.join(" · ")}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#52525b" }}>
                            {score}
                          </div>

                          {mmrText && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: mmrDelta !== null && mmrDelta > 0 ? "#4ade80" : "#f87171",
                              }}
                            >
                              {mmrText} MMR
                            </span>
                          )}

                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: 7,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.07em",
                              background: win ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
                              border: `1px solid ${win ? "rgba(74,222,128,0.16)" : "rgba(248,113,113,0.16)"}`,
                              color: win ? "#86efac" : "#fca5a5",
                            }}
                          >
                            {win ? "WIN" : "LOSS"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {/* ── RIGHT: record → nearby requests → my teams ── */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Record — sits at top of sidebar, aligned with greeting */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.05em", color: "#fafafa", lineHeight: 1 }}></div>
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 7, letterSpacing: "0.06em", textTransform: "uppercase" }}></div>
              </div>

              {/* Nearby requests */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Nearby requests</h2>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>3 open</span>
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  {nearbyRequests.map((req, i) => (
                    <div key={req.name} style={{ padding: "14px 16px", borderBottom: i !== nearbyRequests.length - 1 ? "1px solid #131313" : "none" }}>
                      <div style={{ display: "flex", gap: 11 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#52525b", flexShrink: 0 }}>
                          {req.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{req.name}</div>
                              <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 2 }}>{req.desc}</div>
                            </div>
                            <span style={{ fontSize: 10, color: "#3f3f46", flexShrink: 0 }}>{req.time}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                background: req.isTeam ? "rgba(96,165,250,0.1)" : "rgba(168,85,247,0.1)",
                                border: `1px solid ${req.isTeam ? "rgba(96,165,250,0.2)" : "rgba(168,85,247,0.2)"}`,
                                color: req.isTeam ? "#93c5fd" : "#c4b5fd",
                              }}>
                                {req.isTeam ? "Team" : "Individual"}
                              </span>
                              {req.tags.map((tag, ti) => (
                                <span key={tag} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500, background: ti === 0 ? "rgba(96,165,250,0.07)" : "#111", border: `1px solid ${ti === 0 ? "rgba(96,165,250,0.18)" : "#1e1e1e"}`, color: ti === 0 ? "#93c5fd" : "#52525b" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <button className="accept-btn">Accept</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* My teams */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>My teams</h2>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                    {myTeamsLoading ? "..." : `${myTeams.length} team${myTeams.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {myTeamsLoading ? (
                  <div className="card" style={{ padding: 24, textAlign: "center", color: "#52525b" }}>
                    Loading teams...
                  </div>
                ) : myTeams.length === 0 ? (
                  <div className="card" style={{ padding: 24, textAlign: "center", color: "#52525b" }}>
                    You are not on any teams yet
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {myTeams.map((team) => (
                      <Link
                        key={team.id}
                        href={`/my-teams/${team.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div
                          style={{
                            background: "#0c0c0c",
                            border: "1px solid #191919",
                            borderRadius: 16,
                            padding: "14px 16px",
                            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 9,
                                  background: "#111",
                                  border: "1px solid #1e1e1e",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: "#52525b",
                                  flexShrink: 0,
                                }}
                              >
                                {team.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#e4e4e7",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {team.name}
                                </div>
                                <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 1 }}>
                                  {team.sport} · {team.city} · {team.member_count} member{team.member_count === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>

                            <span
                              style={{
                                padding: "3px 9px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(96,165,250,0.07)",
                                border: "1px solid rgba(96,165,250,0.16)",
                                color: "#93c5fd",
                                flexShrink: 0,
                              }}
                            >
                              {team.rank}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              </aside>
            </div>
          </main>
        </div>

      {/* ── Post Modal ── */}
      {showPostModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fafafa", marginBottom: 20 }}>
              {editingPost ? "Edit Post" : "Create New Post"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!editingPost && (
                <>
                  <div>
                    <label className="form-label">Post Type *</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFormPostType("individual");
                          setFormTeamId(null);
                          setFormSportId(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: formPostType === "individual" ? "1px solid rgba(168,85,247,0.4)" : "1px solid #1e1e1e",
                          background: formPostType === "individual" ? "rgba(168,85,247,0.1)" : "#111",
                          color: formPostType === "individual" ? "#c4b5fd" : "#52525b",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormPostType("team");
                          setFormSportId(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: formPostType === "team" ? "1px solid rgba(96,165,250,0.4)" : "1px solid #1e1e1e",
                          background: formPostType === "team" ? "rgba(96,165,250,0.1)" : "#111",
                          color: formPostType === "team" ? "#93c5fd" : "#52525b",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        Team
                      </button>
                    </div>
                  </div>

                  {formPostType === "team" && (
                    <div>
                      <label className="form-label">Select Team *</label>
                      <select
                        className="form-input"
                        value={formTeamId ?? ""}
                        onChange={(e) => {
                          const teamId = e.target.value ? Number(e.target.value) : null;
                          setFormTeamId(teamId);
                          
                          if (teamId) {
                            const selectedTeam = teams.find(t => t.id === teamId);
                            if (selectedTeam) {
                              const matchingSport = sports.find(s => s.name === selectedTeam.sport);
                              if (matchingSport) {
                                setFormSportId(matchingSport.id);
                              }
                            }
                          } else {
                            setFormSportId(null);
                          }
                        }}
                      >
                        <option value="">Choose a team...</option>
                        {myTeams.length > 0 ? (
                          myTeams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name} ({team.sport})</option>
                          ))
                        ) : (
                          <option value="" disabled>No teams available</option>
                        )}
                      </select>
                      {myTeams.length === 0 && (
                        <p style={{ fontSize: 11, color: "#71717a", marginTop: 6 }}>
                          You need to create or join a team first.
                        </p>
                      )}
                    </div>
                  )}

                  {formPostType === "individual" && (
                    <div>
                      <label className="form-label">Sport *</label>
                      <select
                        className="form-input"
                        value={formSportId ?? ""}
                        onChange={(e) => setFormSportId(e.target.value ? Number(e.target.value) : null)}
                      >
                        
                        <option value="">
                          {mySportsLoading ? "Loading Sports..." : 
                          ( mySports.length === 0 ? "No sports found! Please create one in your profile." : "Select a sport...")}
                        </option>
                          {!mySportsLoading && mySports.length>0 && mySports.map((sport) => (
                        <option key={sport.sport_id} value={sport.sport_id}>{sport.sport_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Intermediate 5v5"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Skill Level *</label>
                  <select
                    className="form-input"
                    value={formSkill}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormSkill(value);
                      setFormIsCompetitive(value === "Competitive");
                    }}
                  >
                    {SKILL_LEVELS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
              </div>

              <div>
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., FDR Park"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Note / Message</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Add a message for other players..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  style={{ resize: "none" }}
                />
              </div>

              {!editingPost && (
                <>
                  <div>
                    <label className="form-label">Players Per Side *</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      max={50}
                      value={formPlayersPerSide}
                      onChange={(e) => setFormPlayersPerSide(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    />
                    <p style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>
                      How many players each side needs before the 5-minute ready window starts
                    </p>
                  </div>
                  <div>
                    <label className="form-label">Expires In</label>
                    <select
                      className="form-input"
                      value={formExpiration}
                      onChange={(e) => setFormExpiration(Number(e.target.value))}
                    >
                      {EXPIRATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {postMessage && (
                <p style={{ fontSize: 13, color: postMessage.includes("expired") ? "#ef4444" : "#ef4444" }}>
                  {postMessage}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  className="primary-btn"
                  style={{ flex: 1 }}
                  disabled={formSubmitting}
                  onClick={editingPost ? handleUpdatePost : handleCreatePost}
                >
                  {formSubmitting ? "Saving..." : editingPost ? "Save Changes" : "Create Post"}
                </button>
                <button className="ghost-btn" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthGate>
  );
}
