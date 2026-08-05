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
import { PptxXmlLookupService } from './PptxXmlLookupService';

/** Stateless default lookup for callers without an injected service. */
const defaultLookup: IPptxXmlLookupService = new PptxXmlLookupService();

/**
 * Resolve a slide root's `p:timing` tree, whether it sits directly on
 * `p:sld` or (PowerPoint 2010+ timing features) inside a slide-root
 * `mc:AlternateContent` envelope. READ-side only: save-side round-trip
 * keeps re-emitting the preserved envelope verbatim, so the enveloped
 * timing must NOT additionally be written as a direct child.
 */
export function resolveSlideTimingNode(slideRoot: XmlObject | undefined): XmlObject | undefined {
	const direct = slideRoot?.['p:timing'];
	if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
		return direct as XmlObject;
	}
	return findEnvelopeChildByLocalName(slideRoot, 'timing', defaultLookup);
}

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
	return findEnvelopeChildByLocalName(slideRoot, 'transition', lookup);
}

/**
 * Locate a named element inside the slide-root `mc:AlternateContent`
 * envelope(s), following the MCE semantics documented on
 * {@link findTransitionInAlternateContent}.
 *
 * A slide can carry SEVERAL sibling envelopes (the issue #132 deck wraps
 * `p:transition` and `p:timing` in two separate ones), which the XML parser
 * surfaces as an array; each envelope is scanned independently and the first
 * one containing the requested element decides.
 */
export function findEnvelopeChildByLocalName(
	slideRoot: XmlObject | undefined,
	localName: string,
	lookup: IPptxXmlLookupService,
): XmlObject | undefined {
	for (const envelope of lookup.getChildrenArrayByLocalName(slideRoot, 'AlternateContent')) {
		let unsupportedChoiceNode: XmlObject | undefined;
		for (const choice of lookup.getChildrenArrayByLocalName(envelope, 'Choice')) {
			const node = lookup.getChildByLocalName(choice, localName);
			if (!node) {
				continue;
			}
			if (isAlternateContentChoiceSupported(choice)) {
				return node;
			}
			unsupportedChoiceNode ??= node;
		}
		const fallbackNode = lookup.getChildByLocalName(
			lookup.getChildByLocalName(envelope, 'Fallback'),
			localName,
		);
		const found = fallbackNode ?? unsupportedChoiceNode;
		if (found) {
			return found;
		}
	}
	return undefined;
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
