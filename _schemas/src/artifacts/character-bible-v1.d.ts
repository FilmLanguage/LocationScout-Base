import { z } from "zod";
export declare const ARTIFACT_TYPE: "character_bible";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "casting-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://casting-director/character-bible/{id}";
export declare const CharacterPassportSchema: z.ZodObject<{
    name: z.ZodString;
    age_apparent: z.ZodString;
    gender: z.ZodString;
    ethnicity_notes: z.ZodOptional<z.ZodString>;
    height_build: z.ZodString;
    distinguishing_marks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    importance: z.ZodEnum<["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]>;
    scenes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    scenes: string[];
    importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
    age_apparent: string;
    gender: string;
    height_build: string;
    distinguishing_marks: string[];
    ethnicity_notes?: string | undefined;
}, {
    name: string;
    scenes: string[];
    importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
    age_apparent: string;
    gender: string;
    height_build: string;
    ethnicity_notes?: string | undefined;
    distinguishing_marks?: string[] | undefined;
}>;
export declare const FaceC1Schema: z.ZodObject<{
    face_shape: z.ZodString;
    proportions: z.ZodString;
    bone_structure: z.ZodString;
}, "strip", z.ZodTypeAny, {
    face_shape: string;
    proportions: string;
    bone_structure: string;
}, {
    face_shape: string;
    proportions: string;
    bone_structure: string;
}>;
export declare const FaceC2Schema: z.ZodObject<{
    skin_texture: z.ZodString;
    moles: z.ZodOptional<z.ZodString>;
    scars: z.ZodOptional<z.ZodString>;
    wrinkles: z.ZodOptional<z.ZodString>;
    complexion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    skin_texture: string;
    moles?: string | undefined;
    scars?: string | undefined;
    wrinkles?: string | undefined;
    complexion?: string | undefined;
}, {
    skin_texture: string;
    moles?: string | undefined;
    scars?: string | undefined;
    wrinkles?: string | undefined;
    complexion?: string | undefined;
}>;
export declare const FaceAnchorSchema: z.ZodObject<{
    front_url: z.ZodString;
    three_quarter_url: z.ZodString;
    profile_url: z.ZodString;
    face_prompt: z.ZodString;
    generation_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
    feedback_notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
    front_url: string;
    three_quarter_url: string;
    profile_url: string;
    face_prompt: string;
    generation_params?: Record<string, unknown> | undefined;
    feedback_notes?: string | undefined;
}, {
    front_url: string;
    three_quarter_url: string;
    profile_url: string;
    face_prompt: string;
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
    generation_params?: Record<string, unknown> | undefined;
    feedback_notes?: string | undefined;
}>;
export declare const BodyAnchorSchema: z.ZodObject<{
    body_image_url: z.ZodString;
    body_prompt: z.ZodString;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
    proportions_json: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
    body_image_url: string;
    body_prompt: string;
    proportions_json?: Record<string, unknown> | undefined;
}, {
    body_image_url: string;
    body_prompt: string;
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
    proportions_json?: Record<string, unknown> | undefined;
}>;
export declare const CharacterBibleSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"character-bible-v1">;
    bible_id: z.ZodString;
    brief_id: z.ZodString;
    vision_id: z.ZodString;
    research_id: z.ZodString;
    passport: z.ZodObject<{
        name: z.ZodString;
        age_apparent: z.ZodString;
        gender: z.ZodString;
        ethnicity_notes: z.ZodOptional<z.ZodString>;
        height_build: z.ZodString;
        distinguishing_marks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        importance: z.ZodEnum<["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]>;
        scenes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        scenes: string[];
        importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
        age_apparent: string;
        gender: string;
        height_build: string;
        distinguishing_marks: string[];
        ethnicity_notes?: string | undefined;
    }, {
        name: string;
        scenes: string[];
        importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
        age_apparent: string;
        gender: string;
        height_build: string;
        ethnicity_notes?: string | undefined;
        distinguishing_marks?: string[] | undefined;
    }>;
    body_physics: z.ZodString;
    face_c1_structural: z.ZodObject<{
        face_shape: z.ZodString;
        proportions: z.ZodString;
        bone_structure: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        face_shape: string;
        proportions: string;
        bone_structure: string;
    }, {
        face_shape: string;
        proportions: string;
        bone_structure: string;
    }>;
    face_c2_surface: z.ZodObject<{
        skin_texture: z.ZodString;
        moles: z.ZodOptional<z.ZodString>;
        scars: z.ZodOptional<z.ZodString>;
        wrinkles: z.ZodOptional<z.ZodString>;
        complexion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        skin_texture: string;
        moles?: string | undefined;
        scars?: string | undefined;
        wrinkles?: string | undefined;
        complexion?: string | undefined;
    }, {
        skin_texture: string;
        moles?: string | undefined;
        scars?: string | undefined;
        wrinkles?: string | undefined;
        complexion?: string | undefined;
    }>;
    hair_and_groom: z.ZodString;
    base_wardrobe: z.ZodString;
    character_through_appearance: z.ZodString;
    negative_list: z.ZodArray<z.ZodString, "many">;
    face_anchor: z.ZodOptional<z.ZodObject<{
        front_url: z.ZodString;
        three_quarter_url: z.ZodString;
        profile_url: z.ZodString;
        face_prompt: z.ZodString;
        generation_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
        feedback_notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        approval_status: "approved" | "rejected" | "draft" | "pending_review";
        front_url: string;
        three_quarter_url: string;
        profile_url: string;
        face_prompt: string;
        generation_params?: Record<string, unknown> | undefined;
        feedback_notes?: string | undefined;
    }, {
        front_url: string;
        three_quarter_url: string;
        profile_url: string;
        face_prompt: string;
        approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
        generation_params?: Record<string, unknown> | undefined;
        feedback_notes?: string | undefined;
    }>>;
    body_anchor: z.ZodOptional<z.ZodObject<{
        body_image_url: z.ZodString;
        body_prompt: z.ZodString;
        approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
        proportions_json: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        approval_status: "approved" | "rejected" | "draft" | "pending_review";
        body_image_url: string;
        body_prompt: string;
        proportions_json?: Record<string, unknown> | undefined;
    }, {
        body_image_url: string;
        body_prompt: string;
        approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
        proportions_json?: Record<string, unknown> | undefined;
    }>>;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
}, "strip", z.ZodTypeAny, {
    bible_id: string;
    $schema: "character-bible-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    passport: {
        name: string;
        scenes: string[];
        importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
        age_apparent: string;
        gender: string;
        height_build: string;
        distinguishing_marks: string[];
        ethnicity_notes?: string | undefined;
    };
    negative_list: string[];
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
    body_physics: string;
    face_c1_structural: {
        face_shape: string;
        proportions: string;
        bone_structure: string;
    };
    face_c2_surface: {
        skin_texture: string;
        moles?: string | undefined;
        scars?: string | undefined;
        wrinkles?: string | undefined;
        complexion?: string | undefined;
    };
    hair_and_groom: string;
    base_wardrobe: string;
    character_through_appearance: string;
    face_anchor?: {
        approval_status: "approved" | "rejected" | "draft" | "pending_review";
        front_url: string;
        three_quarter_url: string;
        profile_url: string;
        face_prompt: string;
        generation_params?: Record<string, unknown> | undefined;
        feedback_notes?: string | undefined;
    } | undefined;
    body_anchor?: {
        approval_status: "approved" | "rejected" | "draft" | "pending_review";
        body_image_url: string;
        body_prompt: string;
        proportions_json?: Record<string, unknown> | undefined;
    } | undefined;
}, {
    bible_id: string;
    $schema: "character-bible-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    passport: {
        name: string;
        scenes: string[];
        importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
        age_apparent: string;
        gender: string;
        height_build: string;
        ethnicity_notes?: string | undefined;
        distinguishing_marks?: string[] | undefined;
    };
    negative_list: string[];
    body_physics: string;
    face_c1_structural: {
        face_shape: string;
        proportions: string;
        bone_structure: string;
    };
    face_c2_surface: {
        skin_texture: string;
        moles?: string | undefined;
        scars?: string | undefined;
        wrinkles?: string | undefined;
        complexion?: string | undefined;
    };
    hair_and_groom: string;
    base_wardrobe: string;
    character_through_appearance: string;
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
    face_anchor?: {
        front_url: string;
        three_quarter_url: string;
        profile_url: string;
        face_prompt: string;
        approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
        generation_params?: Record<string, unknown> | undefined;
        feedback_notes?: string | undefined;
    } | undefined;
    body_anchor?: {
        body_image_url: string;
        body_prompt: string;
        approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
        proportions_json?: Record<string, unknown> | undefined;
    } | undefined;
}>;
export type CharacterBible = z.infer<typeof CharacterBibleSchema>;
export type CharacterPassport = z.infer<typeof CharacterPassportSchema>;
export type FaceC1 = z.infer<typeof FaceC1Schema>;
export type FaceC2 = z.infer<typeof FaceC2Schema>;
export type FaceAnchor = z.infer<typeof FaceAnchorSchema>;
export type BodyAnchor = z.infer<typeof BodyAnchorSchema>;
export declare const CharacterBibleJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
