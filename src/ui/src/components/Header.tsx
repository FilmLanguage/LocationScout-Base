import { NavLink } from "react-router-dom";
import { STAGES } from "../stages";
import { usePipeline } from "../state/PipelineContext";
import { isStageAccessible } from "../state/pipeline";

export function Header() {
  const { state } = usePipeline();
  return (
    <header className="header">
      <div className="header__logo">
        <div className="header__logo-mark" aria-hidden="true">
          {/* Location Scout agent icon — Design System node 2139:179 (map pin). */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(9.6523, 8.08)">
              <path
                d="M8.34766 0C12.9579 0.00019 16.6953 3.73744 16.6954 8.34764C16.6953 12.1895 13.4503 16.5828 10.2422 19.1679L10.0284 19.3252C9.00876 20.0115 7.68726 20.0116 6.66696 19.3261L6.45316 19.1689C3.23616 16.5805 7e-05 12.192 0 8.34764C9e-05 3.73744 3.73746 8e-05 8.34766 0ZM8.34766 2.00004C4.84196 2.00004 2.00006 4.84194 1.99996 8.34764C2.00006 9.74254 2.60416 11.4231 3.70706 13.1543C4.79376 14.86 6.25736 16.4439 7.70706 17.6103C8.08826 17.9167 8.60726 17.9166 8.98726 17.6103C10.4332 16.4452 11.8971 14.8602 12.9854 13.1533C14.0901 11.4206 14.6953 9.73994 14.6954 8.34764C14.6953 4.84204 11.8533 2.00014 8.34766 2.00004ZM8.34766 4.84474C10.2822 4.84494 11.8513 6.41314 11.8516 8.34764L11.8467 8.52834C11.7528 10.3791 10.2218 11.8513 8.34766 11.8515L8.16796 11.8466C6.31696 11.7529 4.84496 10.2219 4.84476 8.34764C4.84496 6.41314 6.41316 4.84494 8.34766 4.84474ZM8.34766 6.84474C7.51776 6.84494 6.84496 7.51774 6.84476 8.34764C6.84496 9.17764 7.51766 9.85134 8.34766 9.85154C9.17766 9.85134 9.85136 9.17764 9.85156 8.34764C9.85126 7.51774 9.17756 6.84494 8.34766 6.84474Z"
                fill="#F7927E"
              />
            </g>
          </svg>
        </div>
        <span>Location Scout</span>
      </div>
      <nav className="stage-nav" aria-label="Pipeline stages">
        {STAGES.map((stage, i) => {
          const accessible = isStageAccessible(state.statuses, stage.id);
          const status = state.statuses[stage.id];
          const lockIcon = status === "locked" ? "🔒 " : "";
          return (
            <span
              key={stage.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              {accessible ? (
                <NavLink
                  to={stage.path}
                  end={stage.path === "/"}
                  className={({ isActive }) =>
                    "stage-nav__item" +
                    (isActive ? " stage-nav__item--active" : "") +
                    (status === "approved" ? " stage-nav__item--approved" : "")
                  }
                >
                  {status === "approved" ? "✓ " : ""}
                  {stage.label}
                </NavLink>
              ) : (
                <span
                  className="stage-nav__item stage-nav__item--locked"
                  aria-disabled="true"
                  title="Complete the previous stage to unlock"
                >
                  {lockIcon}
                  {stage.label}
                </span>
              )}
              {i < STAGES.length - 1 && <span className="stage-nav__arrow">›</span>}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
