import { z } from "zod";
export declare const ARTIFACT_TYPE: "film_ir";
export declare const ARTIFACT_VERSION: "v2";
export declare const PRODUCED_BY: "1ad-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://1ad/film-ir/{id}";
export declare const FilmIrSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"film-ir-v2">;
    project: z.ZodObject<{
        title: z.ZodString;
        screenplay_path: z.ZodString;
        era: z.ZodString;
        genre: z.ZodString;
        total_scenes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        title: string;
        screenplay_path: string;
        era: string;
        genre: string;
        total_scenes: number;
    }, {
        title: string;
        screenplay_path: string;
        era: string;
        genre: string;
        total_scenes: number;
    }>;
    story_theme: z.ZodObject<{
        logline: z.ZodString;
        central_conflict: z.ZodString;
        tone: z.ZodString;
        visual_motifs: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        logline: string;
        central_conflict: string;
        tone: string;
        visual_motifs: string[];
    }, {
        logline: string;
        central_conflict: string;
        tone: string;
        visual_motifs: string[];
    }>;
    narrative: z.ZodObject<{
        acts: z.ZodArray<z.ZodObject<{
            act_number: z.ZodNumber;
            scenes: z.ZodArray<z.ZodString, "many">;
            arc_summary: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }, {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        acts: {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }[];
    }, {
        acts: {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }[];
    }>;
    locations: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            location_id: z.ZodString;
            bible_uri: z.ZodString;
            anchor_uri: z.ZodOptional<z.ZodString>;
            scenes: z.ZodArray<z.ZodString, "many">;
            status: z.ZodEnum<["draft", "research", "bible_written", "anchor_approved", "complete"]>;
        }, "strip", z.ZodTypeAny, {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }, {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }[];
    }, {
        entries: {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }[];
    }>;
    characters: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            character_id: z.ZodString;
            bible_uri: z.ZodString;
            model_sheet_uri: z.ZodOptional<z.ZodString>;
            scenes: z.ZodArray<z.ZodString, "many">;
            importance: z.ZodEnum<["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]>;
            status: z.ZodEnum<["draft", "brief", "bible_written", "anchor_approved", "complete"]>;
        }, "strip", z.ZodTypeAny, {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }, {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }[];
    }, {
        entries: {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }[];
    }>;
    shot_recipes: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            scene_id: z.ZodString;
            recipe_uri: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            scene_id: string;
            recipe_uri: string;
        }, {
            scene_id: string;
            recipe_uri: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            scene_id: string;
            recipe_uri: string;
        }[];
    }, {
        entries: {
            scene_id: string;
            recipe_uri: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    $schema: "film-ir-v2";
    project: {
        title: string;
        screenplay_path: string;
        era: string;
        genre: string;
        total_scenes: number;
    };
    story_theme: {
        logline: string;
        central_conflict: string;
        tone: string;
        visual_motifs: string[];
    };
    narrative: {
        acts: {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }[];
    };
    locations: {
        entries: {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }[];
    };
    characters: {
        entries: {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }[];
    };
    shot_recipes: {
        entries: {
            scene_id: string;
            recipe_uri: string;
        }[];
    };
}, {
    $schema: "film-ir-v2";
    project: {
        title: string;
        screenplay_path: string;
        era: string;
        genre: string;
        total_scenes: number;
    };
    story_theme: {
        logline: string;
        central_conflict: string;
        tone: string;
        visual_motifs: string[];
    };
    narrative: {
        acts: {
            act_number: number;
            scenes: string[];
            arc_summary: string;
        }[];
    };
    locations: {
        entries: {
            location_id: string;
            status: "research" | "draft" | "bible_written" | "anchor_approved" | "complete";
            scenes: string[];
            bible_uri: string;
            anchor_uri?: string | undefined;
        }[];
    };
    characters: {
        entries: {
            status: "draft" | "bible_written" | "anchor_approved" | "complete" | "brief";
            scenes: string[];
            bible_uri: string;
            character_id: string;
            importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
            model_sheet_uri?: string | undefined;
        }[];
    };
    shot_recipes: {
        entries: {
            scene_id: string;
            recipe_uri: string;
        }[];
    };
}>;
export type FilmIr = z.infer<typeof FilmIrSchema>;
export declare const FilmIrJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
