/**
 * External API client for GCS, LLM, and other services.
 * Each agent customizes this for its specific external dependencies.
 */

const GCS_BUCKET = process.env.GCS_BUCKET || "";
const PROJECT_ID = process.env.PROJECT_ID || "";
const LLM_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-6";

export { GCS_BUCKET, PROJECT_ID, LLM_MODEL };
