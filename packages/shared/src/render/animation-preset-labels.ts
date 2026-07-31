/**
 * `animation-preset-labels`: the naming layer over the two animation preset
 * vocabularies, so no binding ever prints a wire token where an effect name
 * belongs.
 *
 * WHY this module exists: an animation's effect is identified by one of two
 * different vocabularies, and both of them were reaching the screen verbatim.
 *
 *  - The **editor vocabulary** (`PptxAnimationPreset`: `fadeIn`, `growTurnIn`,
 *    `boldFlash`, ...) is what `PptxElementAnimation.entrance / emphasis / exit`
 *    actually holds. It is what the ribbon galleries apply and what the parser
 *    normalises a loaded deck's OOXML presets down to. Every timeline in every
 *    binding printed this token raw, so users saw `fadeIn` where "Fade In"
 *    belongs.
 *  - The **OOXML catalogue vocabulary** (`entr.1`, `emph.26`, `path.loop.pretzel`
 *    from `pptx-viewer-core`'s `animation-preset-catalog`) is the full 266-entry
 *    PowerPoint preset library. Its entries carry a hard-coded ENGLISH `label`,
 *    which the Vue "Add animation > Effect" picker rendered directly, so that
 *    control stayed English in every locale.
 *
 * Both vocabularies now resolve through i18n keys defined here, which means a
 * missing name is a dictionary gap that `packages/locales`' coverage tests
 * catch, not a plausible-looking wrong label produced by `keyToLabel`.
 *
 * WHY the catalogue key is a slug and not the preset id: the dictionaries are
 * flat maps whose keys are dotted paths, and a catalogue id already contains
 * dots (`path.line.up`). Folding them into one camelCase segment
 * (`pathLineUp`) keeps every animation key at the same depth as the rest of the
 * dictionary, so no translation framework has to be trusted to resolve a
 * five-segment key against a flat map.
 *
 * Pure data + pure functions: no framework, no DOM.
 *
 * @module render/animation-preset-labels
 */

import type { PptxAnimationPreset, PptxElementAnimation } from 'pptx-viewer-core';

/**
 * The minimal translate contract every binding can satisfy (react-i18next's
 * `t`, vue-i18n's `t`, ngx-translate's `instant`, vanilla's `Translator`).
 */
export type AnimationLabelTranslate = (key: string) => string;

/**
 * Every `PptxAnimationPreset` value except `'none'`, i.e. every effect token
 * that can end up on a `PptxElementAnimation` and therefore in a timeline row.
 *
 * Kept as a runtime array (the type is a bare union) so the dictionary coverage
 * test can enumerate what the UI can reach instead of trusting a hand-kept list
 * of "the ones we bothered to name".
 */
export const ANIMATION_PRESET_VALUES: readonly PptxAnimationPreset[] = [
	// Entrance
	'appear',
	'fadeIn',
	'flyIn',
	'zoomIn',
	'bounceIn',
	'wipeIn',
	'splitIn',
	'dissolveIn',
	'wheelIn',
	'blindsIn',
	'boxIn',
	'floatIn',
	'riseUp',
	'swivel',
	'expandIn',
	'checkerboardIn',
	'flashIn',
	'peekIn',
	'randomBarsIn',
	'spinnerIn',
	'growTurnIn',
	// Exit
	'fadeOut',
	'flyOut',
	'zoomOut',
	'bounceOut',
	'wipeOut',
	'shrinkOut',
	'dissolveOut',
	'disappear',
	// Emphasis
	'spin',
	'pulse',
	'colorWave',
	'bounce',
	'flash',
	'growShrink',
	'teeter',
	'transparency',
	'boldFlash',
	'wave',
];

/**
 * The i18n key naming an editor preset token, shared by every binding's ribbon
 * gallery, inspector select and timeline row.
 */
export function animationPresetLabelKey(preset: string): string {
	return `pptx.animation.preset.${preset}`;
}

/**
 * Fold a catalogue preset id into one dictionary-key segment:
 * `entr.1` -> `entr1`, `path.line.upLeft` -> `pathLineUpLeft`.
 *
 * Deterministic and collision-free across the whole catalogue, so the key can
 * be derived at the call site instead of stored per preset.
 */
export function animationCatalogPresetSlug(presetId: string): string {
	return presetId
		.split('.')
		.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
		.join('');
}

/** The i18n key naming an OOXML catalogue preset (`entr.1`, `path.line.up`, ...). */
export function animationCatalogPresetLabelKey(presetId: string): string {
	return `pptx.animation.catalogPreset.${animationCatalogPresetSlug(presetId)}`;
}

/**
 * `true` when `token` is a catalogue id (`entr.1`) rather than an editor preset
 * (`fadeIn`). The two vocabularies are told apart by the dot, which no
 * `PptxAnimationPreset` value contains.
 */
export function isAnimationCatalogPresetId(token: string): boolean {
	return token.includes('.');
}

/**
 * The i18n key naming whatever effect an animation carries, whichever
 * vocabulary its token came from. An entry with no preset resolves to "Motion
 * Path" when it only carries a path, and to the generic "Animation" otherwise
 * (which is what the bindings used to spell as the literal word `custom`).
 *
 * Always a key, never `undefined`, because Angular renders these through the
 * `translate` pipe: resolving finished text in a component getter would freeze
 * an `OnPush` view's wording at whatever language was active when it last
 * rendered.
 */
export function animationEffectLabelKey(anim: PptxElementAnimation): string {
	const token = anim.entrance ?? anim.emphasis ?? anim.exit;
	if (!token || token === 'none') {
		return anim.motionPath ? 'pptx.animation.motionPath.label' : 'pptx.animation.animation';
	}
	return isAnimationCatalogPresetId(token)
		? animationCatalogPresetLabelKey(token)
		: animationPresetLabelKey(token);
}

/**
 * The display name for an animation's effect.
 *
 * This is the single resolver every binding's timeline and effect chip calls,
 * so all five spell the same animation the same way.
 */
export function animationEffectLabel(
	anim: PptxElementAnimation,
	translate: AnimationLabelTranslate,
): string {
	return translate(animationEffectLabelKey(anim));
}
