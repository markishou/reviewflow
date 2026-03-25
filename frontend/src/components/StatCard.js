import React, { useState } from "react";

function StatCard({ label, value, sub, accent = "#00d4aa" }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-rf-bg-secondary rounded-xl px-6 py-5 relative overflow-hidden transition-all duration-300 cursor-default"
      style={{
        transform: hovered ? "translateY(-4px)" : "none",
        borderTop: hovered ? `2px solid ${accent}` : "2px solid transparent",
      }}
    >
      <div className="text-xs text-rf-text-secondary mb-1.5 font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="text-3xl font-bold text-rf-text-primary font-mono leading-tight">
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: accent }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default StatCard;
