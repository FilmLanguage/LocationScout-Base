import { z } from "zod";

/**
 * CastingVision — produced by Director, consumed by CastingDirector.
 * A single object per project describing the director's casting approach.
 * Fields character_emotional_state and character_visual_note are per-character overrides.
 */
export const CastingVisionSchema = z.object({
  casting_philosophy: z.string().describe("Director's overall casting approach"),
  era_style_for_characters: z.string().optional().describe("Period visual direction for characters"),
  visual_contrasts: z.array(z.string()).optional().describe("Intended visual contrasts between characters"),
  reference_actors: z.array(z.string()).optional().describe("Reference actors/archetypes for inspiration"),
  color_coding: z.array(z.string()).optional().describe("Color associations per character"),
  character_emotional_state: z.string().optional().describe("Emotional read for this character"),
  character_visual_note: z.string().optional().describe("Specific visual note from director"),
});

export type CastingVision = z.infer<typeof CastingVisionSchema>;
