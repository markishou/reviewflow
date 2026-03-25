import React from "react";

function TeamMember({ member }) {
  const total = (member.pending_reviews || 0) + (member.active_reviews || 0);
  const loadColor = total >= 4 ? "#ff4757" : total >= 2 ? "#ffa502" : "#00d4aa";
  const initials = (member.display_name || member.github_username || "??")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bg-rf-bg-secondary rounded-lg px-4 py-3.5 flex items-center gap-3.5">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
        style={{ background: `${loadColor}18`, color: loadColor }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-rf-text-primary truncate">
          {member.display_name}
        </div>
        <div className="text-[11px] text-rf-text-secondary font-mono">
          @{member.github_username}
        </div>
      </div>
      <div className="flex gap-3 shrink-0">
        {[
          {
            value: member.pending_reviews || 0,
            label: "Pending",
            color: loadColor,
          },
          {
            value: member.active_reviews || 0,
            label: "Active",
            color: "#0099ff",
          },
          {
            value: member.completed_today || 0,
            label: "Done",
            color: "#00d4aa",
          },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="text-lg font-bold font-mono"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div className="text-[9px] text-rf-text-muted uppercase tracking-wider">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamPanel({ members = [] }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-rf-text-primary mb-4">
        Team Capacity
      </h2>
      <div className="flex flex-col gap-2.5">
        {members.length > 0 ? (
          members.map((m) => <TeamMember key={m.github_username} member={m} />)
        ) : (
          <div className="text-center py-8 text-rf-text-muted text-sm">
            No team members found
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamPanel;
