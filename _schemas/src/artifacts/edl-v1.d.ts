import { z } from "zod";
export declare const ARTIFACT_TYPE: "edl";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "editor-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://editor/edl/{id}";
/**
 * Final flat shot table — one row per shot, denormalised with scene context.
 * Matches the row shape produced by scene_splitter vision_pipeline.run_vision_pipeline().
 */
export declare const EdlRowSchema: z.ZodObject<{
    shot_number: z.ZodNumber;
    shot_size: z.ZodEnum<["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"]>;
    action: z.ZodDefault<z.ZodString>;
    dialogue: z.ZodDefault<z.ZodString>;
    audio_transition: z.ZodDefault<z.ZodEnum<["cut", "l-cut", "j-cut"]>>;
    characters_in_frame: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    director_note: z.ZodDefault<z.ZodString>;
    emotional_intent: z.ZodDefault<z.ZodString>;
    lens: z.ZodDefault<z.ZodString>;
    shutter_speed: z.ZodDefault<z.ZodString>;
    depth_of_field: z.ZodDefault<z.ZodString>;
    lighting_style: z.ZodDefault<z.ZodString>;
    camera_angle: z.ZodOptional<z.ZodEnum<["eye_level", "low", "high", "dutch", "overhead", "ground"]>>;
    camera_movement: z.ZodOptional<z.ZodEnum<["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out", "tracking", "crane", "handheld"]>>;
    camera_rig: z.ZodOptional<z.ZodEnum<["tripod", "handheld", "steadicam", "dolly", "crane", "drone"]>>;
    composition: z.ZodOptional<z.ZodEnum<["rule_of_thirds", "symmetry", "leading_lines", "frame_in_frame", "negative_space", "centered"]>>;
    frame_balance: z.ZodOptional<z.ZodEnum<["balanced", "unbalanced", "weighted_left", "weighted_right", "top_heavy", "bottom_heavy"]>>;
    duration: z.ZodOptional<z.ZodNumber>;
} & {
    scene_id: z.ZodString;
    scene_number: z.ZodNumber;
    scene_heading: z.ZodDefault<z.ZodString>;
    location: z.ZodDefault<z.ZodString>;
    time: z.ZodDefault<z.ZodString>;
    shot_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    scene_id: string;
    dialogue: string;
    shot_id: string;
    location: string;
    time: string;
    lens: string;
    depth_of_field: string;
    shot_number: number;
    shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
    action: string;
    audio_transition: "cut" | "l-cut" | "j-cut";
    characters_in_frame: string[];
    director_note: string;
    emotional_intent: string;
    shutter_speed: string;
    lighting_style: string;
    scene_number: number;
    scene_heading: string;
    camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
    camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
    camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
    composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
    frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
    duration?: number | undefined;
}, {
    scene_id: string;
    shot_id: string;
    shot_number: number;
    shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
    scene_number: number;
    dialogue?: string | undefined;
    location?: string | undefined;
    time?: string | undefined;
    camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
    lens?: string | undefined;
    depth_of_field?: string | undefined;
    action?: string | undefined;
    audio_transition?: "cut" | "l-cut" | "j-cut" | undefined;
    characters_in_frame?: string[] | undefined;
    director_note?: string | undefined;
    emotional_intent?: string | undefined;
    shutter_speed?: string | undefined;
    lighting_style?: string | undefined;
    camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
    camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
    composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
    frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
    duration?: number | undefined;
    scene_heading?: string | undefined;
}>;
export type EdlRow = z.infer<typeof EdlRowSchema>;
export declare const EdlSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"edl-v1">;
    project_id: z.ZodString;
    total_shots: z.ZodNumber;
    total_duration_sec: z.ZodDefault<z.ZodNumber>;
    shots: z.ZodArray<z.ZodObject<{
        shot_number: z.ZodNumber;
        shot_size: z.ZodEnum<["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"]>;
        action: z.ZodDefault<z.ZodString>;
        dialogue: z.ZodDefault<z.ZodString>;
        audio_transition: z.ZodDefault<z.ZodEnum<["cut", "l-cut", "j-cut"]>>;
        characters_in_frame: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        director_note: z.ZodDefault<z.ZodString>;
        emotional_intent: z.ZodDefault<z.ZodString>;
        lens: z.ZodDefault<z.ZodString>;
        shutter_speed: z.ZodDefault<z.ZodString>;
        depth_of_field: z.ZodDefault<z.ZodString>;
        lighting_style: z.ZodDefault<z.ZodString>;
        camera_angle: z.ZodOptional<z.ZodEnum<["eye_level", "low", "high", "dutch", "overhead", "ground"]>>;
        camera_movement: z.ZodOptional<z.ZodEnum<["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out", "tracking", "crane", "handheld"]>>;
        camera_rig: z.ZodOptional<z.ZodEnum<["tripod", "handheld", "steadicam", "dolly", "crane", "drone"]>>;
        composition: z.ZodOptional<z.ZodEnum<["rule_of_thirds", "symmetry", "leading_lines", "frame_in_frame", "negative_space", "centered"]>>;
        frame_balance: z.ZodOptional<z.ZodEnum<["balanced", "unbalanced", "weighted_left", "weighted_right", "top_heavy", "bottom_heavy"]>>;
        duration: z.ZodOptional<z.ZodNumber>;
    } & {
        scene_id: z.ZodString;
        scene_number: z.ZodNumber;
        scene_heading: z.ZodDefault<z.ZodString>;
        location: z.ZodDefault<z.ZodString>;
        time: z.ZodDefault<z.ZodString>;
        shot_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        scene_id: string;
        dialogue: string;
        shot_id: string;
        location: string;
        time: string;
        lens: string;
        depth_of_field: string;
        shot_number: number;
        shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
        action: string;
        audio_transition: "cut" | "l-cut" | "j-cut";
        characters_in_frame: string[];
        director_note: string;
        emotional_intent: string;
        shutter_speed: string;
        lighting_style: string;
        scene_number: number;
        scene_heading: string;
        camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
        camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
        camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
        composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
        frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
        duration?: number | undefined;
    }, {
        scene_id: string;
        shot_id: string;
        shot_number: number;
        shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
        scene_number: number;
        dialogue?: string | undefined;
        location?: string | undefined;
        time?: string | undefined;
        camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
        lens?: string | undefined;
        depth_of_field?: string | undefined;
        action?: string | undefined;
        audio_transition?: "cut" | "l-cut" | "j-cut" | undefined;
        characters_in_frame?: string[] | undefined;
        director_note?: string | undefined;
        emotional_intent?: string | undefined;
        shutter_speed?: string | undefined;
        lighting_style?: string | undefined;
        camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
        camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
        composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
        frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
        duration?: number | undefined;
        scene_heading?: string | undefined;
    }>, "many">;
    _meta: z.ZodOptional<z.ZodObject<{
        user_edited: z.ZodBoolean;
        edited_at: z.ZodString;
        edited_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    $schema: "edl-v1";
    total_shots: number;
    total_duration_sec: number;
    shots: {
        scene_id: string;
        dialogue: string;
        shot_id: string;
        location: string;
        time: string;
        lens: string;
        depth_of_field: string;
        shot_number: number;
        shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
        action: string;
        audio_transition: "cut" | "l-cut" | "j-cut";
        characters_in_frame: string[];
        director_note: string;
        emotional_intent: string;
        shutter_speed: string;
        lighting_style: string;
        scene_number: number;
        scene_heading: string;
        camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
        camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
        camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
        composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
        frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
        duration?: number | undefined;
    }[];
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "edl-v1";
    total_shots: number;
    shots: {
        scene_id: string;
        shot_id: string;
        shot_number: number;
        shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
        scene_number: number;
        dialogue?: string | undefined;
        location?: string | undefined;
        time?: string | undefined;
        camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
        lens?: string | undefined;
        depth_of_field?: string | undefined;
        action?: string | undefined;
        audio_transition?: "cut" | "l-cut" | "j-cut" | undefined;
        characters_in_frame?: string[] | undefined;
        director_note?: string | undefined;
        emotional_intent?: string | undefined;
        shutter_speed?: string | undefined;
        lighting_style?: string | undefined;
        camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
        camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
        composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
        frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
        duration?: number | undefined;
        scene_heading?: string | undefined;
    }[];
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    total_duration_sec?: number | undefined;
}>;
export type Edl = z.infer<typeof EdlSchema>;
export declare const EdlJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
/**
 * Pacing map — the montage step's output, keyed by a `${scene_id}:${shot_number}`
 * composite so scenes processed independently don't collide.
 */
export declare const PacingMapSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"pacing-map-v1">;
    project_id: z.ZodString;
    durations: z.ZodRecord<z.ZodString, z.ZodNumber>;
    _meta: z.ZodOptional<z.ZodObject<{
        user_edited: z.ZodBoolean;
        edited_at: z.ZodString;
        edited_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    $schema: "pacing-map-v1";
    durations: Record<string, number>;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "pacing-map-v1";
    durations: Record<string, number>;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}>;
export type PacingMap = z.infer<typeof PacingMapSchema>;
export declare const PacingMapJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
