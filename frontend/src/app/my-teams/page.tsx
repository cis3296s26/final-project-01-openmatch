"use client";

import AuthGate from "@/components/AuthGate";
import { authHeaders, clearAuth, getUser } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

// Team type: what information are we collecting from each team
type Team = {
  id: number;
  name: string;
  sport: string;
  sport_id: number;
  city: string;
  rank?: string;
  is_member: boolean;
  invite_only: boolean;
};

// Sport Type
type Sport = {
  id: number;
  name: string;
};


export default function MyTeamsPage() {
  const router = useRouter();
  // menuOpen - handles opening the user logout/profile dropdown from the header
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  // list of user teams and available teams. Teamloaading should be true while these are being grabbed
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  // For leaving and joining teams
  const [joiningTeamId, setJoiningTeamId] = useState<number | null>(null);
  const [leavingTeamId, setLeavingTeamId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: number; text: string; success: boolean } | null>(null);

  // For sport searching list
  const [sportFilter, setSportFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sports, setSports] = useState<Sport[]>([]);

  // Forms for team creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSport, setFormSport] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formIsOpen, setFormIsOpen] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  // Handlers
  function handleLogout() {
    clearAuth();
    router.push("../login");
  }

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (currentUser) {
      fetchSports()
      fetchTeams(currentUser.id);
    }
  }, []);

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

  // Real function for grabbing teams from the API
  async function fetchTeams(userId: number) {
    setTeamsLoading(true);
    try {
      const [memberRes, allRes] = await Promise.all([
        fetch(`${API}/users/${userId}/teams`, { headers: authHeaders() }),
        fetch(`${API}/teams`),
      ]);

      let memberTeamIds: Set<number> = new Set();

      if (memberRes.ok) {
        const memberData: Team[] = await memberRes.json();
        memberTeamIds = new Set(memberData.map((t) => t.id));
        setMyTeams(memberData.map((t) => ({ ...t, is_member: true })));
      }

      if (allRes.ok) {
        const allData: Team[] = await allRes.json();
        setAvailableTeams(
          allData
            .filter((t) => !memberTeamIds.has(t.id))
            .map((t) => ({ ...t, is_member: false }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setTeamsLoading(false);
    }
  }

  async function handleJoinTeam(teamId: number) {
    setJoiningTeamId(teamId);
    setActionMessage(null);
    try {
      const team = availableTeams.find((t) => t.id === teamId);
      const res = await fetch(`${API}/teams/${teamId}/join`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          role: "member",
          sport_id: team?.sport_id
        }),
      });

      if (res.ok) {
        const joined = availableTeams.find((t) => t.id === teamId);
        if (joined) {
          setMyTeams((prev) => [...prev, { ...joined, is_member: true }]);
          setAvailableTeams((prev) => prev.filter((t) => t.id !== teamId));
        }
        setActionMessage({ id: teamId, text: "You've joined the team!", success: true });
      } else if (res.status === 401) {
        router.push("/login");
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage({ id: teamId, text: err.detail || "Failed to join team.", success: false });
      }
    } catch {
      setActionMessage({ id: teamId, text: "Error joining team. Is the backend running?", success: false });
    } finally {
      setJoiningTeamId(null);
    }
  }

  async function handleLeaveTeam(teamId: number) {
    setLeavingTeamId(teamId);
    setActionMessage(null);
    try {
      // TODO: add leave api request and handle the results
      const res = await fetch(`${API}/teams/${teamId}/leave`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.ok) {
        const left = myTeams.find((t) => t.id === teamId);
        if (left) {
          setMyTeams((prev) => prev.filter((t) => t.id !== teamId));
          setAvailableTeams((prev) => [...prev, { ...left, is_member: false }]);
        }
        setActionMessage({ id: teamId, text: "You've left the team.", success: true });
      } else if (res.status === 401) {
        router.push("/login");
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage({ id: teamId, text: err.detail || "Failed to leave team.", success: false });
      }

    } catch {
      setActionMessage({ id: teamId, text: "Error leaving team. Is the backend running?", success: false });
    } finally {
      setLeavingTeamId(null);
    }
  }

  // Modal form for creation of team
  function openCreateModal() {
    setFormName("");
    setFormSport("");
    setFormCity("");
    setFormIsOpen(true);
    setFormMessage("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  // Team creation handle
  async function handleCreateTeam() {
    if (!formName || !formSport || !formCity) {
      setFormMessage("Please fill in all required fields.");
      return;
    }
  
    setFormSubmitting(true);
    setFormMessage("");

    try {
      console.log("Create Pressed")
      const res = await fetch(`${API}/teams`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: formName,
          sport_id: formSport,
          city: formCity,
          is_open: formIsOpen,
        }),
      });

      if (res.ok) {
        const newTeam: Team = await res.json();
        console.log("Created team response:", newTeam);
        setMyTeams((prev) => [{ ...newTeam, is_member: true }, ...prev]);
        closeCreateModal();
      } else if (res.status === 401) {
        setFormMessage("Session expired. Please log in again.");
        router.push("/login");
      } else {
        const err = await res.json();
        setFormMessage(err.detail || "Failed to create team.");
      }
    } catch {
      setFormMessage("Error creating team. Is the backend running?");
    } finally {
      setFormSubmitting(false);
    }
  }
  

  // Derived Data
  const allSports = Array.from(
    new Set([...myTeams, ...availableTeams].map((t) => t.sport))
  ).sort();

  const filteredAvailable = availableTeams.filter((t) => {
    const matchesSport = sportFilter === "All" || t.sport === sportFilter;
    const matchesSearch =
      searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  // Return the team's initials
  function TeamInitials({ name }: { name: string }) {
    return <>{name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</>;
  }

  // Create a unique color based on the sport's id
  function getSportColor(sportId: number): string {
    const hue = (sportId * 137) % 360; // 137 is the golden angle — spreads colors evenly
    return `hsl(${hue}, 70%, 65%)`;
  }

  // Main Component
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

        .danger-btn {
          background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.16);
          border-radius: 9px; padding: 6px 14px; font-size: 12px; color: #ef4444;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .danger-btn:hover { background: rgba(239,68,68,0.08); }
        .danger-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .join-btn {
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          border: none; border-radius: 9px; padding: 6px 16px; font-size: 12px;
          font-weight: 600; color: #fff; cursor: pointer; font-family: inherit;
          transition: opacity 0.15s;
        }
        .join-btn:hover { opacity: 0.88; }
        .join-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .nav-btn {
          background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
          font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
          text-decoration: none; display: inline-block;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }

        .filter-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 5px 12px; font-size: 11px; color: #52525b; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s; white-space: nowrap;
        }
        .filter-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        .filter-btn.active { background: #161616; border-color: #2e2e2e; color: #d4d4d8; }

        .search-input {
          background: #0f0f0f; border: 1px solid #1e1e1e; border-radius: 10px;
          padding: 8px 14px; color: #e4e4e7; font-size: 13px; font-family: inherit;
          width: 220px; transition: border-color 0.15s;
        }
        .search-input:focus { outline: none; border-color: #34d399; }
        .search-input::placeholder { color: #3f3f46; }

        .team-card {
          background: #0c0c0c; border: 1px solid #191919; border-radius: 16px;
          padding: 16px 18px; box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .team-card:hover { border-color: #222; }

        .sport-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 1px;
        }

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
                    className={`nav-btn${item.label === "My Teams" ? " active" : ""}`}
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
                    ? user.display_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
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
                    <Link
                      href="../profile"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "block", padding: "8px 12px", fontSize: 13, color: "#a1a1aa", borderRadius: 8, textDecoration: "none" }}
                    >
                      Profile
                    </Link>
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

        {/* ── Main content ── */}
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>

          {/* Page heading */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>
              My Teams
            </h1>
            <p style={{ marginTop: 10, fontSize: 13, color: "#3f3f46" }}>
              Manage your memberships and discover new teams to join
            </p>
          </div>

          {teamsLoading ? (
            <div style={{ padding: 80, textAlign: "center", color: "#52525b" }}>Loading teams...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

              {/* ── TOP: My Teams ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>My teams</h2>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                    {myTeams.length} {myTeams.length === 1 ? "team" : "teams"}
                  </span>
                </div>

                {myTeams.length === 0 ? (
                  <div className="card" style={{ padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>🏅</div>
                    <p style={{ color: "#52525b", fontSize: 13 }}>You haven't joined any teams yet.</p>
                    <p style={{ color: "#3f3f46", fontSize: 12, marginTop: 4 }}>Browse available teams below or {" "}
                    <button className="ghost-btn" onClick={openCreateModal}>create your own team</button>
                    {" "}to get started.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {myTeams.map((team) => {
                      const sportColor = getSportColor(team.sport_id) || "#71717a";
                      const wasActioned = actionMessage?.id === team.id;
                      return (
                        <div key={team.id} className="team-card">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              {/* Team avatar */}
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#52525b", flexShrink: 0 }}>
                                <TeamInitials name={team.name} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {team.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                                  <span className="sport-dot" style={{ background: sportColor }} />
                                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                                    {team.sport} · {team.city}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {team.rank && (
                              <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)", color: "#93c5fd", flexShrink: 0 }}>
                                {team.rank}
                              </span>
                            )}
                          </div>

                          {wasActioned && actionMessage && (
                            <p style={{ fontSize: 11, color: actionMessage.success ? "#34d399" : "#ef4444", marginBottom: 10 }}>
                              {actionMessage.text}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <Link
                              href={`/my-teams/${team.id}`}
                              className="ghost-btn"
                              style={{ textDecoration: "none" }}
                            >
                              View
                            </Link>
                            <button
                              className="danger-btn"
                              disabled={leavingTeamId === team.id}
                              onClick={() => handleLeaveTeam(team.id)}
                            >
                              {leavingTeamId === team.id ? "Leaving..." : "Leave"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, color: "#d4d4d8" }}>Available teams</h2>
                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                    {filteredAvailable.length} open
                  </span>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search teams..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      className={`filter-btn${sportFilter === "All" ? " active" : ""}`}
                      onClick={() => setSportFilter("All")}
                    >
                      All
                    </button>
                    {allSports.map((sport) => (
                      <button
                        key={sport}
                        className={`filter-btn${sportFilter === sport ? " active" : ""}`}
                        onClick={() => setSportFilter(sport)}
                      >
                        {sport}
                      </button>
                    ))}
                    </div>
                    <button className="ghost-btn" onClick={openCreateModal}>+ New team</button>
                </div>

                {filteredAvailable.length === 0 ? (
                  <div className="card" style={{ padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
                    <p style={{ color: "#52525b", fontSize: 13 }}>
                      {availableTeams.length === 0
                        ? "No open teams available right now."
                        : "No teams match your filters."}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredAvailable.map((team) => {
                      const sportColor = getSportColor(team.sport_id) || "#71717a";
                      const isJoining = joiningTeamId === team.id;
                      const wasActioned = actionMessage?.id === team.id;
                      return (
                        <div key={team.id} className="team-card">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              {/* Team avatar */}
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#52525b", flexShrink: 0 }}>
                                <TeamInitials name={team.name} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {team.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                                  <span className="sport-dot" style={{ background: sportColor }} />
                                  <span style={{ fontSize: 11, color: "#3f3f46" }}>
                                    {team.sport} · {team.city}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {wasActioned && actionMessage && (
                            <p style={{ fontSize: 11, color: actionMessage.success ? "#34d399" : "#ef4444", marginBottom: 10 }}>
                              {actionMessage.text}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <Link
                              href={`/my-teams/${team.id}`}
                              className="ghost-btn"
                              style={{ textDecoration: "none" }}
                            >
                              View
                            </Link>

                            {/* Disactivate join button if the team is invite only */}
                            {team.invite_only ? (
                              <button className="join-btn" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
                                Team is Invite Only
                              </button>
                            ) : (
                              <button
                                className="join-btn"
                                disabled={isJoining}
                                onClick={() => handleJoinTeam(team.id)}
                              >
                                {isJoining ? "Joining..." : "Join"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
      {/* ── Create Team Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fafafa", marginBottom: 20 }}>
              Create New Team
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label">Team Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Broad St Ballers"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Sport *</label>
                <select
                  className="form-input"
                  value={formSport}
                  onChange={(e) => setFormSport(e.target.value)}
                >
                  <option value="">Select a sport...</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">City *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Philadelphia"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Membership</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ label: "Open", value: true }, { label: "Invite Only", value: false }].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFormIsOpen(opt.value)}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                        background: formIsOpen === opt.value ? "#161616" : "transparent",
                        border: `1px solid ${formIsOpen === opt.value ? "#2e2e2e" : "#1e1e1e"}`,
                        color: formIsOpen === opt.value ? "#d4d4d8" : "#52525b",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {formMessage && (
                <p style={{ fontSize: 13, color: "#ef4444" }}>{formMessage}</p>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  className="primary-btn"
                  style={{ flex: 1 }}
                  disabled={formSubmitting}
                  onClick={handleCreateTeam}
                >
                  {formSubmitting ? "Creating..." : "Create Team"}
                </button>
                <button className="ghost-btn" onClick={closeCreateModal}>
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

