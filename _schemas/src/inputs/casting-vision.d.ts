import { z } from "zod";
/**
 * CastingVision — produced by Director, consumed by CastingDirector.
 * A single object per project describing the director's casting approach.
 * Fields character_emotional_state and character_visual_note are per-character overrides.
 */
export declare const CastingVisionSchema: z.ZodObject<{
    casting_philosophy: z.ZodString;
    era_style_for_characters: z.ZodOptional<z.ZodString>;
    visual_contrasts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reference_actors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    color_coding: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    character_emotional_state: z.ZodOptional<z.ZodString>;
    character_visual_note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    casting_philosophy: string;
    era_style_for_characters?: string | undefined;
    visual_contrasts?: string[] | undefined;
    reference_actors?: string[] | undefined;
    color_coding?: string[] | undefined;
    character_emotional_state?: string | undefined;
    character_visual_note?: string | undefined;
}, {
    casting_philosophy: string;
    era_style_for_characters?: string | undefined;
    visual_contrasts?: string[] | undefined;
    reference_actors?: string[] | undefined;
    color_coding?: string[] | undefined;
    character_emotional_state?: string | undefined;
    character_visual_note?: string | undefined;
}>;
export type CastingVision = z.infer<typeof CastingVisionSchema>;
