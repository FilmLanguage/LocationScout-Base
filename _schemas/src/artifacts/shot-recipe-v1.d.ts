import { z } from "zod";
export declare const ARTIFACT_TYPE: "shot_recipe";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "unassigned";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://pipeline/shot-recipe/{id}";
export declare const AudioSpecSchema: z.ZodObject<{
    ambient: z.ZodOptional<z.ZodString>;
    sfx: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dialogue: z.ZodOptional<z.ZodArray<z.ZodObject<{
        speaker: z.ZodString;
        line: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        speaker: string;
        line: string;
    }, {
        speaker: string;
        line: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    ambient?: string | undefined;
    sfx?: string[] | undefined;
    dialogue?: {
        speaker: string;
        line: string;
    }[] | undefined;
}, {
    ambient?: string | undefined;
    sfx?: string[] | undefined;
    dialogue?: {
        speaker: string;
        line: string;
    }[] | undefined;
}>;
export type AudioSpec = z.infer<typeof AudioSpecSchema>;
export declare const ShotRecipeSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"shot-recipe-v1">;
    shot_id: z.ZodString;
    scene_id: z.ZodString;
    shot_index: z.ZodNumber;
    location_ref: z.ZodObject<{
        bible_id: z.ZodString;
        anchor_uri: z.ZodString;
        mood_state_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        bible_id: string;
        anchor_uri: string;
        mood_state_id: string;
    }, {
        bible_id: string;
        anchor_uri: string;
        mood_state_id: string;
    }>;
    characters_ref: z.ZodArray<z.ZodObject<{
        bible_id: z.ZodString;
        model_sheet_uri: z.ZodString;
        appearance_state_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bible_id: string;
        model_sheet_uri: string;
        appearance_state_id?: string | undefined;
    }, {
        bible_id: string;
        model_sheet_uri: string;
        appearance_state_id?: string | undefined;
    }>, "many">;
    camera: z.ZodObject<{
        shot_type: z.ZodEnum<["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS", "OTS", "POV", "INSERT", "ESTABLISHING"]>;
        angle: z.ZodEnum<["eye_level", "low", "high", "dutch", "overhead", "ground"]>;
        movement: z.ZodEnum<["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out", "tracking", "crane"]>;
        lens_mm: z.ZodNumber;
        position_from_floorplan: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        shot_type: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS" | "OTS" | "POV" | "INSERT" | "ESTABLISHING";
        angle: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground";
        movement: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane";
        lens_mm: number;
        position_from_floorplan?: Record<string, unknown> | undefined;
    }, {
        shot_type: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS" | "OTS" | "POV" | "INSERT" | "ESTABLISHING";
        angle: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground";
        movement: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane";
        lens_mm: number;
        position_from_floorplan?: Record<string, unknown> | undefined;
    }>;
    prompt_components: z.ZodObject<{
        scene_description: z.ZodString;
        location_context: z.ZodString;
        character_context: z.ZodString;
        light_context: z.ZodString;
        mood_context: z.ZodString;
        style_context: z.ZodString;
        negative_prompt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        negative_prompt: string;
        scene_description: string;
        location_context: string;
        character_context: string;
        light_context: string;
        mood_context: string;
        style_context: string;
    }, {
        negative_prompt: string;
        scene_description: string;
        location_context: string;
        character_context: string;
        light_context: string;
        mood_context: string;
        style_context: string;
    }>;
    generation_params: z.ZodObject<{
        model: z.ZodString;
        image_ref_strength: z.ZodNumber;
        seed: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        image_ref_strength: number;
        seed?: number | null | undefined;
    }, {
        model: string;
        image_ref_strength: number;
        seed?: number | null | undefined;
    }>;
    audio: z.ZodOptional<z.ZodObject<{
        ambient: z.ZodOptional<z.ZodString>;
        sfx: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        dialogue: z.ZodOptional<z.ZodArray<z.ZodObject<{
            speaker: z.ZodString;
            line: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            speaker: string;
            line: string;
        }, {
            speaker: string;
            line: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ambient?: string | undefined;
        sfx?: string[] | undefined;
        dialogue?: {
            speaker: string;
            line: string;
        }[] | undefined;
    }, {
        ambient?: string | undefined;
        sfx?: string[] | undefined;
        dialogue?: {
            speaker: string;
            line: string;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    scene_id: string;
    $schema: "shot-recipe-v1";
    shot_id: string;
    shot_index: number;
    location_ref: {
        bible_id: string;
        anchor_uri: string;
        mood_state_id: string;
    };
    characters_ref: {
        bible_id: string;
        model_sheet_uri: string;
        appearance_state_id?: string | undefined;
    }[];
    camera: {
        shot_type: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS" | "OTS" | "POV" | "INSERT" | "ESTABLISHING";
        angle: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground";
        movement: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane";
        lens_mm: number;
        position_from_floorplan?: Record<string, unknown> | undefined;
    };
    prompt_components: {
        negative_prompt: string;
        scene_description: string;
        location_context: string;
        character_context: string;
        light_context: string;
        mood_context: string;
        style_context: string;
    };
    generation_params: {
        model: string;
        image_ref_strength: number;
        seed?: number | null | undefined;
    };
    audio?: {
        ambient?: string | undefined;
        sfx?: string[] | undefined;
        dialogue?: {
            speaker: string;
            line: string;
        }[] | undefined;
    } | undefined;
}, {
    scene_id: string;
    $schema: "shot-recipe-v1";
    shot_id: string;
    shot_index: number;
    location_ref: {
        bible_id: string;
        anchor_uri: string;
        mood_state_id: string;
    };
    characters_ref: {
        bible_id: string;
        model_sheet_uri: string;
        appearance_state_id?: string | undefined;
    }[];
    camera: {
        shot_type: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS" | "OTS" | "POV" | "INSERT" | "ESTABLISHING";
        angle: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground";
        movement: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane";
        lens_mm: number;
        position_from_floorplan?: Record<string, unknown> | undefined;
    };
    prompt_components: {
        negative_prompt: string;
        scene_description: string;
        location_context: string;
        character_context: string;
        light_context: string;
        mood_context: string;
        style_context: string;
    };
    generation_params: {
        model: string;
        image_ref_strength: number;
        seed?: number | null | undefined;
    };
    audio?: {
        ambient?: string | undefined;
        sfx?: string[] | undefined;
        dialogue?: {
            speaker: string;
            line: string;
        }[] | undefined;
    } | undefined;
}>;
export type ShotRecipe = z.infer<typeof ShotRecipeSchema>;
export declare const ShotRecipeJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
