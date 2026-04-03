import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ArtifactRefSchema = z.object({
  uri: z.string().describe("MCP resource URI, e.g. agent://location-scout/bible/loc_001"),
  type: z.string().describe("Artifact type from taxonomy, e.g. location_bible"),
  mime_type: z.string().describe("MIME type, e.g. application/json or image/png"),
  version: z.number().int().min(1).optional().describe("Artifact version (increments on revision)"),
  checksum: z.string().optional().describe("SHA-256 hash for integrity"),
  storage_path: z.string().optional().describe("Internal GCS URI — not exposed to other agents"),
});

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
export const ArtifactRefJsonSchema = zodToJsonSchema(ArtifactRefSchema);
