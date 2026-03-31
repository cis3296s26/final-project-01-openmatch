"use client";

import { useState } from "react";
import { getUser, clearAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OpenMatchDashboard() {

  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getUser();

  function handleLogout() {
    clearAuth();
    router.push("../login");
  }


  const [teamStatuses, setTeamStatuses] = useState<Record<string, boolean>>({
    "Broad St Ballers": true,
    "The Rim Breakers": false,
  });

  const toggleReady = (teamName: string) => {
    setTeamStatuses((prev) => ({ ...prev, [teamName]: !prev[teamName] }));
  };

  const activePosts = [
    {
      sport: "SOCCER",
      team: "Broad St Ballers",
      title: "Intermediate 5v5 · FDR Park",
      quote: '"Chill vibe, just want a good run. Bring water."',
      views: 3,
      responses: 1,
      time: "18 min ago",
      sportColor: "#4ade80",
    },
    {
      sport: "BASKETBALL",
      team: "The Rim Breakers",
      title: "Competitive 3v3 · Palumbo Rec Center",
      quote: '"Looking for a serious game. No ball hogs."',
      views: 11,
      responses: 3,
      time: "2 hrs ago",
      sportColor: "#fb923c",
    },
  ];

  const nearbyRequests = [
    { initials: "MR", name: "Marco R.", desc: "Casual 7v7 — Clark Park turf", tags: ["Soccer", "Casual", "7v7"], time: "5m" },
    { initials: "SP", name: "Sunrise Picklers", desc: "Doubles, any level welcome", tags: ["Pickleball", "Casual"], time: "12m" },
    { initials: "AL", name: "Ash L.", desc: "Street tennis doubles — LOVE Park", tags: ["Tennis", "Intermediate"], time: "31m" },
  ];

  const recentMatches = [
    { team: "Eastside FC", meta: "Mar 27 · FDR Park", score: "3 – 1", win: true },
    { team: "North Philly Rovers", meta: "Mar 24 · Clark Park", score: "0 – 2", win: false },
    { team: "The Rim Breakers", meta: "Mar 21 · Palumbo Rec", score: "21 – 17", win: true },
    { team: "South Street Squad", meta: "Mar 18 · Cobb's Creek", score: "2 – 1", win: true },
    { team: "Fishtown Hoops", meta: "Mar 15 · Penn Treaty Park", score: "14 – 21", win: false },
  ];

  const myTeams = [
    { name: "Broad St Ballers", sport: "Soccer", meta: "Philadelphia · 9 members", rank: "Gold II" },
    { name: "The Rim Breakers", sport: "Basketball", meta: "Philadelphia · 5 members", rank: "Silver I" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ready-btn {
          position: relative; overflow: hidden; width: 100%; border: none;
          cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 10px 16px; border-radius: 11px;
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
                {user ? `${user.first_name[0]}${user.last_name?.[0] ?? ""}` : "?"}
              </div>

              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: 42, right: 0, zIndex: 50, background: "#0f0f0f", border: "1px solid #222", borderRadius: 12, padding: "6px", minWidth: 160, boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
                    
                    {/* Name */}
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#3f3f46", borderBottom: "1px solid #1a1a1a", marginBottom: 4 }}>
                      {user ? `${user.first_name} ${user.last_name ?? ""}`.trim() : "Account"}
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
                <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>Hey, Jordan</h1>
                <p style={{ marginTop: 10, fontSize: 13, color: "#3f3f46" }}>Ready up per team to let nearby players find you</p>
              </div>

              {/* Active posts */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Active posts</h2>
                <button className="ghost-btn">+ New post</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {activePosts.map((post) => (
                  <div key={post.title} className="card" style={{ padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: post.sportColor }}>{post.sport}</span>
                          <span style={{ color: "#222" }}>·</span>
                          <span style={{ fontSize: 11, color: "#3f3f46" }}>{post.team}</span>
                        </div>
                        <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em", color: "#fafafa", lineHeight: 1.2 }}>{post.title}</h3>
                        <p style={{ marginTop: 8, fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>{post.quote}</p>
                      </div>
                      <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#3f3f46", whiteSpace: "nowrap", alignSelf: "flex-start", flexShrink: 0 }}>
                        {post.time}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #161616", paddingTop: 14 }}>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#3f3f46" }}>
                        <span>{post.views} views</span>
                        <span style={{ color: "#3b82f6" }}>{post.responses} response{post.responses !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="ghost-btn">Edit</button>
                        <button className="danger-btn">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent matches */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Recent matches</h2>
                <button className="ghost-btn">View all</button>
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                {recentMatches.map((match, i) => (
                  <div key={match.team} className="match-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: i !== recentMatches.length - 1 ? "1px solid #131313" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: match.win ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${match.win ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: match.win ? "#4ade80" : "#f87171" }}>
                        {match.win ? "W" : "L"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>{match.team}</div>
                        <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 2 }}>{match.meta}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#52525b" }}>{match.score}</div>
                      <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", background: match.win ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)", border: `1px solid ${match.win ? "rgba(74,222,128,0.16)" : "rgba(248,113,113,0.16)"}`, color: match.win ? "#86efac" : "#fca5a5" }}>
                        {match.win ? "WIN" : "LOSS"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: record → nearby requests → my teams ── */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Record — sits at top of sidebar, aligned with greeting */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.05em", color: "#fafafa", lineHeight: 1 }}>3W – 2L</div>
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 7, letterSpacing: "0.06em", textTransform: "uppercase" }}>recent record</div>
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
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>2 teams</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {myTeams.map((team) => {
                    const isReady = teamStatuses[team.name] ?? false;
                    return (
                      <div key={team.name} style={{
                        background: "#0c0c0c",
                        border: `1px solid ${isReady ? "rgba(52,211,153,0.14)" : "#191919"}`,
                        borderRadius: 16,
                        padding: "14px 16px",
                        boxShadow: isReady ? "0 8px 40px rgba(0,0,0,0.5), 0 0 50px rgba(52,211,153,0.05)" : "0 8px 40px rgba(0,0,0,0.5)",
                        transition: "border-color 0.3s, box-shadow 0.3s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#52525b", flexShrink: 0 }}>
                              {team.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</div>
                              <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 1 }}>{team.sport} · {team.meta}</div>
                            </div>
                          </div>
                          <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)", color: "#93c5fd", flexShrink: 0 }}>
                            {team.rank}
                          </span>
                        </div>
                        <button
                          className={`ready-btn ${isReady ? "is-ready" : "not-ready"}`}
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
                            toggleReady(team.name);
                          }}
                        >
                          {isReady ? "Ready" : "Ready Up"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </aside>
          </div>
        </main>
      </div>
    </>
  );
}