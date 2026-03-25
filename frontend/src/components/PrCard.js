import React, { useState } from "react";

const priorityConfig = {
  critical: {
    color: "#ff4757",
    bg: "rgba(255,71,87,0.12)",
    glow: "rgba(255,71,87,0.3)",
    label: "CRITICAL",
  },
  high: {
    color: "#ffa502",
    bg: "rgba(255,165,2,0.12)",
    glow: "rgba(255,165,2,0.25)",
    label: "HIGH",
  },
  medium: {
    color: "#0099ff",
    bg: "rgba(0,153,255,0.12)",
    glow: "rgba(0,153,255,0.2)",
    label: "MEDIUM",
  },
  low: {
    color: "#00d4aa",
    bg: "rgba(0,212,170,0.12)",
    glow: "rgba(0,212,170,0.2)",
    label: "LOW",
  },
};

const stateConfig = {
  open: { color: "#00d4aa", label: "Open" },
  in_review: { color: "#0099ff", label: "In Review" },
  approved: { color: "#00d4aa", label: "Approved" },
  merged: { color: "#a855f7", label: "Merged" },
  closed: { color: "#8b95ab", label: "Closed" },
};

const tagColors = {
  auth: "#ff4757",
  security: "#ff4757",
  backend: "#0099ff",
  frontend: "#a855f7",
  database: "#ffa502",
  docs: "#00d4aa",
  config: "#8b95ab",
  tests: "#00d4aa",
  dependencies: "#8b95ab",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PrCard({ pr }) {
  const [hovered, setHovered] = useState(false);
  const cfg = priorityConfig[pr.priority] || priorityConfig.medium;
  const stateCfg = stateConfig[pr.state] || stateConfig.open;
  const tags = pr.tags || [];
  const complexityScore = parseFloat(pr.complexity_score) || 0;
  const complexityPct = Math.min((complexityScore / 10) * 100, 100);
  const complexityColor =
    pr.complexity_score >= 7
      ? "#ff4757"
      : pr.complexity_score >= 4
        ? "#ffa502"
        : "#00d4aa";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-rf-bg-secondary rounded-xl p-5 transition-all duration-300 cursor-pointer"
      style={{
        border: `1px solid ${hovered ? cfg.color + "40" : "rgba(30,40,64,0.4)"}`,
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 8px 24px ${cfg.glow}` : "none",
      }}
    >
      {/* Header: Priority + State + Time */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex gap-2 items-center">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold font-mono tracking-wider"
            style={{
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.color}22`,
            }}
          >
            {pr.priority === "critical" && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{
                  background: cfg.color,
                  boxShadow: `0 0 6px ${cfg.glow}`,
                }}
              />
            )}
            {cfg.label}
          </span>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded"
            style={{ color: stateCfg.color, background: `${stateCfg.color}18` }}
          >
            {stateCfg.label}
          </span>
        </div>
        <span className="text-[11px] text-rf-text-muted font-mono">
          {timeAgo(pr.github_created_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-rf-text-primary mb-1.5 leading-snug">
        {pr.title}
      </h3>

      {/* Author / Repo */}
      <div className="text-xs text-rf-text-secondary mb-3">
        <span className="font-mono text-rf-accent-blue">
          {pr.author_github_username || pr.author}
        </span>
        <span className="mx-1.5 text-rf-text-muted">/</span>
        <span>{pr.repository}</span>
      </div>

      {/* Complexity Bar */}
      <div className="mb-3">
        <div className="text-[10px] text-rf-text-muted mb-1 uppercase tracking-wider">
          Complexity
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-rf-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${complexityPct}%`,
                background: complexityColor,
              }}
            />
          </div>
          <span
            className="text-xs font-mono font-semibold min-w-[28px] text-right"
            style={{ color: complexityColor }}
          >
            {complexityScore.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Nutrition Label */}
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-rf-bg-primary/50 rounded-lg border border-rf-border mb-3">
        {[
          {
            label: "Lines",
            value: `+${pr.lines_added || 0} / -${pr.lines_deleted || 0}`,
            warn: (pr.lines_added || 0) + (pr.lines_deleted || 0) > 400,
          },
          {
            label: "Files",
            value: pr.files_changed || 0,
            warn: (pr.files_changed || 0) > 10,
          },
          {
            label: "Est. time",
            value: `${pr.estimated_review_time || "?"}m`,
            warn: (pr.estimated_review_time || 0) > 30,
          },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-[10px] text-rf-text-muted mb-0.5 uppercase tracking-wider">
              {m.label}
            </div>
            <div
              className={`text-[13px] font-mono font-semibold ${m.warn ? "text-rf-accent-warning" : "text-rf-text-primary"}`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {tags.map((tag) => {
            const c = tagColors[tag] || "#8b95ab";
            return (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{
                  color: c,
                  background: `${c}15`,
                  border: `1px solid ${c}25`,
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Assigned Reviewer */}
      {pr.assigned_reviewer && (
        <div className="flex items-center gap-1.5 pt-3 border-t border-rf-border">
          <div className="w-5 h-5 rounded-full bg-rf-accent-blue/15 flex items-center justify-center text-[10px] text-rf-accent-blue font-semibold">
            {pr.assigned_reviewer.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-rf-text-secondary">
            Assigned to{" "}
            <span className="text-rf-accent-blue font-mono">
              {pr.assigned_reviewer}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export default PrCard;
