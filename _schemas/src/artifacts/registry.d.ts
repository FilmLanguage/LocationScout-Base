/**
 * Artifact Registry — canonical list of all artifact types in the platform.
 * Source of truth for artifact discovery and validation.
 */
export declare const ARTIFACT_REGISTRY: {
    readonly film_ir: {
        readonly uriPattern: "agent://1ad/film-ir/{id}";
        readonly producedBy: "1ad-base";
        readonly mimeType: "application/json";
    };
    readonly location_bible: {
        readonly uriPattern: "agent://location-scout/bible/{id}";
        readonly producedBy: "location-scout-base";
        readonly mimeType: "application/json";
    };
    readonly mood_states: {
        readonly uriPattern: "agent://location-scout/mood/{id}";
        readonly producedBy: "location-scout-base";
        readonly mimeType: "application/json";
    };
    readonly director_vision_dfv: {
        readonly uriPattern: "agent://director/vision/dfv/{id}";
        readonly producedBy: "director-base";
        readonly mimeType: "application/json";
    };
    readonly research_pack: {
        readonly uriPattern: "agent://location-scout/research/{id}";
        readonly producedBy: "location-scout-base";
        readonly mimeType: "application/json";
    };
    readonly location_anchor: {
        readonly uriPattern: "agent://location-scout/anchor/{id}";
        readonly producedBy: "location-scout-base";
        readonly mimeType: "image/png";
    };
    readonly location_floorplan: {
        readonly uriPattern: "agent://location-scout/floorplan/{id}";
        readonly producedBy: "location-scout-base";
        readonly mimeType: "image/png";
    };
    readonly character_briefs: {
        readonly uriPattern: "agent://1ad/character-briefs/{project_id}";
        readonly producedBy: "1ad-base";
        readonly mimeType: "application/json";
    };
    readonly location_briefs: {
        readonly uriPattern: "agent://1ad/location-briefs/{project_id}";
        readonly producedBy: "1ad-base";
        readonly mimeType: "application/json";
    };
    readonly scene_breakdown: {
        readonly uriPattern: "agent://1ad/scene-breakdown/{id}";
        readonly producedBy: "1ad-base";
        readonly mimeType: "application/json";
    };
    readonly script_brief: {
        readonly uriPattern: "agent://1ad/script-brief/{id}";
        readonly producedBy: "1ad-base";
        readonly mimeType: "application/json";
    };
    readonly director_film_vision: {
        readonly uriPattern: "agent://director/dfv/{id}";
        readonly producedBy: "director-base";
        readonly mimeType: "application/json";
    };
    readonly director_scene_vision: {
        readonly uriPattern: "agent://director/dsv/{id}/{scene_id}";
        readonly producedBy: "director-base";
        readonly mimeType: "application/json";
    };
    readonly dop_film_vision: {
        readonly uriPattern: "agent://cinematographer/dpfv/{id}";
        readonly producedBy: "cinematographer-base";
        readonly mimeType: "application/json";
    };
    readonly dop_scene_vision: {
        readonly uriPattern: "agent://cinematographer/dpsv/{id}/{scene_id}";
        readonly producedBy: "cinematographer-base";
        readonly mimeType: "application/json";
    };
    readonly casting_philosophy: {
        readonly uriPattern: "agent://director/casting-philosophy/{id}";
        readonly producedBy: "director-base";
        readonly mimeType: "application/json";
    };
    readonly character_bible: {
        readonly uriPattern: "agent://casting-director/character-bible/{id}";
        readonly producedBy: "casting-director-base";
        readonly mimeType: "application/json";
    };
    readonly character_research_pack: {
        readonly uriPattern: "agent://casting-director/research/{id}";
        readonly producedBy: "casting-director-base";
        readonly mimeType: "application/json";
    };
    readonly wardrobe_bible: {
        readonly uriPattern: "agent://casting-director/wardrobe/{id}";
        readonly producedBy: "casting-director-base";
        readonly mimeType: "application/json";
    };
    readonly appearance_states: {
        readonly uriPattern: "agent://casting-director/appearance/{id}";
        readonly producedBy: "casting-director-base";
        readonly mimeType: "application/json";
    };
    readonly model_sheet: {
        readonly uriPattern: "agent://casting-director/model-sheet/{id}";
        readonly producedBy: "casting-director-base";
        readonly mimeType: "application/json";
    };
    readonly shot_recipe: {
        readonly uriPattern: "agent://pipeline/shot-recipe/{id}";
        readonly producedBy: "unassigned";
        readonly mimeType: "application/json";
    };
    readonly shot_image: {
        readonly uriPattern: "agent://shot-generation/shot/{id}";
        readonly producedBy: "shot-generation-base";
        readonly mimeType: "image/png";
    };
    readonly composer_film_vision: {
        readonly uriPattern: "agent://composer/cfv/{id}";
        readonly producedBy: "composer-base";
        readonly mimeType: "application/json";
    };
    readonly composer_scene_vision: {
        readonly uriPattern: "agent://composer/csv/{project_id}/{scene_id}";
        readonly producedBy: "composer-base";
        readonly mimeType: "application/json";
    };
    readonly sound_breakdown: {
        readonly uriPattern: "agent://sound-designer/breakdown/{id}";
        readonly producedBy: "sound-designer-base";
        readonly mimeType: "application/json";
    };
    readonly sound_replacement: {
        readonly uriPattern: "agent://sound-designer/replacement/{id}";
        readonly producedBy: "sound-designer-base";
        readonly mimeType: "application/json";
    };
    readonly final_mix: {
        readonly uriPattern: "agent://sound-designer/mix/{id}";
        readonly producedBy: "sound-designer-base";
        readonly mimeType: "application/json";
    };
    readonly scene_style: {
        readonly uriPattern: "agent://art-director/scene-style/{id}";
        readonly producedBy: "art-director-base";
        readonly mimeType: "application/json";
    };
    readonly validation_report: {
        readonly uriPattern: "agent://{producer}/validation/{id}";
        readonly producedBy: "any";
        readonly mimeType: "application/json";
    };
    readonly edl: {
        readonly uriPattern: "agent://editor/edl/{id}";
        readonly producedBy: "editor-base";
        readonly mimeType: "application/json";
    };
    readonly pacing_map: {
        readonly uriPattern: "agent://editor/pacing-map/{id}";
        readonly producedBy: "editor-base";
        readonly mimeType: "application/json";
    };
};
export type ArtifactType = keyof typeof ARTIFACT_REGISTRY;
