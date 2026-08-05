/**
 * Helpers for the slide-root `mc:AlternateContent` (Markup Compatibility)
 * envelope around `p:transition`, and for extension-namespace transition
 * elements (p14/p15) written DIRECTLY on `p:transition` in the `mc:Choice`
 * form.
 */
import type { XmlObject } from '../types';
import { isAlternateContentChoiceSupported } from '../utils/mc-capabilities';
import { P14_TRANSITION_TYPES } from './p14-transition-parser';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

/**
 * Locate a `<p:transition>` wrapped in a slide-root `mc:AlternateContent`
 * envelope.
 *
 * Real PowerPoint (verified via COM-authored fixtures) wraps the
 * transition in `mc:AlternateContent` whenever it carries an Office
 * 2010+ attribute such as `p14:dur` (sub-second transition duration):
 * an `mc:Choice Requires="p14"` branch carries the richer transition,
 * and `mc:Fallback` carries a plain one for older readers. Without this
 * unwrap, `p:sld`'s direct-child lookup for `transition` finds nothing
 * and the whole transition (including plain ones falling back with no
 * p14 data) is silently dropped, even though `mc:Choice` is otherwise a
 * complete, directly usable `p:transition` node.
 *
 * Choice selection follows MCE semantics: the first SUPPORTED `mc:Choice`
 * wins; an unsupported Choice yields to `mc:Fallback`. Only when there is
 * no fallback at all do we keep the historical permissive behavior of
 * reading an unsupported choice's transition anyway (it is still a
 * well-formed `p:transition`).
 */
export function findTransitionInAlternateContent(
	slideRoot: XmlObject | undefined,
	lookup: IPptxXmlLookupService,
): XmlObject | undefined {
	const altContent = lookup.getChildByLocalName(slideRoot, 'AlternateContent');
	if (!altContent) {
		return undefined;
	}
	const choices = lookup.getChildrenArrayByLocalName(altContent, 'Choice');
	let unsupportedChoiceTransition: XmlObject | undefined;
	for (const choice of choices) {
		const transitionNode = lookup.getChildByLocalName(choice, 'transition');
		if (!transitionNode) {
			continue;
		}
		if (isAlternateContentChoiceSupported(choice)) {
			return transitionNode;
		}
		unsupportedChoiceTransition ??= transitionNode;
	}
	const fallback = lookup.getChildByLocalName(altContent, 'Fallback');
	const fallbackTransition = lookup.getChildByLocalName(fallback, 'transition');
	return fallbackTransition ?? unsupportedChoiceTransition;
}

/**
 * Key of a preserved direct child whose local name is the given p14
 * transition type (e.g. `p14:reveal` for type `reveal`), if present.
 */
export function preservedP14ChildKey(
	node: XmlObject,
	transitionType: string,
	getXmlLocalName: (xmlKey: string) => string,
): string | undefined {
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_') && getXmlLocalName(key) === transitionType) {
			return key;
		}
	}
	return undefined;
}

/**
 * Key of a preserved direct `p15:prstTrans` child whose `@prst` matches
 * the given preset name, if present.
 */
export function preservedP15ChildKey(
	node: XmlObject,
	transitionType: string,
	getXmlLocalName: (xmlKey: string) => string,
): string | undefined {
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || getXmlLocalName(key) !== 'prstTrans') {
			continue;
		}
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		if (String((value as XmlObject)['@_prst'] || '').trim() === transitionType) {
			return key;
		}
	}
	return undefined;
}

/**
 * Remove preserved direct p14/p15 extension children that no longer match
 * the transition being serialized (keeping at most `keepKey`). Without
 * this, editing e.g. an `origami` slide into a `fade` would keep the stale
 * `p15:prstTrans` child alongside the new `p:fade` and declare two
 * transitions in one `p:transition`.
 */
export function pruneDirectExtensionChildren(
	node: XmlObject,
	getXmlLocalName: (xmlKey: string) => string,
	keepKey?: string,
): void {
	for (const key of Object.keys(node)) {
		if (key === keepKey || key.startsWith('@_')) {
			continue;
		}
		const localName = getXmlLocalName(key);
		if (P14_TRANSITION_TYPES.has(localName) || localName === 'prstTrans') {
			delete node[key];
		}
	}
}
