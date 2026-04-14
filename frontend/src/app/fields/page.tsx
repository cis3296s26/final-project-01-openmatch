"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAuth, getUser } from "@/lib/auth";
import AuthGate from "@/components/AuthGate";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Business = {
  id: string;
  name: string;
  url: string;
  image_url: string;
  rating: number;
  review_count: number;
  location: {
    display_address: string[];
  };
  distance?: number;
  categories: { title: string }[];
  phone: string;
};

const SORT_OPTIONS = [
  { label: "Best Match", value: "best_match" },
  { label: "Rating", value: "rating" },
  { label: "Distance", value: "distance" },
];

export default function FieldsPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  const [location, setLocation] = useState("");

  useEffect(() => {
    setUser(getUser());
  }, []);
  const [sortBy, setSortBy] = useState("best_match");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    
    if (!location.trim()) {
      setError("Please enter a location or zipcode");
      return;
    }

    setError("");
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(
        `${API}/fields/search?location=${encodeURIComponent(location)}&sort_by=${sortBy}`
      );

      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
      } else {
        const err = await res.json();
        setError(err.detail || "Failed to search for fields");
        setBusinesses([]);
      }
    } catch {
      setError("Error connecting to server. Is the backend running?");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDistance(meters?: number): string {
    if (!meters) return "";
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  }

  return (
    <AuthGate>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        .card { 
          background: #0c0c0c; 
          border: 1px solid #191919; 
          border-radius: 18px; 
          box-shadow: 0 8px 40px rgba(0,0,0,0.55);
          transition: border-color 0.2s, transform 0.2s;
        }
        .card:hover {
          border-color: #2a2a2a;
          transform: translateY(-2px);
        }
        
        .ghost-btn {
          background: transparent; border: 1px solid #1e1e1e; border-radius: 9px;
          padding: 6px 14px; font-size: 12px; color: #52525b; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, color 0.15s;
        }
        .ghost-btn:hover { border-color: #2e2e2e; color: #a1a1aa; }
        
        .nav-btn {
          background: transparent; border: none; border-radius: 10px; padding: 6px 14px;
          font-size: 13px; color: #52525b; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .nav-btn:hover { color: #a1a1aa; }
        .nav-btn.active { background: #161616; color: #fafafa; font-weight: 600; }
        
        .form-input {
          width: 100%; background: #111; border: 1px solid #1e1e1e; border-radius: 8px;
          padding: 12px 14px; color: #e4e4e7; font-size: 14px; font-family: inherit;
        }
        .form-input:focus { outline: none; border-color: #34d399; }
        .form-input::placeholder { color: #52525b; }
        
        .primary-btn {
          background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
          border: none; border-radius: 9px; padding: 12px 24px; font-size: 14px;
          font-weight: 600; color: #fff; cursor: pointer; font-family: inherit;
          transition: opacity 0.15s, transform 0.1s;
        }
        .primary-btn:hover { opacity: 0.9; }
        .primary-btn:active { transform: scale(0.98); }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .field-card-img {
          width: 100%;
          height: 160px;
          object-fit: cover;
          border-radius: 12px 12px 0 0;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080808", color: "#e4e4e7", fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Header */}
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
                    className={`nav-btn${item.label === "Fields" ? " active" : ""}`}
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
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#3f3f46", borderBottom: "1px solid #1a1a1a", marginBottom: 4 }}>
                      {user ? (user.display_name || `${user.first_name} ${user.last_name ?? ""}`.trim()) : "Account"}
                    </div>
                    <Link
                      href="/profile"
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

        {/* Main Content */}
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 28px" }}>
          
          {/* Page Title */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#fafafa", lineHeight: 1 }}>
              Find Sports Fields
            </h1>
            <p style={{ marginTop: 10, fontSize: 14, color: "#52525b" }}>
              Search for sports fields and facilities near you
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter location or zipcode..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div style={{ flex: "0 0 180px" }}>
                <select
                  className="form-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            {error && (
              <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>
            )}
          </form>

          {/* Results */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#52525b" }}>
              <div style={{ fontSize: 16 }}>Searching for fields...</div>
            </div>
          ) : searched && businesses.length === 0 ? (
            <div className="card" style={{ padding: 60, textAlign: "center" }}>
              <p style={{ fontSize: 16, color: "#52525b" }}>No fields found for this location</p>
              <p style={{ fontSize: 13, color: "#3f3f46", marginTop: 8 }}>Try a different location or zipcode</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {businesses.map((business) => (
                <div key={business.id} className="card" style={{ overflow: "hidden" }}>
                  {business.image_url ? (
                    <img
                      src={business.image_url}
                      alt={business.name}
                      className="field-card-img"
                    />
                  ) : (
                    <div style={{ width: "100%", height: 160, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#3f3f46", fontSize: 12, borderRadius: "12px 12px 0 0" }}>
                      No Image Available
                    </div>
                  )}
                  
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", lineHeight: 1.3 }}>
                        {business.name}
                      </h3>
                      {business.distance && (
                        <span style={{ fontSize: 11, color: "#52525b", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {formatDistance(business.distance)}
                        </span>
                      )}
                    </div>
                    
                    <p style={{ fontSize: 13, color: "#71717a", marginBottom: 10, lineHeight: 1.4 }}>
                      {business.location.display_address.join(", ")}
                    </p>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#facc15", fontSize: 13 }}>★</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{business.rating}</span>
                        <span style={{ fontSize: 12, color: "#52525b" }}>({business.review_count})</span>
                      </div>
                      {business.categories && business.categories.length > 0 && (
                        <span style={{ fontSize: 11, color: "#52525b" }}>
                          {business.categories.map(c => c.title).join(", ")}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href={business.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ghost-btn"
                        style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
                      >
                        View on Yelp
                      </a>
                      {business.phone && (
                        <a
                          href={`tel:${business.phone}`}
                          className="ghost-btn"
                          style={{ textDecoration: "none" }}
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Attribution */}
          {businesses.length > 0 && (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#3f3f46" }}>
                Powered by Yelp
              </p>
            </div>
          )}
        </main>
      </div>
    </AuthGate>
  );
}
