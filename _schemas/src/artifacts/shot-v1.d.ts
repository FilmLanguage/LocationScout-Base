import { z } from "zod";
export declare const ARTIFACT_TYPE: "shot";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "editor-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://editor/edl/{id}#shot/{shot_id}";
export declare const ShotSizeEnum: z.ZodEnum<["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"]>;
export declare const AudioTransitionEnum: z.ZodEnum<["cut", "l-cut", "j-cut"]>;
export declare const CameraAngleEnum: z.ZodEnum<["eye_level", "low", "high", "dutch", "overhead", "ground"]>;
export declare const CameraMovementEnum: z.ZodEnum<["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out", "tracking", "crane", "handheld"]>;
export declare const CameraRigEnum: z.ZodEnum<["tripod", "handheld", "steadicam", "dolly", "crane", "drone"]>;
export declare const CompositionEnum: z.ZodEnum<["rule_of_thirds", "symmetry", "leading_lines", "frame_in_frame", "negative_space", "centered"]>;
export declare const FrameBalanceEnum: z.ZodEnum<["balanced", "unbalanced", "weighted_left", "weighted_right", "top_heavy", "bottom_heavy"]>;
/**
 * Mirrors scene_splitter shot_breakdown.Shot dataclass — one row in the
 * Editor's final shot list. `duration` is appended by montage.assign_durations.
 */
export declare const ShotSchema: z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    dialogue: string;
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
    camera_movement?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "crane" | "handheld" | undefined;
    camera_angle?: "low" | "high" | "eye_level" | "dutch" | "overhead" | "ground" | undefined;
    camera_rig?: "crane" | "handheld" | "tripod" | "steadicam" | "dolly" | "drone" | undefined;
    composition?: "rule_of_thirds" | "symmetry" | "leading_lines" | "frame_in_frame" | "negative_space" | "centered" | undefined;
    frame_balance?: "balanced" | "unbalanced" | "weighted_left" | "weighted_right" | "top_heavy" | "bottom_heavy" | undefined;
    duration?: number | undefined;
}, {
    shot_number: number;
    shot_size: "ECU" | "CU" | "MCU" | "MS" | "MWS" | "WS" | "EWS";
    dialogue?: string | undefined;
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
}>;
export type Shot = z.infer<typeof ShotSchema>;
export declare const ShotJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
