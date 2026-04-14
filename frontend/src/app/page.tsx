"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { setLoggedIn(!!getToken()); }, []);

  const stats = [
    { value: "4,200+", label: "Active players" },
    { value: "180+", label: "Games this week" },
    { value: "12", label: "Sports supported" },
    { value: "Philly", label: "& growing" },
  ];

  const features = [
    {
      num: "1",
      title: "Post a match",
      desc: "Drop a match request in seconds. Set your sport, skill level, and location — nearby teams see it instantly.",
    },
    {
      num: "2",
      title: "Ready up",
      desc: "Toggle ready per team. When you're on, nearby players know you're down to play right now.",
    },
    {
      num: "3",
      title: "Accept & go",
      desc: "Browse nearby requests, accept a game, and get on the field. No back-and-forth, no scheduling hell.",
    },
  ];

  const sports = ["Soccer", "Basketball", "Tennis", "Pickleball", "Volleyball", "Flag Football", "Badminton", "Softball", "Ultimate Frisbee", "Hockey", "Rugby", "Lacrosse"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes scroll-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes ready-pulse {

        }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes orb-drift {
          0%,100% { transform: translateX(-50%) translateY(0px); }
          50%     { transform: translateX(-50%) translateY(-30px); }
        }

        .a1 { animation: fade-up 0.65s 0.0s ease both; }
        .a2 { animation: fade-up 0.65s 0.1s ease both; }
        .a3 { animation: fade-up 0.65s 0.2s ease both; }
        .a4 { animation: fade-up 0.65s 0.32s ease both; }

        .feature-card {
          background: #0c0c0c; border: 1px solid #191919; border-radius: 18px;
          padding: 28px 24px; transition: border-color 0.25s, box-shadow 0.25s;
        }
        .feature-card:hover { border-color: #252525; box-shadow: 0 0 40px rgba(52,211,153,0.04); }

        .cta-primary {
          display: inline-flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #047857, #10b981 55%, #34d399);
          color: #fff; border: none; border-radius: 12px;
          padding: 13px 28px; font-size: 14px; font-weight: 700;
          letter-spacing: 0.01em; cursor: pointer; font-family: 'DM Sans', sans-serif;
          animation: ready-pulse 2.4s ease-in-out infinite;
          transition: transform 0.1s;
        }
        .cta-primary:active { transform: scale(0.97); }

        .cta-ghost {
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border: 1px solid #222; border-radius: 12px;
          padding: 13px 28px; font-size: 14px; font-weight: 600; color: #acacac;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.15s, color 0.15s;
        }
        .cta-ghost:hover { border-color: #333; color: #d4d4d8; }

        .sport-pill {
          display: inline-block; padding: 6px 16px; border-radius: 999px;
          border: 1px solid #1e1e1e; background: #0f0f0f;
          font-size: 12px; font-weight: 500; color: #52525b; white-space: nowrap;
        }
        .sports-track {
          display: flex; gap: 10px;
          animation: scroll-left 30s linear infinite;
          width: max-content;
        }
        .sports-track:hover { animation-play-state: paused; }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.78); backdrop-filter: blur(7px);
          display: flex; align-items: center; justify-content: center;
          animation: fade-in 0.18s ease both;
        }
        .modal-box {
          background: #0c0c0c; border: 1px solid #222; border-radius: 22px;
          padding: 32px; width: 100%; max-width: 390px;
          box-shadow: 0 40px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(52,211,153,0.06);
          animation: modal-in 0.2s ease both;
        }
        .modal-input {
          width: 100%; background: #111; border: 1px solid #222; border-radius: 10px;
          padding: 11px 14px; font-size: 13px; color: #e4e4e7;
          font-family: 'DM Sans', sans-serif; outline: none;
          transition: border-color 0.15s;
        }
        .modal-input::placeholder { color: #3f3f46; }
        .modal-input:focus { border-color: rgba(52,211,153,0.35); }
        .modal-submit {
          width: 100%; background: linear-gradient(135deg, #047857, #10b981 55%, #34d399);
          border: none; border-radius: 11px; padding: 12px;
          font-size: 13px; font-weight: 700; color: #fff;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          box-shadow: 0 0 20px rgba(52,211,153,0.28);
          transition: box-shadow 0.2s, transform 0.1s;
        }
        .modal-submit:hover { box-shadow: 0 0 32px rgba(52,211,153,0.5); }
        .modal-submit:active { transform: scale(0.97); }

        .nav-link {
          background: transparent; border: none; border-radius: 10px;
          padding: 6px 14px; font-size: 13px; color: #d1d1d1;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: color 0.15s;
        }
        .nav-link:hover { color: #ffffff; }

        .match-row { transition: background 0.12s; }
        .match-row:hover { background: rgba(255,255,255,0.015); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif", position: "relative" }}>

        {/* Glow orb */}
        <div style={{ position: "absolute", top: -200, left: "50%", width: 700, height: 700, background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", animation: "orb-drift 8s ease-in-out infinite", zIndex: 0 }} />

        {/* ── Header ── */}
        <header style={{ borderBottom: "1px solid #141414", background: "rgba(8,8,8,0.93)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#080808"}}>
                  OM
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.025em", color: "#fafafa" }}>OpenMatch</span>
              </div>
                <nav style={{ display: "flex", gap: 2 }}>
                    {[
                        { label: "How it works", href: "/how-it-works" },
                        { label: "Sports", href: "/sports" },
                        { label: "Cities", href: "/cities" },
                    ].map((item) => (
                        <Link key={item.label} href={item.href} className="nav-link" style={{ textDecoration: "none" }}>
                        {item.label}
                        </Link>
                    ))}
                    </nav>
                </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {loggedIn ? (
                <Link href="/dashboard" className="cta-primary" style={{ padding: "7px 16px", fontSize: 13, borderRadius: 10, animation: "none", boxShadow: "0 0 14px rgba(52,211,153,0.28)", textDecoration: "none" }}>
                    Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="cta-ghost" style={{ padding: "7px 16px", fontSize: 13, borderRadius: 10, textDecoration: "none" }}>
                      Log in
                  </Link>
                  <Link href="/login/register" className="cta-primary" style={{ padding: "7px 16px", fontSize: 13, borderRadius: 10, animation: "none", boxShadow: "0 0 14px rgba(52,211,153,0.28)", textDecoration: "none" }}>
                      Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "104px 28px 88px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="a1" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 999, padding: "5px 14px", fontSize: 12, color: "#34d399", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
            Now live in Philadelphia
          </div>

          <h1 className="a2" style={{ fontSize: "clamp(50px, 7vw, 86px)", fontWeight: 800, letterSpacing: "-0.05em", color: "#fafafa", lineHeight: 1.0, marginBottom: 28 }}>
            Find your next<br />
            <span style={{ color: "#34d399" }}>game.</span> Right now.
          </h1>

          <p className="a3" style={{ fontSize: 17, color: "#8d8d8d", maxWidth: 460, margin: "0 auto 44px", lineHeight: 1.7 }}>
            OpenMatch connects pickup players and teams across Philly in real time. Post a game, ready up, and play.
          </p>

          <div className="a3" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href={loggedIn ? "/dashboard" : "/login"} className="cta-primary" style={{ textDecoration: "none" }}>
                {loggedIn ? "Go to Dashboard" : "Get on the field"}
            </Link>
            <Link href="/how-it-works" className="cta-ghost">
                See how it works
            </Link>
          </div>

          {/* Stats */}
          <div className="a4" style={{ display: "inline-flex", alignItems: "center", gap: 0, marginTop: 72, border: "1px solid #191919", borderRadius: 16, background: "#0c0c0c", overflow: "hidden" }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{ padding: "18px 32px", textAlign: "center", borderRight: i < stats.length - 1 ? "1px solid #191919" : "none" }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#8d8d8d", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sports ticker ── */}
        <div style={{ borderTop: "1px solid #141414", borderBottom: "1px solid #141414", padding: "14px 0", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to right, #080808, transparent)", zIndex: 2, pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to left, #080808, transparent)", zIndex: 2, pointerEvents: "none" }} />
          <div className="sports-track">
            {[...sports, ...sports].map((s, i) => <span key={i} className="sport-pill">{s}</span>)}
          </div>
        </div>

        {/* ── Features ── */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "96px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 14 }}>No apps. No group chats.</h2>
            <p style={{ fontSize: 14, color: "#8d8d8d" }}>Three steps from couch to field.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#34d399", marginBottom: 20 }}>
                  {f.num}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "#fafafa", marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#8d8d8d", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Dashboard preview ── */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px 96px" }}>
          <div style={{ background: "#0c0c0c", border: "1px solid #191919", borderRadius: 24, padding: 24, boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
            {/* Browser chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20 }}>
              {["#2a2a2a", "#2a2a2a", "#2a2a2a"].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, height: 24, background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 12 }}>
                <span style={{ fontSize: 11, color: "#6d6d6d" }}>openmatch.gg/dashboard</span>
              </div>
            </div>

            {/* Mini dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa", marginBottom: 4 }}>Hey, Jordan</div>
                <div style={{ fontSize: 11, color: "#8d8d8d", marginBottom: 16 }}>Ready up per team to let nearby players find you</div>
                {[
                  { sport: "SOCCER", color: "#4ade80", title: "Intermediate 5v5 · FDR Park", time: "18 min ago" },
                  { sport: "BASKETBALL", color: "#fb923c", title: "Competitive 3v3 · Palumbo Rec", time: "2 hrs ago" },
                ].map((p) => (
                  <div key={p.title} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: p.color, marginBottom: 5 }}>{p.sport}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{p.title}</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#3f3f46", background: "#0c0c0c", border: "1px solid #1e1e1e", borderRadius: 6, padding: "3px 8px", alignSelf: "flex-start" }}>{p.time}</div>
                    </div>
                  </div>
                ))}

                {/* Mini matches */}
                <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
                  {[{ team: "Eastside FC", score: "3 – 1", win: true }, { team: "North Philly Rovers", score: "0 – 2", win: false }, { team: "The Rim Breakers", score: "21 – 17", win: true }].map((m, i) => (
                    <div key={m.team} className="match-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < 2 ? "1px solid #161616" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: m.win ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${m.win ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: m.win ? "#4ade80" : "#f87171" }}>{m.win ? "W" : "L"}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e4e4e7" }}>{m.team}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#52525b" }}>{m.score}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 5, background: m.win ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)", border: `1px solid ${m.win ? "rgba(74,222,128,0.16)" : "rgba(248,113,113,0.16)"}`, color: m.win ? "#86efac" : "#fca5a5" }}>{m.win ? "WIN" : "LOSS"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right sidebar preview */}
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", color: "#fafafa", marginBottom: 3 }}>3W – 2L</div>
                <div style={{ fontSize: 10, color: "#3f3f46", marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" }}>recent record</div>

                <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#d4d4d8", marginBottom: 10 }}>Nearby requests</div>
                  {[{ init: "MR", name: "Marco R.", desc: "Casual 7v7 — Clark Park" }, { init: "SP", name: "Sunrise Picklers", desc: "Pickleball doubles" }].map((r) => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1a1a1a", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#52525b", flexShrink: 0 }}>{r.init}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7" }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: "#3f3f46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</div>
                      </div>
                      <div style={{ fontSize: 9, background: "#0c0c0c", border: "1px solid #1e1e1e", borderRadius: 5, padding: "3px 7px", color: "#52525b", flexShrink: 0 }}>Ready up</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#111", border: "1px solid rgba(52,211,153,0.14)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 0 30px rgba(52,211,153,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7" }}>Broad St Ballers</div>
                    <div style={{ fontSize: 9, color: "#93c5fd", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.16)", borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>Gold II</div>
                  </div>
                  <div style={{ background: "linear-gradient(135deg, #047857, #10b981 55%, #34d399)", borderRadius: 8, padding: "8px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.08em", boxShadow: "0 0 18px rgba(52,211,153,0.45)" }}>
                    READY
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ borderTop: "1px solid #141414", padding: "96px 28px", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 300, background: "radial-gradient(circle, rgba(16,185,129,0.07), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 16, position: "relative" }}>Ready to play?</h2>
          <p style={{ fontSize: 14, color: "#8d8d8d", marginBottom: 40, position: "relative" }}>
            {loggedIn ? "Your dashboard is waiting." : "Join thousands of players already on OpenMatch."}
          </p>
            <Link href={loggedIn ? "/dashboard" : "/login/register"} className="cta-primary" style={{ fontSize: 15, padding: "15px 40px", textDecoration: "none" }}>
                {loggedIn ? "Go to Dashboard" : "Create your account"}
            </Link>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid #141414", padding: "24px 28px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 8, color: "#080808" }}>OM</div>
              <span style={{ fontSize: 13, color: "#8d8d8d" }}>OpenMatch</span>
            </div>
            <div style={{ fontSize: 12, color: "#8d8d8d" }}>© 2026 OpenMatch. Philadelphia, PA.</div>
          </div>
        </footer>
      </div>
    </>
  );
}