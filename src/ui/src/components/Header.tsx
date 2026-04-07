import { NavLink } from "react-router-dom";
import { STAGES } from "../stages";
import { usePipeline } from "../state/PipelineContext";
import { isStageAccessible } from "../state/pipeline";

export function Header() {
  const { state } = usePipeline();
  return (
    <header className="header">
      <div className="header__logo">
        <div className="header__logo-mark">
          <img src="/logo.svg" alt="" aria-hidden="true" />
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
