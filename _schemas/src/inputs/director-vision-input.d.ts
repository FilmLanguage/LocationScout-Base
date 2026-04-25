import { z } from "zod";
/**
 * DirectorVisionInput — produced by Director, consumed by LocationScout.
 * A simplified view of the Director's creative direction relevant to location scouting.
 * NOT the same as DirectorFilmVisionSchema (which is the full DFV artifact).
 */
export declare const DirectorVisionInputSchema: z.ZodObject<{
    era_style: z.ZodString;
    palette: z.ZodOptional<z.ZodString>;
    spatial_philosophy: z.ZodOptional<z.ZodString>;
    reference_films: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    atmosphere: z.ZodOptional<z.ZodString>;
    light_vision: z.ZodOptional<z.ZodString>;
    location_notes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    era_style: string;
    atmosphere?: string | undefined;
    spatial_philosophy?: string | undefined;
    reference_films?: string[] | undefined;
    light_vision?: string | undefined;
    palette?: string | undefined;
    location_notes?: Record<string, string> | undefined;
}, {
    era_style: string;
    atmosphere?: string | undefined;
    spatial_philosophy?: string | undefined;
    reference_films?: string[] | undefined;
    light_vision?: string | undefined;
    palette?: string | undefined;
    location_notes?: Record<string, string> | undefined;
}>;
export type DirectorVisionInput = z.infer<typeof DirectorVisionInputSchema>;
