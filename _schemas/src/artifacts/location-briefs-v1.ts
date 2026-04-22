import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LocationBriefSchema } from "../inputs/location-brief.js";

export const ARTIFACT_TYPE = "location_briefs" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "1ad-base" as const;
export const URI_PATTERN = "agent://1ad/location-briefs/{project_id}" as const;
export const MIME_TYPE = "application/json" as const;

/**
 * LocationBriefs — the collection artifact 1AD writes as
 * location_briefs.json after extract_locations. Downstream LocationScout
 * reads this file. Individual entries conform to LocationBriefSchema
 * (inputs/location-brief.ts).
 */
export const LocationBriefsSchema = z.object({
  $schema: z.literal("location-briefs-v1"),
  project_id: z.string(),
  total_locations: z.number().int().nonnegative(),
  locations: z.array(LocationBriefSchema),
});

export type LocationBriefs = z.infer<typeof LocationBriefsSchema>;
export const LocationBriefsJsonSchema = zodToJsonSchema(LocationBriefsSchema);
