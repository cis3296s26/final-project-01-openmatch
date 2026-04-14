"use client";

import Link from "next/link";

const steps = [
  {
    num: "1",
    title: "Create an account",
    desc: "Sign up in seconds with your email. Verify your address and set up a profile with your preferred sports and skill level.",
  },
  {
    num: "2",
    title: "Join or create a team",
    desc: "Browse existing teams for your sport and city, or start your own. Each player belongs to one team per sport, keeping rosters clean.",
  },
  {
    num: "3",
    title: "Post a match",
    desc: "Head to your Dashboard and drop a match post. Pick your sport, set the format (e.g. 5v5), skill level, and location. Your post goes live instantly.",
  },
  {
    num: "4",
    title: "Opponents join",
    desc: "Other teams or individual players see your post on the Find a Match board and jump in. Slots fill in real time — first come, first served.",
  },
  {
    num: "5",
    title: "Ready up",
    desc: "Once both sides are full, a 5-minute ready window starts. Every selected player must hit Ready. If everyone confirms, the match is locked in.",
  },
  {
    num: "6",
    title: "Play",
    desc: "Show up and compete. Match results feed into team MMR and your personal sport rank, from Bronze III all the way up to Champion.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif" }}>

        <header style={{ borderBottom: "1px solid #141414", background: "rgba(8,8,8,0.93)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#080808" }}>OM</div>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.025em", color: "#fafafa" }}>OpenMatch</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/login" style={{ padding: "7px 16px", fontSize: 13, borderRadius: 10, textDecoration: "none", color: "#a1a1aa", border: "1px solid #222", background: "transparent" }}>Log in</Link>
              <Link href="/login/register" style={{ padding: "7px 16px", fontSize: 13, borderRadius: 10, textDecoration: "none", color: "#fff", background: "linear-gradient(135deg, #047857, #10b981 55%, #34d399)", fontWeight: 700 }}>Sign up</Link>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 28px 96px" }}>
          <Link href="/" style={{ fontSize: 13, color: "#52525b", textDecoration: "none", marginBottom: 32, display: "inline-block" }}>← Back to home</Link>

          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 16 }}>How it works</h1>
          <p style={{ fontSize: 15, color: "#8d8d8d", lineHeight: 1.7, marginBottom: 56 }}>
            OpenMatch is the fastest way to organize pickup games and team matches in your city. Here is the full flow from signup to game day.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((s, i) => (
              <div key={s.num} style={{ display: "flex", gap: 24, paddingBottom: 40, position: "relative" }}>
                {i < steps.length - 1 && (
                  <div style={{ position: "absolute", left: 17, top: 40, bottom: 0, width: 1, background: "#191919" }} />
                )}
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#34d399", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  {s.num}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: "#8d8d8d", lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: "32px 28px", background: "#0c0c0c", border: "1px solid #191919", borderRadius: 18, textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", marginBottom: 12 }}>Ready to get started?</p>
            <Link href="/login/register" style={{ display: "inline-block", padding: "12px 32px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #047857, #10b981 55%, #34d399)", borderRadius: 12, textDecoration: "none", boxShadow: "0 0 20px rgba(52,211,153,0.28)" }}>
              Create your account
            </Link>
          </div>
        </main>

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
