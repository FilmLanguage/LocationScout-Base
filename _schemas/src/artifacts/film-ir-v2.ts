import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "film_ir" as const;
export const ARTIFACT_VERSION = "v2" as const;
export const PRODUCED_BY = "1ad-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://1ad/film-ir/{id}" as const;

const ProjectSchema = z.object({
  title: z.string().describe("Film title"),
  screenplay_path: z.string().describe("Path or URI to screenplay source"),
  era: z.string().describe("Historical period, e.g. '2004 Albuquerque'"),
  genre: z.string().describe("Primary genre"),
  total_scenes: z.number().int().min(0).describe("Total number of scenes"),
});

const StoryThemeSchema = z.object({
  logline: z.string().describe("One-sentence story summary"),
  central_conflict: z.string().describe("Main dramatic conflict"),
  tone: z.string().describe("Overall tonal direction"),
  visual_motifs: z.array(z.string()).describe("Recurring visual elements"),
});

const ActSchema = z.object({
  act_number: z.number().int().min(1).max(5).describe("Act number"),
  scenes: z.array(z.string()).describe("Scene IDs in this act"),
  arc_summary: z.string().describe("Narrative arc summary"),
});

const LocationEntrySchema = z.object({
  location_id: z.string().describe("Unique location ID, e.g. loc_001"),
  bible_uri: z.string().describe("MCP resource URI: agent://location-scout/bible/{id}"),
  anchor_uri: z.string().optional().describe("MCP resource URI: agent://location-scout/anchor/{id}"),
  scenes: z.array(z.string()).describe("Scene IDs where location appears"),
  status: z.enum(["draft", "research", "bible_written", "anchor_approved", "complete"]).describe("Pipeline status"),
});

const CharacterEntrySchema = z.object({
  character_id: z.string().describe("Unique character ID, e.g. char_001"),
  bible_uri: z.string().describe("MCP resource URI: agent://casting-director/actor-profile/{id}"),
  model_sheet_uri: z.string().optional().describe("MCP resource URI for model sheet"),
  scenes: z.array(z.string()).describe("Scene IDs where character appears"),
  importance: z.enum(["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]).describe("Character importance"),
  status: z.enum(["draft", "brief", "bible_written", "anchor_approved", "complete"]).describe("Pipeline status"),
});

const ShotRecipeEntrySchema = z.object({
  scene_id: z.string().describe("Scene ID"),
  recipe_uri: z.string().describe("MCP resource URI for shot recipe"),
});

export const FilmIrSchema = z.object({
  $schema: z.literal("film-ir-v2"),
  project: ProjectSchema,
  story_theme: StoryThemeSchema,
  narrative: z.object({
    acts: z.array(ActSchema),
  }),
  locations: z.object({
    entries: z.array(LocationEntrySchema),
  }),
  characters: z.object({
    entries: z.array(CharacterEntrySchema),
  }),
  shot_recipes: z.object({
    entries: z.array(ShotRecipeEntrySchema),
  }),
});

export type FilmIr = z.infer<typeof FilmIrSchema>;
export const FilmIrJsonSchema = zodToJsonSchema(FilmIrSchema);
