/**
 * slide-timing-reconcile: write a slide's `p:timing` back to exactly one place.
 *
 * PowerPoint 2010+ wraps `p:timing` in a slide-root `mc:AlternateContent`
 * envelope whenever the tree uses p14 markup (a media-bookmark trigger's
 * `p14:bmkTgt`, COM-verified): an `mc:Choice Requires="p14"` branch carries
 * the full tree and an `mc:Fallback` branch the same tree with every p14
 * construct left out. The loader reads the timing THROUGH that envelope
 * (`resolveSlideTimingNode`), so assigning `slideNode['p:timing']` on save left
 * the envelope in place and emitted the timing three times.
 *
 * Rules:
 *  - An unchanged enveloped tree (`timingNode === sourceNode`) keeps its
 *    envelope verbatim, Fallback included.
 *  - Otherwise every existing copy is removed and the new tree is written once:
 *    enveloped (Choice = the tree, Fallback = the tree without p14 markup) when
 *    it uses p14, else as the direct child. A p14 element written as a direct
 *    child makes PowerPoint refuse the file (see
 *    `slide-transition-envelope-build`), so the envelope is not optional.
 *
 * @module core/runtime/slide-timing-reconcile
 */
import type { XmlObject } from '../../types';
import { stripP14FromTiming, timingUsesP14 } from './slide-timing-p14';
import { EXTENSION_NAMESPACE_URIS, MCE_NAMESPACE_URI } from './slide-transition-envelope-build';

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObjects(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter(isXmlObject);
	}
	return isXmlObject(value) ? [value] : [];
}

function keysNamed(
	node: XmlObject,
	localName: string,
	getLocalName: (key: string) => string,
): string[] {
	return Object.keys(node).filter(
		(key) => !key.startsWith('@_') && getLocalName(key) === localName,
	);
}

/** `mc:Choice` and `mc:Fallback` objects of an envelope. */
function branchesOf(envelope: XmlObject, getLocalName: (key: string) => string): XmlObject[] {
	return [
		...keysNamed(envelope, 'Choice', getLocalName),
		...keysNamed(envelope, 'Fallback', getLocalName),
	].flatMap((key) => asObjects(envelope[key]));
}

/** Inputs for {@link reconcileSlideTiming}. */
export interface SlideTimingReconcileOptions {
	/** The `p:sld` root node being written. */
	slideNode: XmlObject;
	/** The timing tree to write, or `undefined` for none. */
	timingNode: XmlObject | undefined;
	/** The node the slide's timing was parsed from (`PptxSlide.rawTiming`). */
	sourceNode: XmlObject | undefined;
	/** Local-name extractor for namespaced XML keys. */
	getLocalName: (key: string) => string;
}

/** Write `timingNode` to the one place it belongs; see the module doc. */
export function reconcileSlideTiming(options: SlideTimingReconcileOptions): void {
	const { slideNode, timingNode, sourceNode, getLocalName } = options;
	for (const key of keysNamed(slideNode, 'timing', getLocalName)) {
		delete slideNode[key];
	}

	let keptSource = false;
	for (const envelopeKey of keysNamed(slideNode, 'AlternateContent', getLocalName)) {
		const kept: XmlObject[] = [];
		for (const envelope of asObjects(slideNode[envelopeKey])) {
			const branches = branchesOf(envelope, getLocalName);
			const timingKeys = branches.flatMap((branch) =>
				keysNamed(branch, 'timing', getLocalName).map((key) => ({ branch, key })),
			);
			if (timingKeys.length === 0) {
				kept.push(envelope);
				continue;
			}
			const holdsSource = timingKeys.some(({ branch, key }) => branch[key] === sourceNode);
			if (timingNode !== undefined && timingNode === sourceNode && holdsSource) {
				keptSource = true;
				kept.push(envelope);
				continue;
			}
			for (const { branch, key } of timingKeys) {
				delete branch[key];
			}
			if (branches.some((branch) => Object.keys(branch).some((k) => !k.startsWith('@_')))) {
				kept.push(envelope);
			}
		}
		if (kept.length === 0) {
			delete slideNode[envelopeKey];
		} else {
			slideNode[envelopeKey] = kept.length === 1 ? kept[0]! : kept;
		}
	}

	if (!timingNode || keptSource) {
		return;
	}
	if (timingUsesP14(timingNode)) {
		appendEnvelope(slideNode, buildTimingEnvelope(timingNode), getLocalName);
	} else {
		slideNode['p:timing'] = timingNode;
	}
	moveToEnd(slideNode, 'extLst', getLocalName);
}

/** `mc:AlternateContent` around a p14 timing tree, PowerPoint's own shape. */
function buildTimingEnvelope(timingNode: XmlObject): XmlObject {
	return {
		'@_xmlns:mc': MCE_NAMESPACE_URI,
		'mc:Choice': {
			'@_xmlns:p14': EXTENSION_NAMESPACE_URIS.p14,
			'@_Requires': 'p14',
			'p:timing': timingNode,
		},
		'mc:Fallback': { 'p:timing': stripP14FromTiming(timingNode) },
	};
}

/** Add an envelope after any existing slide-root envelopes (e.g. a transition's). */
function appendEnvelope(
	slideNode: XmlObject,
	envelope: XmlObject,
	getLocalName: (key: string) => string,
): void {
	const key = keysNamed(slideNode, 'AlternateContent', getLocalName)[0] ?? 'mc:AlternateContent';
	const existing = asObjects(slideNode[key]);
	slideNode[key] = existing.length === 0 ? envelope : [...existing, envelope];
}

/** Re-insert a key so `fast-xml-parser` emits it last (schema order). */
function moveToEnd(
	slideNode: XmlObject,
	localName: string,
	getLocalName: (key: string) => string,
): void {
	for (const key of keysNamed(slideNode, localName, getLocalName)) {
		const value = slideNode[key];
		delete slideNode[key];
		slideNode[key] = value;
	}
}
