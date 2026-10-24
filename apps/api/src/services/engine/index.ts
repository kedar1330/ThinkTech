export {
  generateLooks,
  filterTemplates,
  signature,
  type EngineInput,
  type EngineResult,
  type GeneratedLook,
} from './generate';
export {
  CHECK_DESCRIPTIONS,
  EVALUATION_CHECKS,
  checkResult,
  evaluationProfileInputSchema,
  formatEvaluationReport,
  runEvaluation,
  summarizeEvaluation,
  toEvaluationProfile,
  type EvaluationCheck,
  type EvaluationCheckId,
  type EvaluationEntry,
  type EvaluationProfile,
  type EvaluationProfileInput,
  type EvaluationSummary,
} from './evaluate';
export { AVOIDED_MAX_DISTANCE, LIKED_MAX_DISTANCE, closestOf, nearestColour, vocabularyColours } from './colour-match';
export { matchDesign, toEngineDesign, type EngineDesign } from './design';
export { listAllPalettes, rankPalettes } from './palettes';
export {
  resolvePreferences,
  signalsFromAppearance,
  type EngineSignals,
  type Preferences,
  type ProfileWithMeasurements,
} from './preferences';
export { templateWearType, type StyleLibrary } from './library';
export { MAX_ALTERNATIVES, MIN_ALTERNATIVES } from './slots';
