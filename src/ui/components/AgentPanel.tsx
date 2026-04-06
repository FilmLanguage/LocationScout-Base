import React, { useState } from "react";
import { color, font, spacing, radius, motion } from "../tokens.js";
import { useMcpClient } from "../hooks/useMcpClient.js";

interface AgentPanelProps {
  mcpEndpoint?: string;
}

export function AgentPanel({ mcpEndpoint = "/mcp" }: AgentPanelProps) {
  const { callTool, loading } = useMcpClient(mcpEndpoint);
  const [status, setStatus] = useState<{ ok: boolean; version?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePing = async () => {
    setError(null);
    const result = await callTool<{ status: string; version: string }>("ping", {});
    if (result.error) setError(result.error);
    else if (result.data) setStatus({ ok: true, version: result.data.version });
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh", backgroundColor: color.bg,
      display: "flex", flexDirection: "column", fontFamily: font.family,
    }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", gap: spacing.sm,
        padding: `8px ${spacing.xl} 9px ${spacing.xl}`,
        borderBottom: `1px solid ${color.border}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          backgroundColor: "rgba(21,107,244,0.3)",
        }} />
        <span style={{
          fontSize: font.sizeLg, fontWeight: font.weightSemiBold,
          color: color.textPrimary,
        }}>
          Location Scout
        </span>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: spacing.xl,
        padding: spacing.xl,
      }}>
        <div style={{
          backgroundColor: color.bgCard,
          border: `1px solid ${color.borderCard}`,
          borderRadius: radius.md, padding: spacing.xl,
          display: "flex", flexDirection: "column", gap: spacing.lg,
          maxWidth: 480, width: "100%",
        }}>
          <span style={{
            fontSize: font.sizeMd, fontWeight: font.weightSemiBold,
            color: color.textPrimary,
          }}>
            Agent Panel — Ready for Implementation
          </span>
          <span style={{ fontSize: font.sizeSm, color: color.textSecondary, lineHeight: "1.6" }}>
            MCP backend is running. UI components will be built from the Figma mockups
            for this agent. Use the button below to verify the backend connection.
          </span>

          <button
            onClick={handlePing}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "9px 17px", minHeight: 36, borderRadius: radius.md,
              border: `1px solid ${color.accentBlueBorder}`,
              backgroundColor: color.accentBlue, color: "#fafafa",
              fontFamily: font.family, fontSize: font.sizeSm, fontWeight: font.weightMedium,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
              transition: `all ${motion.durationFast} ${motion.easing}`,
              minWidth: 44,
            }}
          >
            {loading ? "..." : "Ping MCP Backend"}
          </button>

          {status && (
            <div style={{
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: color.tagGreenBg, borderRadius: radius.sm,
              fontSize: font.sizeSm, color: color.accentGreen,
            }}>
              Connected — v{status.version}
            </div>
          )}

          {error && (
            <div style={{
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: color.tagRedBg, borderRadius: radius.sm,
              fontSize: font.sizeSm, color: color.accentRed,
            }}>
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
