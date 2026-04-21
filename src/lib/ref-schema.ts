/**
 * ReferenceRef — canonical shape for reference images passed into generation
 * tools. See updates/reference-images-contract.md §3.
 *
 * Agent-local for now; may be promoted to @filmlanguage/schemas once all four
 * image-gen agents use the same shape.
 */

import { z } from "zod";

export const ReferenceKindSchema = z.enum([
  "face_anchor",
  "body_anchor",
  "model_sheet",
  "anchor",
  "isometric",
  "setup",
  "style_reference",
  "shot",
  "end_frame",
  "user_upload",
  "external",
  "edit_base",
]);

export const ReferenceSourceAgentSchema = z.enum([
  "location-scout",
  "casting-director",
  "shot-generation",
  "art-director",
  "user",
]);

export const ReferenceRefSchema = z.object({
  image_id: z.string().describe("Short uuid shared with the sidecar filename"),
  uri: z.string().describe("agent://… | gs://… | data:… URL where bytes can be fetched"),
  kind: ReferenceKindSchema,
  source_agent: ReferenceSourceAgentSchema,
  prompt: z.string().optional(),
  entity_id: z.string().optional(),
  role: z.string().optional(),
});

export type ReferenceRef = z.infer<typeof ReferenceRefSchema>;

export const AGENT_KEY = "location-scout" as const;
