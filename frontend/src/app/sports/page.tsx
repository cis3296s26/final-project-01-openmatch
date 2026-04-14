"use client";

import Link from "next/link";

const SPORTS = [
  { name: "Soccer", emoji: "\u26BD", desc: "The world's game. From casual 5v5 to full 11v11, find teams at every level across the city." },
  { name: "Basketball", emoji: "\uD83C\uDFC0", desc: "Pick up a 3v3 half-court run or organize a full 5v5. Courts are everywhere — just need players." },
  { name: "Tennis", emoji: "\uD83C\uDFBE", desc: "Singles and doubles matchmaking. Post your skill level and find an opponent at a nearby court." },
  { name: "Pickleball", emoji: "\uD83C\uDFD3", desc: "The fastest-growing sport in the country. Doubles and singles across Philadelphia's growing court network." },
  { name: "Volleyball", emoji: "\uD83C\uDFD0", desc: "Indoor and outdoor 6v6. Great for recreation leagues and competitive pickup alike." },
  { name: "Flag Football", emoji: "\uD83C\uDFC8", desc: "All the strategy, none of the tackles. Organize 5v5 or 7v7 flag games at local fields." },
  { name: "Badminton", emoji: "\uD83C\uDFF8", desc: "Fast-paced singles and doubles. Find partners at gyms and rec centers around the city." },
  { name: "Softball", emoji: "\u26BE", desc: "Slow pitch, fast fun. Round up a full roster or fill open spots on existing teams." },
  { name: "Ultimate Frisbee", emoji: "\uD83E\uDD4F", desc: "Spirit of the game. Pickup and organized 7v7 ultimate on fields across Philly." },
  { name: "Hockey", emoji: "\uD83C\uDFD2", desc: "Roller and ice. Find skaters for pickup or league-style games year round." },
  { name: "Rugby", emoji: "\uD83C\uDFC9", desc: "Sevens and fifteens. Growing fast in Philadelphia — find your pack." },
  { name: "Lacrosse", emoji: "\uD83E\uDD4D", desc: "Box and field. Connect with players across all skill levels in the Philly metro." },
];

export default function SportsPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sport-card {
          background: #0c0c0c; border: 1px solid #191919; border-radius: 18px;
          padding: 24px; transition: border-color 0.25s, box-shadow 0.25s;
        }
        .sport-card:hover { border-color: #252525; box-shadow: 0 0 40px rgba(52,211,153,0.04); }
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

        <main style={{ maxWidth: 960, margin: "0 auto", padding: "80px 28px 96px" }}>
          <Link href="/" style={{ fontSize: 13, color: "#52525b", textDecoration: "none", marginBottom: 32, display: "inline-block" }}>← Back to home</Link>

          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 16 }}>Sports</h1>
          <p style={{ fontSize: 15, color: "#8d8d8d", lineHeight: 1.7, marginBottom: 56 }}>
            OpenMatch supports 12 sports and counting. Every sport has its own team rosters, MMR rankings, and matchmaking board.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {SPORTS.map((s) => (
              <div key={s.name} className="sport-card">
                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.emoji}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>{s.name}</h3>
                <p style={{ fontSize: 13, color: "#8d8d8d", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
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
