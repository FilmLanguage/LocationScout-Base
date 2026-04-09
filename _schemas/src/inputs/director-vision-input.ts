import { z } from "zod";

/**
 * DirectorVisionInput — produced by Director, consumed by LocationScout.
 * A simplified view of the Director's creative direction relevant to location scouting.
 * NOT the same as DirectorFilmVisionSchema (which is the full DFV artifact).
 */
export const DirectorVisionInputSchema = z.object({
  era_style: z.string().describe("Period and visual style direction"),
  palette: z.string().optional().describe("Color palette description"),
  spatial_philosophy: z.string().optional().describe("How spaces should feel"),
  reference_films: z.array(z.string()).optional().describe("Reference films"),
  atmosphere: z.string().optional().describe("Atmospheric direction"),
  light_vision: z.string().optional().describe("Lighting philosophy"),
  location_notes: z.record(z.string(), z.string()).optional().describe(
    "Per-location director notes keyed by location_id, e.g. { 'a1b2...': 'sterile, no warmth' }"
  ),
});

export type DirectorVisionInput = z.infer<typeof DirectorVisionInputSchema>;
