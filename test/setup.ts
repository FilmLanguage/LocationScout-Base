// Vitest setup for UI / React component tests.
// Loads @testing-library/jest-dom custom matchers (toBeInTheDocument, etc.).
// Safe to import unconditionally — the matchers are no-ops in Node env.
import "@testing-library/jest-dom/vitest";
