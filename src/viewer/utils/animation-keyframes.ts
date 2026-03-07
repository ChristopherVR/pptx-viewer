import type { EffectName } from "./animation-types";

// ==========================================================================
// CSS @keyframes definitions for each effect
// ==========================================================================

const KEYFRAME_DEFINITIONS: Record<EffectName, string> = {
  // ---- Entrance effects ----
  appear: `@keyframes fuzor-appear {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
  fadeIn: `@keyframes fuzor-fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}`,
  flyInLeft: `@keyframes fuzor-flyInLeft {
	from { opacity: 0; transform: translateX(-100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
  flyInRight: `@keyframes fuzor-flyInRight {
	from { opacity: 0; transform: translateX(100%); }
	to { opacity: 1; transform: translateX(0); }
}`,
  flyInTop: `@keyframes fuzor-flyInTop {
	from { opacity: 0; transform: translateY(-100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
  flyInBottom: `@keyframes fuzor-flyInBottom {
	from { opacity: 0; transform: translateY(100%); }
	to { opacity: 1; transform: translateY(0); }
}`,
  zoomIn: `@keyframes fuzor-zoomIn {
	from { opacity: 0; transform: scale(0.3); }
	to { opacity: 1; transform: scale(1); }
}`,
  bounceIn: `@keyframes fuzor-bounceIn {
	0% { opacity: 0; transform: scale(0.3); }
	50% { opacity: 1; transform: scale(1.08); }
	70% { transform: scale(0.95); }
	100% { opacity: 1; transform: scale(1); }
}`,
  wipeIn: `@keyframes fuzor-wipeIn {
	from { clip-path: inset(0 100% 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  splitIn: `@keyframes fuzor-splitIn {
	from { clip-path: inset(50% 0 50% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  dissolveIn: `@keyframes fuzor-dissolveIn {
	0% { opacity: 0; filter: blur(8px); }
	100% { opacity: 1; filter: blur(0); }
}`,
  wheelIn: `@keyframes fuzor-wheelIn {
	from { opacity: 0; transform: rotate(-360deg) scale(0.5); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
  blindsIn: `@keyframes fuzor-blindsIn {
	from { clip-path: inset(0 0 100% 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  boxIn: `@keyframes fuzor-boxIn {
	from { clip-path: inset(50% 50% 50% 50%); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  floatIn: `@keyframes fuzor-floatIn {
	from { opacity: 0; transform: translateY(40px); }
	to { opacity: 1; transform: translateY(0); }
}`,
  riseUp: `@keyframes fuzor-riseUp {
	from { opacity: 0; transform: translateY(60px); }
	to { opacity: 1; transform: translateY(0); }
}`,
  swivel: `@keyframes fuzor-swivel {
	from { opacity: 0; transform: rotateY(-90deg); }
	to { opacity: 1; transform: rotateY(0deg); }
}`,
  expandIn: `@keyframes fuzor-expandIn {
	from { opacity: 0; transform: scale(0, 0); }
	to { opacity: 1; transform: scale(1, 1); }
}`,
  checkerboardIn: `@keyframes fuzor-checkerboardIn {
	0% { opacity: 0; }
	50% { opacity: 0.5; }
	100% { opacity: 1; }
}`,
  flashIn: `@keyframes fuzor-flashIn {
	0% { opacity: 0; }
	25% { opacity: 1; }
	50% { opacity: 0; }
	75% { opacity: 1; }
	100% { opacity: 1; }
}`,
  peekIn: `@keyframes fuzor-peekIn {
	from { clip-path: inset(100% 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  randomBarsIn: `@keyframes fuzor-randomBarsIn {
	0% { clip-path: inset(0 100% 0 0); opacity: 1; }
	30% { clip-path: inset(0 60% 0 0); opacity: 1; }
	60% { clip-path: inset(0 30% 0 0); opacity: 1; }
	100% { clip-path: inset(0 0 0 0); opacity: 1; }
}`,
  spinnerIn: `@keyframes fuzor-spinnerIn {
	from { opacity: 0; transform: rotate(-720deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,
  growTurnIn: `@keyframes fuzor-growTurnIn {
	from { opacity: 0; transform: rotate(-90deg) scale(0.4); }
	to { opacity: 1; transform: rotate(0deg) scale(1); }
}`,

  // ---- Exit effects ----
  disappear: `@keyframes fuzor-disappear {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
  fadeOut: `@keyframes fuzor-fadeOut {
	from { opacity: 1; }
	to { opacity: 0; }
}`,
  flyOutLeft: `@keyframes fuzor-flyOutLeft {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(-100%); }
}`,
  flyOutRight: `@keyframes fuzor-flyOutRight {
	from { opacity: 1; transform: translateX(0); }
	to { opacity: 0; transform: translateX(100%); }
}`,
  flyOutTop: `@keyframes fuzor-flyOutTop {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(-100%); }
}`,
  flyOutBottom: `@keyframes fuzor-flyOutBottom {
	from { opacity: 1; transform: translateY(0); }
	to { opacity: 0; transform: translateY(100%); }
}`,
  zoomOut: `@keyframes fuzor-zoomOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0.3); }
}`,
  bounceOut: `@keyframes fuzor-bounceOut {
	0% { opacity: 1; transform: scale(1); }
	25% { transform: scale(1.08); }
	100% { opacity: 0; transform: scale(0.3); }
}`,
  wipeOut: `@keyframes fuzor-wipeOut {
	from { clip-path: inset(0 0 0 0); opacity: 1; }
	to { clip-path: inset(0 0 0 100%); opacity: 0; }
}`,
  shrinkOut: `@keyframes fuzor-shrinkOut {
	from { opacity: 1; transform: scale(1); }
	to { opacity: 0; transform: scale(0); }
}`,
  dissolveOut: `@keyframes fuzor-dissolveOut {
	from { opacity: 1; filter: blur(0); }
	to { opacity: 0; filter: blur(8px); }
}`,

  // ---- Emphasis effects ----
  pulse: `@keyframes fuzor-pulse {
	0% { transform: scale(1); }
	25% { transform: scale(1.1); }
	50% { transform: scale(1); }
	75% { transform: scale(1.1); }
	100% { transform: scale(1); }
}`,
  spin: `@keyframes fuzor-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}`,
  teeter: `@keyframes fuzor-teeter {
	0% { transform: rotate(0deg); }
	25% { transform: rotate(5deg); }
	50% { transform: rotate(0deg); }
	75% { transform: rotate(-5deg); }
	100% { transform: rotate(0deg); }
}`,
  growShrink: `@keyframes fuzor-growShrink {
	0% { transform: scale(1); }
	50% { transform: scale(1.25); }
	100% { transform: scale(1); }
}`,
  transparency: `@keyframes fuzor-transparency {
	0% { opacity: 1; }
	50% { opacity: 0.4; }
	100% { opacity: 1; }
}`,
  boldFlash: `@keyframes fuzor-boldFlash {
	0% { font-weight: inherit; }
	25% { font-weight: 900; }
	50% { font-weight: inherit; }
	75% { font-weight: 900; }
	100% { font-weight: inherit; }
}`,
  wave: `@keyframes fuzor-wave {
	0% { transform: translateY(0); }
	25% { transform: translateY(-8px); }
	50% { transform: translateY(0); }
	75% { transform: translateY(8px); }
	100% { transform: translateY(0); }
}`,
  colorWave: `@keyframes fuzor-colorWave {
	0% { filter: hue-rotate(0deg); }
	50% { filter: hue-rotate(180deg); }
	100% { filter: hue-rotate(360deg); }
}`,
  bounce: `@keyframes fuzor-bounce {
	0% { transform: translateY(0); }
	20% { transform: translateY(-20px); }
	40% { transform: translateY(0); }
	60% { transform: translateY(-10px); }
	80% { transform: translateY(0); }
	100% { transform: translateY(0); }
}`,
  flash: `@keyframes fuzor-flash {
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
