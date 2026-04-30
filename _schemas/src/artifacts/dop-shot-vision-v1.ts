import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";
import {
  CameraAngleEnum,
  CameraMovementEnum,
  CameraRigEnum,
  CompositionEnum,
  FrameBalanceEnum,
} from "./shot-v1.js";

export const ARTIFACT_TYPE = "dop_shot_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "cinematographer-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://cinematographer/dpshv/{id}/{shot_id}" as const;

/**
 * DoP Shot Vision (DPShV) — per-shot cinematographic decisions.
 *
 * Generated after DPSV exists for the parent scene and EDL exists from Editor.
 * Fills in the DoP layer at shot resolution: angle, movement, rig, lens,
 * composition, lighting adjustments, framing notes, and mood intent.
 *
 * Hierarchy: DPFV → DPSV → DPShV (this schema)
 */
export const DoPShotVisionSchema = z.object({
  $schema: z.literal("dop-shot-vision-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  shot_id: z.string().describe("Derived from EDL: `${scene_id}_s${shot_number:03d}`"),
  shot_number: z.number().int(),

  // Physical camera decisions
  camera_angle: CameraAngleEnum.describe("Camera angle for this shot"),
  camera_movement: CameraMovementEnum.describe("Camera movement during the shot"),
  camera_rig: CameraRigEnum.describe("Physical camera support / rig"),

  // Optics
  lens: z.string().default("").describe("Focal length and why — overrides DPSV default if different"),
  shutter_speed: z.string().default("").describe("e.g. '1/50s', '1/250s for motion blur'"),
  depth_of_field: z.string().default("").describe("Specific DoF for this shot and when/if it shifts"),

  // Composition
  composition: CompositionEnum.describe("Primary compositional principle"),
  frame_balance: FrameBalanceEnum.describe("Weight distribution in frame"),

  // Shot-level creative notes
  lighting_notes: z.string().default("").describe("Shot-specific lighting adjustments from scene setup"),
  framing_notes: z.string().default("").describe("Specific framing instructions for this shot"),
  mood_note: z.string().default("").describe("One sentence: how this shot serves the scene's emotional arc"),

  _meta: ArtifactMetaSchema.optional().describe("Set by update_dpshv when a user manually edits"),
});

export type DoPShotVision = z.infer<typeof DoPShotVisionSchema>;
export const DoPShotVisionJsonSchema = zodToJsonSchema(DoPShotVisionSchema);
