import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Top-level React Error Boundary for the Location Scout UI.
 *
 * Renders a palette-locked fallback (via CSS vars from @filmlanguage/tokens)
 * with Retry + Report (mailto) actions. T22 — UI hardening for beta launch.
 */

interface Props {
  children: ReactNode;
  agentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.agentName, error, info);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const agent = this.props.agentName ?? "agent";
    const message = this.state.error?.message ?? "unknown error";
    const projectId =
      new URLSearchParams(window.location.search).get("project_id") ?? "?";
    const subject = encodeURIComponent(`Bug report: ${agent} UI`);
    const body = encodeURIComponent(
      `Error: ${message}\n\nproject_id: ${projectId}\nurl: ${window.location.href}`,
    );

    return (
      <div
        role="alert"
        style={{
          padding: "2rem",
          minHeight: "100vh",
          color: "var(--text)",
          background: "var(--bg)",
          fontFamily: "var(--sans)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Что-то пошло не так. Попробуйте ещё раз.</h2>
        <p style={{ opacity: 0.7, fontFamily: "ui-monospace, Menlo, monospace" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Retry
          </button>
          <a
            href={`mailto:bugs@filmlanguage.dev?subject=${subject}&body=${body}`}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            Report
          </a>
        </div>
      </div>
    );
  }
}
