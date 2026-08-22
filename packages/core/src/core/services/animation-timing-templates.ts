/**
 * Typed modelling for a TEXT `p:bldP`'s `p:tmplLst` (CT_TLTemplateList,
 * ECMA-376 §19.5.84) and its `p:tmpl` entries (CT_TLTemplate, §19.5.85).
 *
 * `p:tmpl` carries an `@lvl` attribute and a required `p:tnLst` child: a
 * per-build-level timing default PowerPoint clones when a new outline level
 * needs animation. See {@link PptxTimingTemplate} for why the nested
 * `p:tnLst` is preserved verbatim rather than deep-parsed, and why this
 * stops at typed round-trip rather than feeding playback.
 *
 * @module services/animation-timing-templates
 */
import type { PptxTimingTemplate, XmlObject } from '../types';

function ensureArray(value: unknown): XmlObject[] {
	if (!value) {
		return [];
	}
	if (!Array.isArray(value)) {
		return isXmlObject(value) ? [value] : [];
	}
	return value.filter((entry): entry is XmlObject => isXmlObject(entry));
}

function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse `p:tmplLst/p:tmpl` entries off a TEXT `p:bldP` node.
 *
 * A template with no `p:tnLst` child is dropped: ECMA-376 requires it, and
 * a template without one carries nothing to preserve or clone from.
 */
export function extractBldPTemplates(bldP: XmlObject): PptxTimingTemplate[] {
	const tmplLst = bldP['p:tmplLst'] as XmlObject | undefined;
	if (!tmplLst) {
		return [];
	}

	const result: PptxTimingTemplate[] = [];
	for (const tmpl of ensureArray(tmplLst['p:tmpl'])) {
		const tnLst = tmpl['p:tnLst'] as XmlObject | undefined;
		if (!tnLst) {
			continue;
		}
		const levelRaw = tmpl['@_lvl'];
		const level = levelRaw !== undefined ? Number.parseInt(String(levelRaw), 10) : 0;
		result.push({
			level: Number.isFinite(level) ? level : 0,
			timeNodeList: tnLst,
			rawXml: tmpl,
		});
	}
	return result;
}

/**
 * Serialize {@link PptxTimingTemplate} entries back into a `p:tmplLst`
 * XmlObject, spreading each entry's preserved `rawXml` first so unmodelled
 * attributes/children on `p:tmpl` survive.
 *
 * Not wired into the active OOXML writer: the surgical timing writer
 * (`animation-timing-surgical.ts`) clones and never touches `p:bldLst`, so
 * an existing `p:tmplLst` already round-trips byte-identically through that
 * path. This serializer exists for typed-model completeness and testing,
 * mirroring `serializeGraphicBuild` in `animation-target-build-helpers.ts`.
 */
export function serializeBldPTemplates(templates: PptxTimingTemplate[]): XmlObject | undefined {
	if (templates.length === 0) {
		return undefined;
	}

	const tmplNodes: XmlObject[] = templates.map((entry) => ({
		...(entry.rawXml ?? {}),
		'@_lvl': String(entry.level),
		'p:tnLst': entry.timeNodeList,
	}));

	return { 'p:tmpl': tmplNodes.length === 1 ? tmplNodes[0] : tmplNodes };
}
