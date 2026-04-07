import type { Stage } from "../stages";

interface Props {
  stage: Stage;
}

/**
 * Temporary placeholder shown on every stage until the real Figma frame
 * is converted into a React component. See Phase 3 of the plan.
 */
export function StagePlaceholder({ stage }: Props) {
  return (
    <section className="page-placeholder" aria-labelledby={`stage-${stage.id}-title`}>
      <span className="page-placeholder__label">Stage · {stage.id}</span>
      <h2 id={`stage-${stage.id}-title`}>{stage.label}</h2>
      <p className="page-placeholder__node">Figma node: {stage.figmaNodeId}</p>
    </section>
  );
}
