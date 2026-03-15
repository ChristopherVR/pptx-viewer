import type { EffectName } from "./animation-types";

// ==========================================================================
// CSS @keyframes definitions for each effect
// ==========================================================================

const KEYFRAME_DEFINITIONS: Record<EffectName, string> = {
  // ---- Entrance effects ----
  appear: `@keyframes pptx-appear {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
  fadeIn: `@keyframes pptx-fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
  flyInLeft: `@keyframes pptx-flyInLeft {
	from { opacity: 0; transform: translateX(-100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
  flyInRight: `@keyframes pptx-flyInRight {
	from { opacity: 0; transform: translateX(100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
  flyInTop: `@keyframes pptx-flyInTop {
	from { opacity: 0; transform: translateY(-100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
  flyInBottom: `@keyframes pptx-flyInBottom {
	from { opacity: 0; transform: translateY(100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
  zoomIn: `@keyframes pptx-zoomIn {
	from { opacity: 0; transform: scale(0.3); }
	to { opacity: 1; transform: scale(1); }
}`,
  bounceIn: `@keyframes pptx-bounceIn {
	0% { opacity: 0; transform: scale(0.3); }
	50% { opacity: 1; transform: scale(1.08); }
	70% { transform: scale(0.95); }
	100% { opacity: 1; transform: scale(1); }
}`,
  wipeIn: `@keyframes pptx-wipeIn {
	from { clip-path: inset(0 100% 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  splitIn: `@keyframes pptx-splitIn {
	from { clip-path: inset(50% 0 50% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  dissolveIn: `@keyframes pptx-dissolveIn {
	0% { opacity: 0; filter: blur(8px); }
	100% { opacity: 1; filter: blur(0); }
}`,
  wheelIn: `@keyframes pptx-wheelIn {
	from { opacity: 0; transform: rotate(-360deg) scale(0.5); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
  blindsIn: `@keyframes pptx-blindsIn {
	from { clip-path: inset(0 0 100% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  boxIn: `@keyframes pptx-boxIn {
	from { clip-path: inset(50% 50% 50% 50%); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  floatIn: `@keyframes pptx-floatIn {
	from { opacity: 0; transform: translateY(40px); }
	to { opacity: 1; transform: translateY(0); }
}`,
  riseUp: `@keyframes pptx-riseUp {
	from { opacity: 0; transform: translateY(60px); }
	to { opacity: 1; transform: translateY(0); }
}`,
  swivel: `@keyframes pptx-swivel {
	from { opacity: 0; transform: rotateY(-90deg); }
	to { opacity: 1; transform: rotateY(0deg); }
}`,
  expandIn: `@keyframes pptx-expandIn {
	from { opacity: 0; transform: scale(0, 0); }
	to { opacity: 1; transform: scale(1, 1); }
}`,
  checkerboardIn: `@keyframes pptx-checkerboardIn {
	0% { opacity: 0; }
	50% { opacity: 0.5; }
	100% { opacity: 1; }
}`,
  flashIn: `@keyframes pptx-flashIn {
	0% { opacity: 0; }
	25% { opacity: 1; }
	50% { opacity: 0; }
	75% { opacity: 1; }
	100% { opacity: 1; }
}`,
  peekIn: `@keyframes pptx-peekIn {
	from { clip-path: inset(100% 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  randomBarsIn: `@keyframes pptx-randomBarsIn {
	0% { clip-path: inset(0 100% 0 0); opacity: 1; }
	30% { clip-path: inset(0 60% 0 0); opacity: 1; }
	60% { clip-path: inset(0 30% 0 0); opacity: 1; }
	100% { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  spinnerIn: `@keyframes pptx-spinnerIn {
	from { opacity: 0; transform: rotate(-720deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
  growTurnIn: `@keyframes pptx-growTurnIn {
	from { opacity: 0; transform: rotate(-90deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,

  // ---- Exit effects ----
  disappear: `@keyframes pptx-disappear {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
  fadeOut: `@keyframes pptx-fadeOut {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
  flyOutLeft: `@keyframes pptx-flyOutLeft {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(-100%); }
}`,
  flyOutRight: `@keyframes pptx-flyOutRight {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(100%); }
}`,
  flyOutTop: `@keyframes pptx-flyOutTop {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(-100%); }
}`,
  flyOutBottom: `@keyframes pptx-flyOutBottom {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(100%); }
}`,
  zoomOut: `@keyframes pptx-zoomOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0.3); }
}`,
  bounceOut: `@keyframes pptx-bounceOut {
	0% { opacity: 1; transform: scale(1); }
	25% { transform: scale(1.08); }
	100% { opacity: 0; transform: scale(0.3); }
}`,
  wipeOut: `@keyframes pptx-wipeOut {
	from { clip-path: inset(0 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 100%); opacity: 0; }
}`,
  shrinkOut: `@keyframes pptx-shrinkOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0); }
}`,
  dissolveOut: `@keyframes pptx-dissolveOut {
	from { opacity: 1; filter: blur(0); }
	to { opacity: 0; filter: blur(8px); }
}`,

  // ---- Emphasis effects ----
  pulse: `@keyframes pptx-pulse {
	0% { transform: scale(1); }
	25% { transform: scale(1.1); }
	50% { transform: scale(1); }
	75% { transform: scale(1.1); }
	100% { transform: scale(1); }
}`,
  spin: `@keyframes pptx-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}`,
  teeter: `@keyframes pptx-teeter {
	0% { transform: rotate(0deg); }
	25% { transform: rotate(5deg); }
	50% { transform: rotate(0deg); }
	75% { transform: rotate(-5deg); }
	100% { transform: rotate(0deg); }
}`,
  growShrink: `@keyframes pptx-growShrink {
	0% { transform: scale(1); }
	50% { transform: scale(1.25); }
	100% { transform: scale(1); }
}`,
  transparency: `@keyframes pptx-transparency {
	0% { opacity: 1; }
	50% { opacity: 0.4; }
	100% { opacity: 1; }
}`,
  boldFlash: `@keyframes pptx-boldFlash {
	0% { font-weight: inherit; }
	25% { font-weight: 900; }
	50% { font-weight: inherit; }
	75% { font-weight: 900; }
	100% { font-weight: inherit; }
}`,
  wave: `@keyframes pptx-wave {
	0% { transform: translateY(0); }
	25% { transform: translateY(-8px); }
	50% { transform: translateY(0); }
	75% { transform: translateY(8px); }
	100% { transform: translateY(0); }
}`,
  colorWave: `@keyframes pptx-colorWave {
	0% { filter: hue-rotate(0deg); }
	50% { filter: hue-rotate(180deg); }
	100% { filter: hue-rotate(360deg); }
}`,
  bounce: `@keyframes pptx-bounce {
	0% { transform: translateY(0); }
	20% { transform: translateY(-20px); }
	40% { transform: translateY(0); }
	60% { transform: translateY(-10px); }
	80% { transform: translateY(0); }
	100% { transform: translateY(0); }
}`,
  flash: `@keyframes pptx-flash {
	0% { opacity: 1; }
	25% { opacity: 0; }
	50% { opacity: 1; }
	75% { opacity: 0; }
	100% { opacity: 1; }
}`,
};

// ==========================================================================
// Public helper: get keyframe CSS for an effect name
// ==========================================================================

export function getEffectKeyframes(effect: EffectName): string {
  return KEYFRAME_DEFINITIONS[effect] ?? "";
}
