/**
 * Merge a deck's own per-build-level timing default (`p:bldP/p:tmplLst`,
 * already decomposed onto `PptxNativeAnimation.buildTemplates` by
 * `applyBuildList` in `native-animation-helpers.ts`) onto the matching
 * editor animation entry, when the editor entry does not already carry one.
 *
 * Mirrors `mergeNativeSoundIntoEditorAnimations` (`animation-sound-merge.ts`):
 * an element the user has never touched loses nothing by omission (the
 * surgical writer clones the whole `p:timing` tree, `p:bldLst` included, so
 * an untouched `p:tmplLst` already round-trips byte-identically), but if the
 * SLIDE has no prior `p:timing` at all (e.g. every effect on it was just
 * added via the SDK to a shape that also carries a loaded `buildTemplates`
 * from elsewhere), the full-rebuild writer (`buildBuildListXml`) would
 * otherwise see an `undefined` `buildTemplates` and silently drop it. This
 * merge, run once at load time right after `reconcileAnimationTargets` (so
 * both lists already share `element.id`), closes that gap.
 *
 * @module services/animation-build-template-merge
 */
import type { PptxElementAnimation, PptxNativeAnimation } from '../types';

export function mergeNativeBuildTemplatesIntoEditorAnimations(
	nativeAnimations: readonly PptxNativeAnimation[] | undefined,
	editorAnimations: readonly PptxElementAnimation[] | undefined,
): void {
	if (!nativeAnimations || !editorAnimations || editorAnimations.length === 0) {
		return;
	}

	const templatesByElement = new Map<string, PptxNativeAnimation['buildTemplates']>();
	for (const nativeAnim of nativeAnimations) {
		if (!nativeAnim.targetId || templatesByElement.has(nativeAnim.targetId)) {
			continue;
		}
		if (nativeAnim.buildTemplates && nativeAnim.buildTemplates.length > 0) {
			templatesByElement.set(nativeAnim.targetId, nativeAnim.buildTemplates);
		}
	}
	if (templatesByElement.size === 0) {
		return;
	}

	for (const editorAnim of editorAnimations) {
		if (editorAnim.buildTemplates !== undefined) {
			continue;
		}
		const nativeTemplates = templatesByElement.get(editorAnim.elementId);
		if (!nativeTemplates) {
			continue;
		}
		editorAnim.buildTemplates = nativeTemplates;
	}
}
