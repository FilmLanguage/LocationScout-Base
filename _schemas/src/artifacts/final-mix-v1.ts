import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";
import { SoundLayerEnum } from "./sound-breakdown-v1.js";

export const ARTIFACT_TYPE = "final_mix" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "sound-designer-base" as const;
export const URI_PATTERN = "agent://sound-designer/mix/{id}" as const;
export const MIME_TYPE = "application/json" as const;

export const LayerSummarySchema = z.object({
  layer: SoundLayerEnum,
  volume_db: z.number(),
  segments_count: z.number(),
  generated_count: z.number().describe("How many segments were regenerated (0 for dialogue)"),
});

/**
 * Final Mix — exported audio mixdown for a scene.
 *
 * Created by `export_mix` tool: combines all 6 layers with
 * volume adjustments, normalizes to LUFS target, optionally
 * re-muxes with source video.
 */
export const FinalMixSchema = z.object({
  $schema: z.literal("final-mix-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  layers: z.array(LayerSummarySchema),
  lufs_measured: z.number().describe("Measured integrated loudness (LUFS)"),
  lufs_target: z.number().default(-14).describe("Target LUFS for normalization"),
  audio_url: z.string(),
  video_url: z.string().optional().describe("If re-muxed with original video"),
  format: z.enum(["wav", "mp3", "aac"]).default("wav"),
  exported_at: z.string().describe("ISO8601"),
  _meta: ArtifactMetaSchema.optional(),
});

export type FinalMix = z.infer<typeof FinalMixSchema>;
export type LayerSummary = z.infer<typeof LayerSummarySchema>;
export const FinalMixJsonSchema = zodToJsonSchema(FinalMixSchema);
