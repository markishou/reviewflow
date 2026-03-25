import React, { useState, useEffect, useCallback } from "react";
import { getHealth, getPrs } from "../api";
import StatCard from "./StatCard";
import PrCard from "./PrCard";
import TeamPanel from "./TeamPanel";

// Mock team data for now — the /api/users/me endpoint returns individual user data,
// not team data. We'll use mock data for the team panel in the demo.
const MOCK_TEAM = [
  {
    github_username: "markhou",
    display_name: "Mark Hou",
    pending_reviews: 1,
    active_reviews: 1,
    completed_today: 2,
    expertise: ["backend", "database", "auth"],
  },
  {
    github_username: "testreviewer",
    display_name: "Test Reviewer",
    pending_reviews: 1,
    active_reviews: 0,
    completed_today: 0,
    expertise: ["backend", "auth", "database"],
  },
];

function Dashboard({ user, onLogout }) {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [healthStatus, setHealthStatus] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch health status
      const healthRes = await getHealth();
      setHealthStatus(healthRes.data?.data || healthRes.data);

      // Try to fetch real PRs from API
      try {
        const prsRes = await getPrs();
        const prData = prsRes.data?.data?.prs || prsRes.data?.prs || [];
        setPrs(prData);
      } catch (prErr) {
        // If 401 (no auth) or no data, use empty array
        console.log(
          "Could not fetch PRs from API, showing empty state:",
          prErr.message,
        );
        setPrs([]);
      }
    } catch (err) {
      setError("Failed to connect to API: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // TODO: find better interval for refresh or another option (refresh on github webhook)
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredPrs = prs.filter((pr) => {
    if (filter !== "all" && pr.priority !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (pr.title || "").toLowerCase().includes(term) ||
        (pr.author_github_username || "").toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = {
    pending: prs.filter((p) => p.state === "open").length,
    inReview: prs.filter((p) => p.state === "in_review").length,
    avgTime:
      prs.length > 0
        ? Math.round(
            prs.reduce((a, p) => a + (p.estimated_review_time || 0), 0) /
              prs.length,
          )
        : 0,
    avgComplexity:
      prs.length > 0
        ? (
            prs.reduce((a, p) => a + (p.complexity_score || 0), 0) / prs.length
          ).toFixed(1)
        : "0.0",
  };

  const priorityFilters = [
    { key: "all", label: "All", color: "#0099ff" },
    { key: "critical", label: "Critical", color: "#ff4757" },
    { key: "high", label: "High", color: "#ffa502" },
    { key: "medium", label: "Medium", color: "#0099ff" },
    { key: "low", label: "Low", color: "#00d4aa" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-rf-bg-primary flex items-center justify-center">
        <div className="text-rf-text-secondary text-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rf-bg-primary">
      {/* Header */}
      <header className="border-b border-rf-border px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-accent to-rf-accent-blue flex items-center justify-center text-white font-bold">
            R
          </div>
          <span className="text-lg font-bold text-rf-text-primary tracking-tight">
            ReviewFlow
          </span>
          <span className="text-[11px] text-rf-text-muted bg-rf-bg-tertiary px-2 py-0.5 rounded ml-1">
            v1.0
          </span>
          {healthStatus?.database === "ok" && (
            <span className="text-[10px] text-rf-accent bg-rf-accent/10 px-2 py-0.5 rounded-full ml-2">
              ● Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-rf-text-secondary">
            {user?.display_name || user?.github_username || "User"}
          </span>
          <div className="w-8 h-8 rounded-full bg-rf-accent-blue/15 flex items-center justify-center text-xs text-rf-accent-blue font-semibold">
            {(user?.display_name || user?.github_username || "U")
              .charAt(0)
              .toUpperCase()}
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-rf-text-muted hover:text-rf-text-secondary transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-8 py-7">
        {/* Title */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-rf-text-primary tracking-tight mb-1">
            Review Dashboard
          </h1>
          <p className="text-sm text-rf-text-secondary">
            ReviewFlow Team · {MOCK_TEAM.length} active reviewers
            {healthStatus?.tables &&
              ` · ${healthStatus.tables.length} DB tables`}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rf-accent-danger/10 border border-rf-accent-danger/30 text-rf-accent-danger text-sm">
            {error}
            <button
              onClick={fetchData}
              className="ml-3 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Pending Reviews"
            value={stats.pending}
            sub={`${prs.filter((p) => !p.assigned_reviewer).length} unassigned`}
            accent="#ffa502"
          />
          <StatCard label="In Review" value={stats.inReview} accent="#0099ff" />
          <StatCard
            label="Avg Review Time"
            value={`${stats.avgTime}m`}
            sub="target: 30m"
            accent="#00d4aa"
          />
          <StatCard
            label="Avg Complexity"
            value={stats.avgComplexity}
            sub="/10.0"
            accent="#a855f7"
          />
        </div>

        {/* Main Grid: PR Queue + Team Panel */}
        <div className="grid grid-cols-[1fr_340px] gap-7">
          {/* PR Queue */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-rf-text-primary">
                Priority Queue
              </h2>
              <div className="flex gap-1.5">
                {priorityFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 capitalize"
                    style={{
                      border: `1px solid ${filter === f.key ? f.color : "rgba(30,40,64,0.4)"}`,
                      background:
                        filter === f.key ? `${f.color}18` : "transparent",
                      color: filter === f.key ? f.color : "#8b95ab",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search PRs by title or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-rf-border bg-rf-bg-secondary text-rf-text-primary text-sm font-sans outline-none focus:border-rf-accent-blue/50 transition-colors mb-4"
            />

            {/* PR List */}
            <div className="flex flex-col gap-3">
              {filteredPrs.length > 0 ? (
                filteredPrs.map((pr) => <PrCard key={pr.pr_id} pr={pr} />)
              ) : (
                <div className="text-center py-12 text-rf-text-muted">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-sm">
                    {prs.length === 0
                      ? "No PRs yet. Open a PR on a connected repo to see it here!"
                      : "No PRs match your filters"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div>
            <TeamPanel members={MOCK_TEAM} />

            <h2 className="text-base font-semibold text-rf-text-primary mt-7 mb-4">
              Quick Actions
            </h2>
            <div className="flex flex-col gap-2">
              <button className="w-full px-4 py-3 rounded-lg border border-rf-accent/30 bg-rf-accent/10 text-rf-accent text-sm font-medium text-left flex items-center gap-2 hover:bg-rf-accent/20 transition-colors">
                <span className="text-base">+</span> Connect Repository
              </button>
              <button
                onClick={fetchData}
                className="w-full px-4 py-3 rounded-lg border border-rf-accent-blue/30 bg-rf-accent-blue/10 text-rf-accent-blue text-sm font-medium text-left flex items-center gap-2 hover:bg-rf-accent-blue/20 transition-colors"
              >
                <span className="text-base">↻</span> Refresh Data
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
