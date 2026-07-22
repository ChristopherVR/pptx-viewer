import type { XmlObject, PptxActiveXControl } from '../types';

/** EMU per CSS pixel (matches the runtime's EMU_PER_PX). */
const EMU_PER_PX = 9525;

function ensureArray(val: unknown): XmlObject[] {
	if (val === undefined || val === null) {
		return [];
	}
	return Array.isArray(val) ? val : [val as XmlObject];
}

/**
 * Collect `p:control` nodes from a `p:controls` container, tolerating the
 * `mc:AlternateContent` wrapping PowerPoint emits (a `mc:Choice Requires="v"`
 * carrying the live control and a `mc:Fallback` carrying the same control
 * with a static `p:pic` preview). Direct `p:control` children are also read.
 */
function collectControlNodes(controls: XmlObject): XmlObject[] {
	const nodes: XmlObject[] = [...ensureArray(controls['p:control'])];
	const altContents = ensureArray(controls['mc:AlternateContent']);
	for (const alt of altContents) {
		const fallback = alt['mc:Fallback'] as XmlObject | undefined;
		const fallbackControls = fallback ? ensureArray(fallback['p:control']) : [];
		if (fallbackControls.length > 0) {
			nodes.push(...fallbackControls);
			continue;
		}
		// No fallback control: fall back to the choice branch so at least the
		// relId/name/spid are captured (there just won't be a preview picture).
		const choices = ensureArray(alt['mc:Choice']);
		for (const choice of choices) {
			nodes.push(...ensureArray(choice['p:control']));
		}
	}
	return nodes;
}

/** Read a numeric attribute, returning undefined when absent or non-finite. */
function numAttr(node: XmlObject | undefined, key: string): number | undefined {
	if (!node) {
		return undefined;
	}
	const raw = node[key];
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const n = Number(raw);
	return Number.isFinite(n) ? n : undefined;
}

/**
 * Extract the geometry (px) and static-preview relationship id from a
 * `p:control`'s embedded `p:pic` fallback, when present.
 */
function extractControlFallback(control: XmlObject): {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	fallbackImageRelId?: string;
} {
	const pic = control['p:pic'] as XmlObject | undefined;
	if (!pic) {
		return {};
	}

	const spPr = pic['p:spPr'] as XmlObject | undefined;
	const xfrm = spPr?.['a:xfrm'] as XmlObject | undefined;
	const off = xfrm?.['a:off'] as XmlObject | undefined;
	const ext = xfrm?.['a:ext'] as XmlObject | undefined;

	const offX = numAttr(off, '@_x');
	const offY = numAttr(off, '@_y');
	const extCx = numAttr(ext, '@_cx');
	const extCy = numAttr(ext, '@_cy');

	const blipFill = pic['p:blipFill'] as XmlObject | undefined;
	const blip = blipFill?.['a:blip'] as XmlObject | undefined;
	const embed = blip ? String(blip['@_r:embed'] ?? '').trim() : '';

	return {
		x: offX !== undefined ? offX / EMU_PER_PX : undefined,
		y: offY !== undefined ? offY / EMU_PER_PX : undefined,
		width: extCx !== undefined ? extCx / EMU_PER_PX : undefined,
		height: extCy !== undefined ? extCy / EMU_PER_PX : undefined,
		fallbackImageRelId: embed.length > 0 ? embed : undefined,
	};
}

/**
 * Parse `p:controls > p:control` entries from a slide XML object.
 * Extracted from PptxHandlerRuntimeDocProperties for testability.
 */
export function parseActiveXControlsFromSlide(slideXml: XmlObject): PptxActiveXControl[] {
	try {
		const sld = slideXml['p:sld'] as XmlObject | undefined;
		const cSld = sld?.['p:cSld'] as XmlObject | undefined;
		if (!cSld) {
			return [];
		}

		const controls = cSld['p:controls'] as XmlObject | undefined;
		if (!controls) {
			return [];
		}

		const controlEntries = collectControlNodes(controls);
		if (controlEntries.length === 0) {
			return [];
		}

		const results: PptxActiveXControl[] = [];
		const seen = new Set<string>();
		for (const entry of controlEntries) {
			const relId = String(entry['@_r:id'] || '').trim();
			if (!relId) {
				continue;
			}

			const name = entry['@_name'] ? String(entry['@_name']).trim() : undefined;
			const shapeId = entry['@_spid'] ? String(entry['@_spid']).trim() : undefined;
			const fallback = extractControlFallback(entry);

			// Dedupe controls that appear in both the choice and fallback branches;
			// prefer the entry that carries geometry / a preview picture.
			const key = `${relId}|${shapeId ?? ''}`;
			if (seen.has(key)) {
				if (fallback.fallbackImageRelId === undefined && fallback.x === undefined) {
					continue;
				}
				const existingIndex = results.findIndex((c) => `${c.relId}|${c.shapeId ?? ''}` === key);
				if (existingIndex >= 0) {
					results[existingIndex] = { relId, name, shapeId, ...fallback, rawXml: entry };
					continue;
				}
			}
			seen.add(key);

			results.push({ relId, name, shapeId, ...fallback, rawXml: entry });
		}
		return results;
	} catch (e) {
		console.warn('Failed to parse slide ActiveX controls:', e);
		return [];
	}
}
