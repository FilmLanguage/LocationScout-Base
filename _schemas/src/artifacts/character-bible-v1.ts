import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RationaleSchema } from "../common/rationale.js";

export const ARTIFACT_TYPE = "character_bible" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/character-bible/{id}" as const;

export const CharacterPassportSchema = z.object({
  name: z.string().describe("Character name as in screenplay"),
  age_apparent: z.string().describe("Apparent age or range, e.g. 'early 30s', '45-50'"),
  gender: z.string().describe("Gender presentation"),
  ethnicity_notes: z.string().optional().describe("Ethnic / cultural background relevant to visual appearance"),
  height_build: z.string().describe("Body type description, e.g. 'tall and gaunt', 'stocky, broad-shouldered'"),
  distinguishing_marks: z.array(z.string()).default([]).describe("Scars, tattoos, birthmarks, prosthetics"),
  importance: z.enum(["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]).describe("Dramatic weight"),
  scenes: z.array(z.string()).min(1).describe("Scene IDs where character appears"),
});

export const FaceC1Schema = z.object({
  face_shape: z.string().describe("Oval, round, square, heart, oblong, diamond"),
  proportions: z.string().describe("Forehead-to-chin ratio, eye spacing, nose length"),
  bone_structure: z.string().describe("Cheekbones, jawline, brow ridge description"),
});

export const FaceC2Schema = z.object({
  skin_texture: z.string().describe("Smooth, weathered, pockmarked, freckled"),
  moles: z.string().optional().describe("Placement and size of moles"),
  scars: z.string().optional().describe("Scar descriptions and locations"),
  wrinkles: z.string().optional().describe("Wrinkle pattern: forehead, crow's feet, nasolabial"),
  complexion: z.string().optional().describe("Skin tone, undertone, sun damage"),
});

export const FaceAnchorSchema = z.object({
  front_url: z.string().describe("URL to frontal face image"),
  three_quarter_url: z.string().describe("URL to 3/4 angle face image"),
  profile_url: z.string().describe("URL to profile face image"),
  face_prompt: z.string().describe("Generation prompt used to create face anchors"),
  generation_params: z.record(z.unknown()).optional().describe("Model-specific generation parameters"),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  feedback_notes: z.string().optional().describe("Notes from approval/rejection"),
});

export const BodyAnchorSchema = z.object({
  body_image_url: z.string().describe("URL to full-body reference image"),
  body_prompt: z.string().describe("Generation prompt used to create body anchor"),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  proportions_json: z.record(z.unknown()).optional().describe("Body proportions metadata"),
});

export const CharacterBibleSchema = z.object({
  $schema: z.literal("character-bible-v1"),
  bible_id: z.string().describe("Unique bible ID, e.g. char_001"),
  brief_id: z.string().describe("Reference to source AD Character Brief"),
  vision_id: z.string().describe("Reference to Director's casting vision"),
  research_id: z.string().describe("Reference to CharacterResearchPack"),
  passport: CharacterPassportSchema,
  body_physics: z.string().describe("Posture, gait, habitual gestures, physical mannerisms"),
  face_c1_structural: FaceC1Schema,
  face_c2_surface: FaceC2Schema,
  hair_and_groom: z.string().describe("Base hairstyle, color, facial hair, grooming level"),
  base_wardrobe: z.string().describe("Default outfit description for majority of scenes"),
  character_through_appearance: z.string().describe("How visual appearance expresses inner character arc"),
  negative_list: z.array(z.string()).min(1).describe("Visual elements that must NEVER appear (goes to negative_prompt)"),
  face_anchor: FaceAnchorSchema.optional().describe("Generated face reference images (added after generation step)"),
  body_anchor: BodyAnchorSchema.optional().describe("Generated body reference image (added after generation step)"),
  rationale: RationaleSchema.optional().describe("Optional explainability: why these creative choices were made (face structure, body physics, wardrobe palette). Filled by LLM during write_character_bible when explainability is enabled."),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
});

export type CharacterBible = z.infer<typeof CharacterBibleSchema>;
export type CharacterPassport = z.infer<typeof CharacterPassportSchema>;
export type FaceC1 = z.infer<typeof FaceC1Schema>;
export type FaceC2 = z.infer<typeof FaceC2Schema>;
export type FaceAnchor = z.infer<typeof FaceAnchorSchema>;
export type BodyAnchor = z.infer<typeof BodyAnchorSchema>;
export const CharacterBibleJsonSchema = zodToJsonSchema(CharacterBibleSchema);
