"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Team = {
  id: number;
  name: string;
  sport: string;
  city: string;
  presence: { status: string; updated_at?: string | null };
};

type Post = {
  id: number;
  team_id: number;
  team_name: string;
  sport: string;
  city: string;
  skill: string;
  note?: string | null;
  created_at: string;
};

const API = "http://localhost:8000";

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [teamName, setTeamName] = useState("");
  const [sport, setSport] = useState("Soccer");
  const [city, setCity] = useState("Philadelphia, PA");
  const [postTeamId, setPostTeamId] = useState<number | null>(null);
  const [skill, setSkill] = useState("Casual");
  const [note, setNote] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  async function refresh() {
    const [t, p] = await Promise.all([
      fetch(`${API}/teams`).then((r) => r.json()),
      fetch(`${API}/posts`).then((r) => r.json()),
    ]);
    setTeams(t);
    setPosts(p);
  }

  useEffect(() => {
    refresh();

    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      const id = setInterval(() => ws.send("ping"), 20000);
      (ws as any)._keepalive = id;
    };

    ws.onmessage = () => {
      refresh();
    };

    ws.onclose = () => {
      const id = (ws as any)._keepalive;
      if (id) clearInterval(id);
    };

    return () => {
      ws.close();
    };
  }, []);

  const readyTeams = useMemo(
    () => teams.filter((t) => t.presence?.status === "Ready"),
    [teams]
  );

  async function createTeam() {
    const res = await fetch(`${API}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName, sport, city }),
    });
    const data = await res.json();
    setTeamName("");
    setPostTeamId(data.id);
    await refresh();
  }

  async function setPresence(teamId: number, status: "Ready" | "Away" | "Offline") {
    await fetch(`${API}/teams/${teamId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function createPost() {
    if (!postTeamId) return;
    await fetch(`${API}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: postTeamId, skill, note }),
    });
    setNote("");
  }

  function mapsLink(c: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c + " sports field")}`;
  }

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Open Match</h1>
        <p className="text-gray-600">
          Real-time availability board + match posts + map links.
        </p>
      </header>

      <section className="p-4 rounded-lg border space-y-3">
        <h2 className="text-xl font-semibold">Create Group / Team</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded p-2" placeholder="Group name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <input className="border rounded p-2" placeholder="Sport" value={sport} onChange={(e) => setSport(e.target.value)} />
          <input className="border rounded p-2" placeholder="City, State" value={city} onChange={(e) => setCity(e.target.value)} />
          <button className="border rounded p-2" onClick={createTeam} disabled={!teamName.trim()}>
            Create
          </button>
        </div>
      </section>

      <section className="p-4 rounded-lg border space-y-3">
        <h2 className="text-xl font-semibold">Teams</h2>
        <div className="space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border rounded p-3">
              <div>
                <div className="font-semibold">{t.name} • {t.sport} • {t.city}</div>
                <div className="text-sm text-gray-600">Status: {t.presence?.status ?? "Offline"}</div>
              </div>
              <div className="flex gap-2">
                <button className="border rounded px-3 py-1" onClick={() => setPresence(t.id, "Ready")}>Ready</button>
                <button className="border rounded px-3 py-1" onClick={() => setPresence(t.id, "Away")}>Away</button>
                <button className="border rounded px-3 py-1" onClick={() => setPresence(t.id, "Offline")}>Offline</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="p-4 rounded-lg border space-y-3">
        <h2 className="text-xl font-semibold">Post a Match Request</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="border rounded p-2" value={postTeamId ?? ""} onChange={(e) => setPostTeamId(Number(e.target.value))}>
            <option value="" disabled>Select team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded p-2" value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option>Casual</option>
            <option>Competitive</option>
          </select>
          <input className="border rounded p-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="border rounded p-2" onClick={createPost} disabled={!postTeamId}>
            Create post
          </button>
        </div>
        <p className="text-sm text-gray-600">Posts auto-expire after ~30 minutes (Redis TTL).</p>
      </section>

      <section className="p-4 rounded-lg border space-y-3">
        <h2 className="text-xl font-semibold">Live Match Board</h2>
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold">{p.team_name} ({p.skill}) • {p.sport} • {p.city}</div>
                <div className="text-sm text-gray-600">{p.note ?? ""}</div>
              </div>
              <a className="underline text-sm" href={mapsLink(p.city)} target="_blank">
                Find fields near {p.city}
              </a>
            </div>
          ))}
          {posts.length === 0 && <div className="text-gray-600 text-sm">No active posts.</div>}
        </div>
      </section>

      <section className="p-4 rounded-lg border space-y-2">
        <h2 className="text-xl font-semibold">Ready Now</h2>
        <div className="text-sm text-gray-700">
          {readyTeams.length ? readyTeams.map((t) => t.name).join(", ") : "No teams marked Ready."}
        </div>
      </section>
    </main>
  );
}
