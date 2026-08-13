import { EMU_PER_PX } from '../constants';
import type { PptxElement, XmlObject } from '../types';
import type { PlaceholderIdentity } from './placeholder-remap';

/**
 * Raw-XML edits and element factories shared by layout switching.
 *
 * These are plain functions rather than runtime methods so they can be tested
 * against real `p:sp` fragments without standing up the whole mixin chain.
 *
 * @module placeholder-xml
 */

/**
 * Find the `p:nvPr` of a shape, picture or graphic frame.
 *
 * @returns The node, or `undefined` for elements that carry no non-visual
 *   properties (connectors written by some importers, for instance).
 */
export function findNonVisualProps(rawXml: XmlObject): XmlObject | undefined {
	for (const container of ['p:nvSpPr', 'p:nvPicPr', 'p:nvGraphicFramePr'] as const) {
		const parent = rawXml[container] as XmlObject | undefined;
		const nvPr = parent?.['p:nvPr'] as XmlObject | undefined;
		if (nvPr) {
			return nvPr;
		}
	}
	return undefined;
}

/**
 * Point an element's `p:ph` at a different placeholder slot.
 *
 * Called after layout switching moves an element into a new slot: without it
 * the saved deck still claims the old `type`/`idx`, which the target layout
 * may not define at all, and inheritance then resolves against the wrong
 * entry when the file is reopened.
 *
 * @param rawXml - The element's raw XML. Mutated in place, so pass a clone
 *   when the original is still referenced by undo history.
 * @param target - Identity of the slot the element now occupies.
 */
export function retargetPlaceholder(rawXml: XmlObject, target: PlaceholderIdentity): void {
	const nvPr = findNonVisualProps(rawXml);
	if (!nvPr) {
		return;
	}

	const ph = (nvPr['p:ph'] as XmlObject | undefined) ?? {};
	nvPr['p:ph'] = ph;

	// `type` is optional and defaults to `body`; omitting the attribute is how
	// PowerPoint spells a body placeholder, so clear it rather than writing the
	// literal string when the destination left it out.
	if (target.type) {
		ph['@_type'] = target.type;
	} else {
		delete ph['@_type'];
	}
	if (target.idx !== undefined) {
		ph['@_idx'] = target.idx;
	} else {
		delete ph['@_idx'];
	}
}

/**
 * Write a transform into an element's `p:spPr/a:xfrm`, creating the
 * intermediate nodes when the shape had no explicit transform.
 *
 * @param rawXml - The element's raw XML, mutated in place.
 */
export function setRawXmlTransform(
	rawXml: XmlObject,
	xEmu: number,
	yEmu: number,
	cxEmu: number,
	cyEmu: number,
): void {
	const spPr = rawXml['p:spPr'] as XmlObject | undefined;
	if (!spPr) {
		return;
	}

	const xfrm = (spPr['a:xfrm'] as XmlObject | undefined) ?? {};
	spPr['a:xfrm'] = xfrm;

	const off = (xfrm['a:off'] as XmlObject | undefined) ?? {};
	xfrm['a:off'] = off;
	off['@_x'] = String(xEmu);
	off['@_y'] = String(yEmu);

	const ext = (xfrm['a:ext'] as XmlObject | undefined) ?? {};
	xfrm['a:ext'] = ext;
	ext['@_cx'] = String(cxEmu);
	ext['@_cy'] = String(cyEmu);
}

/**
 * Build an empty text element standing in for a placeholder the new layout
 * defines but the slide has no content for.
 *
 * The element carries a `p:ph` binding so the save pipeline keeps it attached
 * to the layout slot and inherits its prompt text and styling.
 *
 * @param uniqueId - Caller-supplied suffix that keeps generated shape ids
 *   distinct. Injected rather than derived from a clock so the result is
 *   reproducible in tests.
 * @returns The element, or `null` when the slot has no usable size.
 */
export function createEmptyPlaceholderElement(
	target: PlaceholderIdentity,
	xEmu: number,
	yEmu: number,
	cxEmu: number,
	cyEmu: number,
	uniqueId: string,
): PptxElement | null {
	if (cxEmu <= 0 || cyEmu <= 0) {
		return null;
	}

	const phNode: XmlObject = {};
	if (target.type) {
		phNode['@_type'] = target.type;
	}
	if (target.idx !== undefined) {
		phNode['@_idx'] = target.idx;
	}

	const rawXml: XmlObject = {
		'p:nvSpPr': {
			'p:cNvPr': {
				'@_id': uniqueId,
				'@_name': `Placeholder ${target.type || 'content'}`,
			},
			'p:cNvSpPr': {
				'a:spLocks': { '@_noGrp': '1' },
			},
			'p:nvPr': {
				'p:ph': phNode,
			},
		},
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': String(xEmu), '@_y': String(yEmu) },
				'a:ext': { '@_cx': String(cxEmu), '@_cy': String(cyEmu) },
			},
		},
		'p:txBody': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': { 'a:endParaRPr': { '@_lang': 'en-US' } },
		},
	};

	return {
		type: 'text',
		id: `ph-${target.type || 'content'}-${target.idx ?? '0'}-${uniqueId}`,
		x: Math.round(xEmu / EMU_PER_PX),
		y: Math.round(yEmu / EMU_PER_PX),
		width: Math.round(cxEmu / EMU_PER_PX),
		height: Math.round(cyEmu / EMU_PER_PX),
		text: '',
		rawXml,
	};
}
