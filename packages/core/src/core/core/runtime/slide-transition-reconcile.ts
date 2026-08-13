/**
 * slide-transition-reconcile: write a slide's `p:transition` back to the ONE
 * place it came from.
 *
 * `CT_Slide` (S19.3.1.38) declares `p:transition` with `maxOccurs="1"`, in the
 * sequence `p:cSld, p:clrMapOvr, p:transition, p:timing, p:extLst`. PowerPoint
 * 2010+ does not always write it as a direct child: whenever the transition
 * carries an extension-namespace attribute or child (`p14:dur`, `p14:reveal`,
 * `p15:prstTrans`, `p159:morph`) it wraps the whole element in a slide-root
 * `mc:AlternateContent` envelope - an `mc:Choice Requires="p14"` branch with
 * the rich transition plus an `mc:Fallback` branch with a plain one.
 *
 * The loader reads the transition THROUGH that envelope
 * (`slide-transition-envelope.ts`), so a naive save that assigns
 * `slideNode['p:transition']` leaves the envelope untouched and emits the
 * transition a second (and, counting the Fallback, third) time - appended
 * after `p:timing`, so out of schema sequence as well. Reconciling here keeps
 * exactly one authored transition: an enveloped one is updated IN PLACE inside
 * the branch it was read from (the sibling Fallback and the envelope's
 * `@Requires`/namespace declarations survive verbatim), and a transition that
 * did not come from an envelope is written as the direct child while any stale
 * enveloped copy is removed.
 */
import type { XmlObject } from '../../types';

/** A `p:transition` sitting inside one branch of an `mc:AlternateContent`. */
interface EnvelopeTransitionSlot {
	/** The `mc:AlternateContent` object that owns the branch. */
	envelope: XmlObject;
	/** The `mc:Choice` / `mc:Fallback` object that owns the transition key. */
	branch: XmlObject;
	/** The branch key the transition is stored under (namespace prefix intact). */
	key: string;
	/** The parsed transition node itself. */
	node: XmlObject;
}

/** Inputs for {@link reconcileSlideTransition}. */
export interface SlideTransitionReconcileOptions {
	/** The `p:sld` root node being written. */
	slideNode: XmlObject;
	/** Freshly serialized transition, or `undefined` to remove the transition. */
	transitionNode: XmlObject | undefined;
	/** Node the transition was parsed from (`PptxSlideTransition.rawTransition`). */
	sourceNode: XmlObject | undefined;
	/** Local-name extractor for namespaced XML keys. */
	getLocalName: (key: string) => string;
}

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObjects(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter(isXmlObject);
	}
	return isXmlObject(value) ? [value] : [];
}

function keysWithLocalName(
	node: XmlObject,
	localName: string,
	getLocalName: (key: string) => string,
): string[] {
	return Object.keys(node).filter(
		(key) => !key.startsWith('@_') && getLocalName(key) === localName,
	);
}

/** Every `p:transition` reachable through a slide-root MCE envelope. */
function collectEnvelopeSlots(
	slideNode: XmlObject,
	getLocalName: (key: string) => string,
): EnvelopeTransitionSlot[] {
	const slots: EnvelopeTransitionSlot[] = [];
	for (const envelopeKey of keysWithLocalName(slideNode, 'AlternateContent', getLocalName)) {
		for (const envelope of asObjects(slideNode[envelopeKey])) {
			const branchKeys = [
				...keysWithLocalName(envelope, 'Choice', getLocalName),
				...keysWithLocalName(envelope, 'Fallback', getLocalName),
			];
			for (const branchKey of branchKeys) {
				for (const branch of asObjects(envelope[branchKey])) {
					for (const key of keysWithLocalName(branch, 'transition', getLocalName)) {
						for (const node of asObjects(branch[key])) {
							slots.push({ envelope, branch, key, node });
						}
					}
				}
			}
		}
	}
	return slots;
}

/**
 * Re-key the rebuilt transition's `@dur` back to the extension-namespace
 * spelling the source branch used.
 *
 * `CT_SlideTransition` has no `dur` attribute: the sub-second duration is
 * `p14:dur`, which is exactly why PowerPoint wrapped the element in an
 * `mc:Choice Requires="p14"` in the first place. The typed model flattens both
 * spellings into `durationMs`, so writing the rebuilt node into a p14 branch
 * verbatim would smuggle an unknown attribute into it. The rename is done
 * positionally so the attribute keeps its original slot.
 */
function preserveNamespacedDuration(source: XmlObject, rebuilt: XmlObject): XmlObject {
	const namespaced = Object.keys(source).find(
		(key) => key.startsWith('@_') && key !== '@_dur' && key.endsWith(':dur'),
	);
	if (!namespaced || rebuilt['@_dur'] === undefined || rebuilt[namespaced] !== undefined) {
		return rebuilt;
	}
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(rebuilt)) {
		result[key === '@_dur' ? namespaced : key] = value;
	}
	return result;
}

/** Whether an MCE branch still declares any element child. */
function branchHasElements(branch: XmlObject): boolean {
	return Object.keys(branch).some((key) => !key.startsWith('@_'));
}

/** Drop envelopes whose every branch went empty once its transition was removed. */
function pruneEmptyEnvelopes(slideNode: XmlObject, getLocalName: (key: string) => string): void {
	for (const envelopeKey of keysWithLocalName(slideNode, 'AlternateContent', getLocalName)) {
		const kept = asObjects(slideNode[envelopeKey]).filter((envelope) => {
			const branches = [
				...keysWithLocalName(envelope, 'Choice', getLocalName),
				...keysWithLocalName(envelope, 'Fallback', getLocalName),
			].flatMap((branchKey) => asObjects(envelope[branchKey]));
			return branches.length === 0 || branches.some(branchHasElements);
		});
		if (kept.length === 0) {
			delete slideNode[envelopeKey];
		} else {
			slideNode[envelopeKey] = kept.length === 1 ? kept[0]! : kept;
		}
	}
}

/**
 * Write `transitionNode` to the single place the slide's transition belongs,
 * removing every other copy. See the module docblock for the rules.
 */
export function reconcileSlideTransition(options: SlideTransitionReconcileOptions): void {
	const { slideNode, transitionNode, sourceNode, getLocalName } = options;
	const slots = collectEnvelopeSlots(slideNode, getLocalName);
	const target = sourceNode ? slots.find((slot) => slot.node === sourceNode) : undefined;

	// The direct child is re-added below only when the transition did not come
	// out of an envelope; clearing it first also removes a stale direct copy
	// left behind by an earlier save of the same in-memory slide.
	for (const key of keysWithLocalName(slideNode, 'transition', getLocalName)) {
		delete slideNode[key];
	}

	// The envelope the transition was read from survives whole (its sibling
	// `mc:Fallback` is a legacy-reader branch, not a duplicate declaration);
	// only the branch we read from is rewritten. Every OTHER enveloped copy is
	// stripped, and a "none" transition strips them all - including that sibling
	// Fallback, or the envelope would keep replaying the effect we removed.
	const keptEnvelope = transitionNode ? target?.envelope : undefined;
	for (const slot of slots) {
		if (slot.envelope !== keptEnvelope) {
			delete slot.branch[slot.key];
		}
	}
	if (target && transitionNode) {
		target.branch[target.key] = preserveNamespacedDuration(target.node, transitionNode);
	}
	pruneEmptyEnvelopes(slideNode, getLocalName);

	if (transitionNode && !keptEnvelope) {
		slideNode['p:transition'] = transitionNode;
	}
}
