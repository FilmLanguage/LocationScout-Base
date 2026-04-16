// --- Common types ---
export { IssueSchema, type Issue, IssueJsonSchema } from "./common/issue.js";
export { FeedbackSchema, type Feedback, FeedbackJsonSchema } from "./common/feedback.js";
export { GateVerdictSchema, type GateVerdict, GateVerdictJsonSchema } from "./common/gate-verdict.js";
export { ArtifactRefSchema, type ArtifactRef, ArtifactRefJsonSchema } from "./common/artifact-ref.js";
export { TaskStatusSchema, type TaskStatus, TaskStatusJsonSchema } from "./common/task-status.js";
export { TaskResultSchema, type TaskResult, TaskResultJsonSchema } from "./common/task-result.js";
export { PaginatedSchema, PaginationInputSchema } from "./common/pagination.js";
export { ArtifactMetaSchema, type ArtifactMeta } from "./common/artifact-meta.js";

// --- Artifact schemas ---
export { FilmIrSchema, type FilmIr, FilmIrJsonSchema } from "./artifacts/film-ir-v2.js";
export { LocationBibleSchema, type LocationBible, PassportSchema, type Passport, LightBaseStateSchema, type LightBaseState, LocationBibleJsonSchema } from "./artifacts/location-bible-v2.js";
export { MoodStateSchema, type MoodState, MoodStateJsonSchema } from "./artifacts/mood-state-v1.js";
export { ShotRecipeSchema, type ShotRecipe, ShotRecipeJsonSchema } from "./artifacts/shot-recipe-v1.js";
export { DirectorVisionSchema, type DirectorVision, DirectorVisionJsonSchema } from "./artifacts/director-vision-v1.js";
export { ResearchPackSchema, type ResearchPack, ResearchPackJsonSchema } from "./artifacts/research-pack-v1.js";
export { ReviewReportSchema, type ReviewReport, ReviewReportJsonSchema } from "./artifacts/review-report-v1.js";
export { CharacterBibleSchema, type CharacterBible, CharacterPassportSchema, type CharacterPassport, FaceC1Schema, type FaceC1, FaceC2Schema, type FaceC2, FaceAnchorSchema, type FaceAnchor, BodyAnchorSchema, type BodyAnchor, CharacterBibleJsonSchema } from "./artifacts/character-bible-v1.js";
export { CharacterResearchPackSchema, type CharacterResearchPack, CharacterResearchPackJsonSchema } from "./artifacts/character-research-pack-v1.js";
export { WardrobeBibleSchema, type WardrobeBible, WardrobeEntrySchema, type WardrobeEntry, WardrobeBibleJsonSchema } from "./artifacts/wardrobe-bible-v1.js";
export { AppearanceStatesSchema, type AppearanceStates, AppearanceEntrySchema, type AppearanceEntry, AppearanceStatesJsonSchema } from "./artifacts/appearance-state-v1.js";
export { ModelSheetSchema, type ModelSheet, ModelSheetJsonSchema } from "./artifacts/model-sheet-v1.js";
export { SceneStyleSchema, type SceneStyle, StyleReferenceSchema, type StyleReference, SceneStyleJsonSchema } from "./artifacts/scene-style-v1.js";
export { ValidationReportSchema, type ValidationReport, ValidationReportJsonSchema } from "./artifacts/validation-report-v1.js";

// --- Splitter pipeline artifacts (1AD / Director / Cinematographer / Editor) ---
export { SceneBreakdownSchema, type SceneBreakdown, SceneSchema, type Scene, SceneBreakdownJsonSchema } from "./artifacts/scene-breakdown-v1.js";
export { ScriptBriefSchema, type ScriptBrief, ScriptBriefJsonSchema } from "./artifacts/script-brief-v1.js";
export { DirectorFilmVisionSchema, type DirectorFilmVision, CharacterEnergySchema, DirectorFilmVisionJsonSchema } from "./artifacts/director-film-vision-v1.js";
export { DoPFilmVisionSchema, type DoPFilmVision, DoPFilmVisionJsonSchema } from "./artifacts/dop-film-vision-v1.js";
export { DirectorSceneVisionSchema, type DirectorSceneVision, DirectorSceneVisionJsonSchema } from "./artifacts/director-scene-vision-v1.js";
export { DoPSceneVisionSchema, type DoPSceneVision, DoPSceneVisionJsonSchema } from "./artifacts/dop-scene-vision-v1.js";
export {
  ShotSchema, type Shot, ShotSizeEnum, AudioTransitionEnum, ShotJsonSchema,
  CameraAngleEnum, CameraMovementEnum, CameraRigEnum, CompositionEnum, FrameBalanceEnum,
} from "./artifacts/shot-v1.js";
export { EdlSchema, type Edl, EdlRowSchema, type EdlRow, EdlJsonSchema, PacingMapSchema, type PacingMap, PacingMapJsonSchema } from "./artifacts/edl-v1.js";

// --- Input schemas (inter-agent contracts) ---
export { LocationBriefSchema, type LocationBrief } from "./inputs/location-brief.js";
export { CharacterBriefSchema, type CharacterBrief } from "./inputs/character-brief.js";
export { DirectorVisionInputSchema, type DirectorVisionInput } from "./inputs/director-vision-input.js";
export { CastingVisionSchema, type CastingVision } from "./inputs/casting-vision.js";

// --- Registry ---
export { ARTIFACT_REGISTRY, type ArtifactType } from "./artifacts/registry.js";
