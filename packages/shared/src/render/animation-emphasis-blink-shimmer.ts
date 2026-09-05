/**
 * `animation-emphasis-blink-shimmer` - CSS `@keyframes` for the two
 * ribbon-only emphasis effects that have no existing keyframe anywhere in
 * the catalogue: Blink (emph.35) and Shimmer (emph.36). See
 * `animation-emphasis-ground-truth.ts` for the COM/UI-Automation evidence
 * behind each shape.
 *
 * Registered in `animation-keyframes.ts`'s `KEYFRAME_DEFINITIONS` and mapped
 * from `PRESET_ID_TO_EFFECT.emph[35]` / `[36]` in `animation-presets.ts`.
 *
 * @module render/animation-emphasis-blink-shimmer
 */

/** Effect-name keys these two keyframes are meant to be registered under once wired. */
export type BlinkShimmerEffectName = 'blink' | 'shimmer';

/**
 * Ready-to-merge CSS `@keyframes` text, keyed exactly like
 * `animation-keyframes.ts`'s `KEYFRAME_DEFINITIONS` (name -> full `@keyframes
 * pptx-<name> { ... }` block, prefix included).
 *
 * - `blink` (emph.35): a hard on/off visibility toggle, distinct from
 *   `pulse`'s smooth fade-and-grow (PowerPoint's own XML uses a discrete
 *   `calcmode="discrete"` `style.visibility` hidden/visible pair, not a
 *   continuous opacity ramp).
 * - `shimmer` (emph.36): a brief horizontal wiggle paired with a shallow
 *   80%/100% width squeeze-and-release, matching the `p:animScale` +
 *   `ppt_w`-relative `p:anim` pair PowerPoint authors for it.
 */
export const BLINK_SHIMMER_KEYFRAME_DEFINITIONS: Record<BlinkShimmerEffectName, string> = {
	blink: `@keyframes pptx-blink {
	0%, 49% { visibility: visible; opacity: 1; }
	50%, 99% { visibility: hidden; opacity: 0; }
	100% { visibility: visible; opacity: 1; }
}`,
	shimmer: `@keyframes pptx-shimmer {
	0% { transform: translateX(0) scaleX(1); }
	25% { transform: translateX(-2%) scaleX(0.8); }
	50% { transform: translateX(2%) scaleX(1); }
	75% { transform: translateX(-1%) scaleX(0.9); }
	100% { transform: translateX(0) scaleX(1); }
}`,
};
