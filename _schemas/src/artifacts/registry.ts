/**
 * Artifact Registry — canonical list of all artifact types in the platform.
 * Source of truth for artifact discovery and validation.
 */

import { ARTIFACT_TYPE as FILM_IR, URI_PATTERN as FILM_IR_URI, PRODUCED_BY as FILM_IR_PRODUCER, MIME_TYPE as FILM_IR_MIME } from "./film-ir-v2.js";
import { ARTIFACT_TYPE as LOCATION_BIBLE, URI_PATTERN as LOCATION_BIBLE_URI, PRODUCED_BY as LOCATION_BIBLE_PRODUCER, MIME_TYPE as LOCATION_BIBLE_MIME } from "./location-bible-v2.js";
import { ARTIFACT_TYPE as MOOD_STATES, URI_PATTERN as MOOD_STATES_URI, PRODUCED_BY as MOOD_STATES_PRODUCER, MIME_TYPE as MOOD_STATES_MIME } from "./mood-state-v1.js";
import { ARTIFACT_TYPE as DIRECTOR_VISION, URI_PATTERN as DIRECTOR_VISION_URI, PRODUCED_BY as DIRECTOR_VISION_PRODUCER, MIME_TYPE as DIRECTOR_VISION_MIME } from "./director-vision-v1.js";
import { ARTIFACT_TYPE as RESEARCH_PACK, URI_PATTERN as RESEARCH_PACK_URI, PRODUCED_BY as RESEARCH_PACK_PRODUCER, MIME_TYPE as RESEARCH_PACK_MIME } from "./research-pack-v1.js";
import { ARTIFACT_TYPE as CHARACTER_BIBLE, URI_PATTERN as CHARACTER_BIBLE_URI, PRODUCED_BY as CHARACTER_BIBLE_PRODUCER, MIME_TYPE as CHARACTER_BIBLE_MIME } from "./character-bible-v1.js";
import { ARTIFACT_TYPE as CHARACTER_RESEARCH, URI_PATTERN as CHARACTER_RESEARCH_URI, PRODUCED_BY as CHARACTER_RESEARCH_PRODUCER, MIME_TYPE as CHARACTER_RESEARCH_MIME } from "./character-research-pack-v1.js";
import { ARTIFACT_TYPE as WARDROBE_BIBLE, URI_PATTERN as WARDROBE_BIBLE_URI, PRODUCED_BY as WARDROBE_BIBLE_PRODUCER, MIME_TYPE as WARDROBE_BIBLE_MIME } from "./wardrobe-bible-v1.js";
import { ARTIFACT_TYPE as APPEARANCE_STATES, URI_PATTERN as APPEARANCE_STATES_URI, PRODUCED_BY as APPEARANCE_STATES_PRODUCER, MIME_TYPE as APPEARANCE_STATES_MIME } from "./appearance-state-v1.js";
import { ARTIFACT_TYPE as MODEL_SHEET, URI_PATTERN as MODEL_SHEET_URI, PRODUCED_BY as MODEL_SHEET_PRODUCER, MIME_TYPE as MODEL_SHEET_MIME } from "./model-sheet-v1.js";
import { ARTIFACT_TYPE as SCENE_BREAKDOWN, URI_PATTERN as SCENE_BREAKDOWN_URI, PRODUCED_BY as SCENE_BREAKDOWN_PRODUCER, MIME_TYPE as SCENE_BREAKDOWN_MIME } from "./scene-breakdown-v1.js";
import { ARTIFACT_TYPE as SCRIPT_BRIEF, URI_PATTERN as SCRIPT_BRIEF_URI, PRODUCED_BY as SCRIPT_BRIEF_PRODUCER, MIME_TYPE as SCRIPT_BRIEF_MIME } from "./script-brief-v1.js";
import { ARTIFACT_TYPE as DIRECTOR_FILM_VISION, URI_PATTERN as DIRECTOR_FILM_VISION_URI, PRODUCED_BY as DIRECTOR_FILM_VISION_PRODUCER, MIME_TYPE as DIRECTOR_FILM_VISION_MIME } from "./director-film-vision-v1.js";
import { ARTIFACT_TYPE as DOP_FILM_VISION, URI_PATTERN as DOP_FILM_VISION_URI, PRODUCED_BY as DOP_FILM_VISION_PRODUCER, MIME_TYPE as DOP_FILM_VISION_MIME } from "./dop-film-vision-v1.js";
import { ARTIFACT_TYPE as DIRECTOR_SCENE_VISION, URI_PATTERN as DIRECTOR_SCENE_VISION_URI, PRODUCED_BY as DIRECTOR_SCENE_VISION_PRODUCER, MIME_TYPE as DIRECTOR_SCENE_VISION_MIME } from "./director-scene-vision-v1.js";
import { ARTIFACT_TYPE as DOP_SCENE_VISION, URI_PATTERN as DOP_SCENE_VISION_URI, PRODUCED_BY as DOP_SCENE_VISION_PRODUCER, MIME_TYPE as DOP_SCENE_VISION_MIME } from "./dop-scene-vision-v1.js";
import { ARTIFACT_TYPE as EDL, URI_PATTERN as EDL_URI, PRODUCED_BY as EDL_PRODUCER, MIME_TYPE as EDL_MIME } from "./edl-v1.js";
import { ARTIFACT_TYPE as SHOT_RECIPE, URI_PATTERN as SHOT_RECIPE_URI, PRODUCED_BY as SHOT_RECIPE_PRODUCER, MIME_TYPE as SHOT_RECIPE_MIME } from "./shot-recipe-v1.js";

export const ARTIFACT_REGISTRY = {
  [FILM_IR]: { uriPattern: FILM_IR_URI, producedBy: FILM_IR_PRODUCER, mimeType: FILM_IR_MIME },
  [LOCATION_BIBLE]: { uriPattern: LOCATION_BIBLE_URI, producedBy: LOCATION_BIBLE_PRODUCER, mimeType: LOCATION_BIBLE_MIME },
  [MOOD_STATES]: { uriPattern: MOOD_STATES_URI, producedBy: MOOD_STATES_PRODUCER, mimeType: MOOD_STATES_MIME },
  [DIRECTOR_VISION]: { uriPattern: DIRECTOR_VISION_URI, producedBy: DIRECTOR_VISION_PRODUCER, mimeType: DIRECTOR_VISION_MIME },
  [RESEARCH_PACK]: { uriPattern: RESEARCH_PACK_URI, producedBy: RESEARCH_PACK_PRODUCER, mimeType: RESEARCH_PACK_MIME },

  // Placeholders for agents not yet implemented — add schema files when developing
  location_anchor:     { uriPattern: "agent://location-scout/anchor/{id}" as const,           producedBy: "location-scout-base" as const,       mimeType: "image/png" as const },
  location_floorplan:  { uriPattern: "agent://location-scout/floorplan/{id}" as const,        producedBy: "location-scout-base" as const,       mimeType: "image/png" as const },
  setup_extraction:    { uriPattern: "agent://location-scout/setup/{id}" as const,            producedBy: "location-scout-base" as const,       mimeType: "application/json" as const },
  [SCENE_BREAKDOWN]:   { uriPattern: SCENE_BREAKDOWN_URI, producedBy: SCENE_BREAKDOWN_PRODUCER, mimeType: SCENE_BREAKDOWN_MIME },
  [SCRIPT_BRIEF]:      { uriPattern: SCRIPT_BRIEF_URI, producedBy: SCRIPT_BRIEF_PRODUCER, mimeType: SCRIPT_BRIEF_MIME },
  [DIRECTOR_FILM_VISION]: { uriPattern: DIRECTOR_FILM_VISION_URI, producedBy: DIRECTOR_FILM_VISION_PRODUCER, mimeType: DIRECTOR_FILM_VISION_MIME },
  [DIRECTOR_SCENE_VISION]: { uriPattern: DIRECTOR_SCENE_VISION_URI, producedBy: DIRECTOR_SCENE_VISION_PRODUCER, mimeType: DIRECTOR_SCENE_VISION_MIME },
  [DOP_FILM_VISION]:   { uriPattern: DOP_FILM_VISION_URI, producedBy: DOP_FILM_VISION_PRODUCER, mimeType: DOP_FILM_VISION_MIME },
  [DOP_SCENE_VISION]:  { uriPattern: DOP_SCENE_VISION_URI, producedBy: DOP_SCENE_VISION_PRODUCER, mimeType: DOP_SCENE_VISION_MIME },
  character_brief:     { uriPattern: "agent://1ad/character-briefs/{id}" as const,            producedBy: "1ad-base" as const,                  mimeType: "application/json" as const },
  schedule:            { uriPattern: "agent://1ad/schedule/{id}" as const,                    producedBy: "1ad-base" as const,                  mimeType: "application/json" as const },
  casting_philosophy:  { uriPattern: "agent://director/casting-philosophy/{id}" as const,     producedBy: "director-base" as const,             mimeType: "application/json" as const },
  shot_list:           { uriPattern: "agent://cinematographer/shot-list/{id}" as const,       producedBy: "cinematographer-base" as const,      mimeType: "application/json" as const },
  lighting_plan:       { uriPattern: "agent://cinematographer/lighting-plan/{id}" as const,   producedBy: "cinematographer-base" as const,      mimeType: "application/json" as const },
  camera_movement_map: { uriPattern: "agent://cinematographer/camera-map/{id}" as const,      producedBy: "cinematographer-base" as const,      mimeType: "application/json" as const },
  set_design_bible:    { uriPattern: "agent://art-director/set-design/{id}" as const,         producedBy: "art-director-base" as const,         mimeType: "application/json" as const },
  props_list:          { uriPattern: "agent://art-director/props/{id}" as const,              producedBy: "art-director-base" as const,         mimeType: "application/json" as const },
  [CHARACTER_BIBLE]:   { uriPattern: CHARACTER_BIBLE_URI, producedBy: CHARACTER_BIBLE_PRODUCER, mimeType: CHARACTER_BIBLE_MIME },
  [CHARACTER_RESEARCH]: { uriPattern: CHARACTER_RESEARCH_URI, producedBy: CHARACTER_RESEARCH_PRODUCER, mimeType: CHARACTER_RESEARCH_MIME },
  [WARDROBE_BIBLE]:    { uriPattern: WARDROBE_BIBLE_URI, producedBy: WARDROBE_BIBLE_PRODUCER, mimeType: WARDROBE_BIBLE_MIME },
  [APPEARANCE_STATES]: { uriPattern: APPEARANCE_STATES_URI, producedBy: APPEARANCE_STATES_PRODUCER, mimeType: APPEARANCE_STATES_MIME },
  [MODEL_SHEET]:       { uriPattern: MODEL_SHEET_URI, producedBy: MODEL_SHEET_PRODUCER, mimeType: MODEL_SHEET_MIME },
  [SHOT_RECIPE]:       { uriPattern: SHOT_RECIPE_URI, producedBy: SHOT_RECIPE_PRODUCER, mimeType: SHOT_RECIPE_MIME },
  shot_image:          { uriPattern: "agent://shot-generation/shot/{id}" as const,            producedBy: "shot-generation-base" as const,      mimeType: "image/png" as const },
  sound_map:           { uriPattern: "agent://sound-designer/sound-map/{id}" as const,        producedBy: "sound-designer-base" as const,       mimeType: "application/json" as const },
  sfx_bible:           { uriPattern: "agent://sound-designer/sfx-bible/{id}" as const,        producedBy: "sound-designer-base" as const,       mimeType: "application/json" as const },
  ambience_design:     { uriPattern: "agent://sound-designer/ambience/{id}" as const,         producedBy: "sound-designer-base" as const,       mimeType: "application/json" as const },
  score_brief:         { uriPattern: "agent://composer/score-brief/{id}" as const,            producedBy: "composer-base" as const,             mimeType: "application/json" as const },
  cue_sheet:           { uriPattern: "agent://composer/cue-sheet/{id}" as const,              producedBy: "composer-base" as const,             mimeType: "application/json" as const },
  [EDL]:               { uriPattern: EDL_URI, producedBy: EDL_PRODUCER, mimeType: EDL_MIME },
  pacing_map:          { uriPattern: "agent://editor/pacing-map/{id}" as const,               producedBy: "editor-base" as const,               mimeType: "application/json" as const },
} as const;

export type ArtifactType = keyof typeof ARTIFACT_REGISTRY;
