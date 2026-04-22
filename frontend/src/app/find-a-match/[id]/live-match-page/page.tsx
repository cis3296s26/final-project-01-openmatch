"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { authHeaders, getUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http/, "ws");

type Participant = {
  id: number;
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
  title: string;
  sport_name: string;
  players_per_side: number;
  status: string;
  team_name: string | null;
  location: string | null;
  participants: Participant[];
  ready_deadline_at: string | null;
  expires_at: string;
};

type LiveMatch = {
  id: number;
  match_post_id: number;
  sport_id: number;
  queue_type: "solo" | "team";
  side_a_team_id: number | null;
  side_b_team_id: number | null;
  status:
    | "awaiting_start"
    | "in_progress"
    | "awaiting_result"
    | "completed"
    | "disputed"
    | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  winner_side: "A" | "B" | null;
  winner_team_id: number | null;
  result_method: string | null;
  rating_processed: boolean;
  score_side_a: number;
  score_side_b: number;
  created_at: string;
  updated_at: string;
  players: { id: number; user_id: number; side: "A" | "B"; team_id: number | null }[];
  start_confirmations: { id: number; side: "A" | "B"; user_id: number; confirmed_at: string }[];
  result_reports: {
    id: number;
    reporting_side: "A" | "B";
    winner_side: "A" | "B";
    score_side_a: number | null;
    score_side_b: number | null;
    note: string | null;
    created_at: string;
  }[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function useElapsed(startedAt: string | null, endedAt: string | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const compute = () => {
      const endTime = endedAt ? new Date(endedAt).getTime() : Date.now();
      const startTime = new Date(startedAt).getTime();
      setElapsed(Math.max(0, Math.floor((endTime - startTime) / 1000)));
    };

    compute();
    if (endedAt) return;

    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [startedAt, endedAt]);

  return elapsed;
}

function MatchTimer({ startedAt, endedAt }: { startedAt: string | null; endedAt: string | null }) {
  const elapsed = useElapsed(startedAt, endedAt);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <div
      style={{
        width: 104,
        height: 104,
        borderRadius: "50%",
        border: "3px solid #202020",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0c0c",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, color: "#f4f4f5", lineHeight: 1 }}>
        {pad(m)}:{pad(s)}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        {endedAt ? "ended" : "elapsed"}
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string;
  score: number;
  onMinus: () => void;
  onPlus: () => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 92,
          minHeight: 120,
          borderRadius: 14,
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 800, color: "#34d399", lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>{label}</div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onMinus}
          disabled={disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid #262626",
            background: "#111111",
            color: "#a1a1aa",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          −
        </button>
        <button
          onClick={onPlus}
          disabled={disabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid rgba(16,185,129,0.22)",
            background: "rgba(16,185,129,0.12)",
            color: "#34d399",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function LiveMatchPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params?.id ?? 0);
  const user = getUser();
  const userId = user ? Number((user as any).id ?? (user as any).sub ?? 0) : 0;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchPost = useCallback(async () => {
    const res = await fetch(`${API}/posts/${postId}`);
    if (res.ok) setPost(await res.json());
  }, [postId]);

  const fetchLiveMatch = useCallback(async () => {
    const res = await fetch(`${API}/posts/${postId}/live-match`, {
      headers: authHeaders(),
    });

    if (res.ok) {
      setLiveMatch(await res.json());
    } else if (res.status === 404) {
      setLiveMatch(null);
    } else if (res.status === 403) {
      setMsg({ text: "You are not allowed to access this live match.", ok: false });
      setLiveMatch(null);
    }
  }, [postId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchPost(), fetchLiveMatch()]);
      setLoading(false);
    })();
  }, [fetchPost, fetchLiveMatch]);

  useEffect(() => {
    if (!WS_BASE || !postId) return;

    const ws = new WebSocket(`${WS_BASE}/ws`);
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    ws.onopen = () => {
      console.log("WebSocket connected");

      // needed because backend waits on ws.receive_text()
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 20000);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.postId !== postId) return;

        if (
          msg.type === "live_match_updated" ||
          msg.type === "post_updated" ||
          msg.type === "match_score_updated" ||
          msg.type === "match_started" ||
          msg.type === "match_ended"
        ) {
          await Promise.all([fetchPost(), fetchLiveMatch()]);
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
  }, [postId, fetchPost, fetchLiveMatch]);

  const sideAPlayers = post?.participants.filter((p) => p.side === "A" && p.selected_for_match) ?? [];
  const sideBPlayers = post?.participants.filter((p) => p.side === "B" && p.selected_for_match) ?? [];
  const myLiveSide = liveMatch?.players.find((p) => p.user_id === userId)?.side;
  const myStartConfirmed = liveMatch?.start_confirmations.some((c) => c.user_id === userId) ?? false;

  const canEditScore = !!liveMatch && liveMatch.status === "in_progress";
  const canStart = !!liveMatch && liveMatch.status === "awaiting_start" && !!myLiveSide && !myStartConfirmed;
  const canEnd = !!liveMatch && liveMatch.status === "in_progress";

  async function changeScore(side: "A" | "B", delta: 1 | -1) {
    if (!liveMatch || busy) return;
    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/matches/${liveMatch.id}/score`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ side, delta }),
      });

      if (res.ok) {
        await fetchLiveMatch();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: err.detail || "Failed to update score.", ok: false });
      }
    } finally {
      setBusy(false);
    }
  }

  async function doStart() {
    if (!liveMatch || busy) return;
    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/matches/${liveMatch.id}/start`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.ok) {
        setMsg({ text: "Start confirmed.", ok: true });
        await fetchLiveMatch();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: err.detail || "Failed to start match.", ok: false });
      }
    } finally {
      setBusy(false);
    }
  }

  async function doEndMatch() {
    if (!liveMatch || busy) return;

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/matches/${liveMatch.id}/end`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.ok) {
        setMsg({ text: "Match ended and stats updated.", ok: true });

        setTimeout(() => {
          router.push("/dashboard");
        }, 800);

        return;
      } 
      else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: err.detail || "Failed to end match.", ok: false });
      }
    } 
    finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#6b7280",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Loading live match...
      </div>
    );
  }

  if (!post) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#6b7280",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Post not found.
      </div>
    );
  }

  if (!liveMatch) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#0b0b0b",
            border: "1px solid #171717",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Live Match <span style={{ color: "#52525b" }}>#—</span>
          </div>
          <div
            style={{
              borderRadius: 10,
              background: "rgba(127,29,29,.25)",
              border: "1px solid rgba(239,68,68,.22)",
              color: "#f87171",
              padding: "12px 14px",
              fontSize: 14,
            }}
          >
            Match ID not loaded yet
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080808",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0b0b0b",
          border: "1px solid #171717",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #151515",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#34d399", display: "inline-block" }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: "#f4f4f5", lineHeight: 1 }}>
              Live Match <span style={{ color: "#52525b", fontWeight: 700 }}>#{liveMatch.id}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setCollapsed((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              {collapsed ? "▾" : "▴"}
            </button>

            <button
              onClick={doEndMatch}
              disabled={!canEnd || busy}
              style={{
                borderRadius: 10,
                padding: "8px 14px",
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(127,29,29,.35)",
                color: "#f87171",
                cursor: !canEnd || busy ? "not-allowed" : "pointer",
                opacity: !canEnd || busy ? 0.45 : 1,
                fontWeight: 700,
              }}
            >
              End
            </button>
          </div>
        </div>

        {!collapsed && (
          <div style={{ padding: 16 }}>
            {msg && (
              <div
                style={{
                  marginBottom: 14,
                  borderRadius: 10,
                  background: msg.ok ? "rgba(16,185,129,0.12)" : "rgba(127,29,29,.25)",
                  border: `1px solid ${msg.ok ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,.22)"}`,
                  color: msg.ok ? "#34d399" : "#f87171",
                  padding: "12px 14px",
                  fontSize: 14,
                }}
              >
                {msg.text}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>SIDE A</div>
                <div
                  style={{
                    borderRadius: 10,
                    background: "#090909",
                    border: "1px solid #1b1b1b",
                    padding: "10px 12px",
                    color: "#f4f4f5",
                    minHeight: 42,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {sideAPlayers.map((p) => p.username).filter(Boolean).join(", ") || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>SIDE B</div>
                <div
                  style={{
                    borderRadius: 10,
                    background: "#090909",
                    border: "1px solid #1b1b1b",
                    padding: "10px 12px",
                    color: "#f4f4f5",
                    minHeight: 42,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {sideBPlayers.map((p) => p.username).filter(Boolean).join(", ") || "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr auto",
                alignItems: "center",
                gap: 14,
              }}
            >
              <ScoreCard
                label="Side A"
                score={liveMatch.score_side_a}
                onMinus={() => changeScore("A", -1)}
                onPlus={() => changeScore("A", 1)}
                disabled={!canEditScore || busy}
              />

              <div style={{ color: "#6b7280", fontWeight: 800, fontSize: 22 }}>VS</div>

              <ScoreCard
                label="Side B"
                score={liveMatch.score_side_b}
                onMinus={() => changeScore("B", -1)}
                onPlus={() => changeScore("B", 1)}
                disabled={!canEditScore || busy}
              />

              <MatchTimer startedAt={liveMatch.started_at} endedAt={liveMatch.ended_at} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {canStart && (
                <button
                  onClick={doStart}
                  disabled={busy}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "10px 14px",
                    border: "1px solid rgba(16,185,129,0.22)",
                    background: "rgba(16,185,129,0.12)",
                    color: "#34d399",
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.45 : 1,
                    fontWeight: 700,
                  }}
                >
                  Confirm Start
                </button>
              )}

              <button
                onClick={() => router.push(`/find-a-match/${postId}`)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: "10px 14px",
                  border: "1px solid #262626",
                  background: "#111111",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Back to Lobby
              </button>
            </div>

            {liveMatch.status === "completed" && liveMatch.winner_side && (
              <div
                style={{
                  marginTop: 16,
                  borderRadius: 10,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#34d399",
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Side {liveMatch.winner_side} won. Stats have been updated.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}