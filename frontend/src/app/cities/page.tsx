"use client";

import Link from "next/link";

const NEIGHBORHOODS = [
  "Center City", "University City", "South Philly", "Northern Liberties",
  "Fishtown", "Manayunk", "Fairmount", "Kensington",
  "West Philly", "Roxborough", "Germantown", "Chestnut Hill",
];

const VENUES = [
  { name: "FDR Park", area: "South Philly", sports: "Soccer, Softball, Tennis" },
  { name: "Clark Park", area: "West Philly", sports: "Ultimate Frisbee, Soccer" },
  { name: "Palumbo Recreation Center", area: "South Philly", sports: "Basketball, Volleyball" },
  { name: "Penn Park", area: "University City", sports: "Soccer, Lacrosse, Tennis" },
  { name: "Marian Anderson Recreation Center", area: "South Philly", sports: "Basketball" },
  { name: "Columbus Square Park", area: "South Philly", sports: "Basketball, Soccer" },
];

export default function CitiesPage() {
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

          <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", marginBottom: 16 }}>Cities</h1>
          <p style={{ fontSize: 15, color: "#8d8d8d", lineHeight: 1.7, marginBottom: 56 }}>
            OpenMatch launched in Philadelphia and is growing across the city. Here is where we are active today.
          </p>

          <div style={{ background: "#0c0c0c", border: "1px solid #191919", borderRadius: 18, padding: "28px 24px", marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🏙️</span>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.03em" }}>Philadelphia, PA</h2>
                <p style={{ fontSize: 13, color: "#52525b", marginTop: 2 }}>Our home city and first market</p>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#8d8d8d", lineHeight: 1.7, marginBottom: 24 }}>
              Philadelphia has one of the most active pickup sports scenes on the East Coast.
              From FDR Park soccer fields to the basketball courts at Palumbo, there is always a game happening.
              OpenMatch makes it easy to find and organize matches across every neighborhood.
            </p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Active neighborhoods</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {NEIGHBORHOODS.map((n) => (
                <span key={n} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #1e1e1e", background: "#0f0f0f", fontSize: 12, color: "#71717a" }}>
                  {n}
                </span>
              ))}
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#d4d4d8", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Popular venues</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {VENUES.map((v, i) => (
                <div key={v.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < VENUES.length - 1 ? "1px solid #141414" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>{v.area}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#3f3f46", textAlign: "right" }}>{v.sports}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "32px 28px", background: "#0c0c0c", border: "1px solid #191919", borderRadius: 18, textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fafafa", marginBottom: 6 }}>More cities coming soon</p>
            <p style={{ fontSize: 13, color: "#52525b", marginBottom: 16 }}>We are expanding to new markets in 2026. Stay tuned.</p>
            <Link href="/login/register" style={{ display: "inline-block", padding: "12px 32px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #047857, #10b981 55%, #34d399)", borderRadius: 12, textDecoration: "none", boxShadow: "0 0 20px rgba(52,211,153,0.28)" }}>
              Join the waitlist
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
