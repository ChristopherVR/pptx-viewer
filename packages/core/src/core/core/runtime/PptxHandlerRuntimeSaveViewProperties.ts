/**
 * @fileoverview Save-side writers for `ppt/viewProps.xml` and
 * `ppt/tableStyles.xml`.
 *
 * Both parts are typically passed through verbatim during save. These
 * writers wire up the typed save options so user/UI edits to grid,
 * snap, view scale, last-view, and table-style fills/text actually
 * persist back to the on-disk PPTX rather than being silently dropped.
 *
 * - {@link applyViewPropertiesPart} resolves the viewProps part path
 *   from `presentation.xml.rels`, falls back to `ppt/viewProps.xml`
 *   when the relationship lookup fails, and skips the write entirely
 *   when the source archive has no viewProps part.
 *
 * - {@link applyTableStylesPart} merges the typed
 *   {@link ParsedTableStyleMap} edits onto the existing
 *   `<a:tblStyleLst>` XML so unmodelled fields and the `def` attribute
 *   round-trip losslessly. When the source archive has no
 *   `ppt/tableStyles.xml`, the writer is a no-op.
 */

import type {
	XmlObject,
	PptxViewProperties,
	ParsedTableStyleMap,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleText,
} from '../../types';
import { safeResolveZipPath } from '../../utils/safe-path';
import { buildViewPropertiesXml } from './pptx-view-props-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutMaster';

/** Section keys on `a:tblStyle` whose fills round-trip through the typed map. */
const FILL_SECTIONS: Array<{ xmlKey: string; entryKey: keyof ParsedTableStyleEntry }> = [
	{ xmlKey: 'a:wholeTbl', entryKey: 'wholeTblFill' },
	{ xmlKey: 'a:band1H', entryKey: 'band1HFill' },
	{ xmlKey: 'a:band2H', entryKey: 'band2HFill' },
	{ xmlKey: 'a:band1V', entryKey: 'band1VFill' },
	{ xmlKey: 'a:band2V', entryKey: 'band2VFill' },
	{ xmlKey: 'a:firstRow', entryKey: 'firstRowFill' },
	{ xmlKey: 'a:lastRow', entryKey: 'lastRowFill' },
	{ xmlKey: 'a:firstCol', entryKey: 'firstColFill' },
	{ xmlKey: 'a:lastCol', entryKey: 'lastColFill' },
];

/** Section keys on `a:tblStyle` whose text styles round-trip through the typed map. */
const TEXT_SECTIONS: Array<{ xmlKey: string; entryKey: keyof ParsedTableStyleEntry }> = [
	{ xmlKey: 'a:wholeTbl', entryKey: 'wholeTblText' },
	{ xmlKey: 'a:firstRow', entryKey: 'firstRowText' },
	{ xmlKey: 'a:lastRow', entryKey: 'lastRowText' },
	{ xmlKey: 'a:firstCol', entryKey: 'firstColText' },
	{ xmlKey: 'a:lastCol', entryKey: 'lastColText' },
	{ xmlKey: 'a:band1H', entryKey: 'band1HText' },
	{ xmlKey: 'a:band2H', entryKey: 'band2HText' },
	{ xmlKey: 'a:band1V', entryKey: 'band1VText' },
	{ xmlKey: 'a:band2V', entryKey: 'band2VText' },
];

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Re-emit `ppt/viewProps.xml` from the typed view properties. Walks
	 * `presentation.xml.rels` to find the viewProps target so non-default
	 * part paths round-trip correctly. No-op when the source archive
	 * has no viewProps part — we never invent a new part on save.
	 */
	protected async applyViewPropertiesPart(
		properties: PptxViewProperties | undefined,
	): Promise<void> {
		if (!properties) {
			return;
		}

		const propsPath = await this.resolveViewPropsPath();
		// Only persist edits when the archive already had a viewProps part.
		// Inserting a new part would also require [Content_Types].xml and
		// presentation.xml.rels updates, which is out of scope for this
		// writer.
		if (!this.zip.file(propsPath)) {
			return;
		}

		const xml = this.builder.build(buildViewPropertiesXml(properties));
		this.zip.file(propsPath, xml);
	}

	/**
	 * Resolve the `viewProps` part path from
	 * `ppt/_rels/presentation.xml.rels`. Falls back to the canonical
	 * `ppt/viewProps.xml` location when the relationship is missing or
	 * its target resolves to a path-traversal target.
	 */
	private async resolveViewPropsPath(): Promise<string> {
		const fallback = 'ppt/viewProps.xml';
		const relsXml = await this.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
		if (!relsXml) {
			return fallback;
		}
		try {
			const relsData = this.parser.parse(relsXml) as XmlObject;
			const relNodes = this.ensureArray(
				(relsData?.Relationships as XmlObject | undefined)?.Relationship,
			) as XmlObject[];
			const relNode = relNodes.find((node) => {
				const relType = String(node?.['@_Type'] || '');
				const relTarget = String(node?.['@_Target'] || '');
				return relType.includes('viewProps') || relTarget.includes('viewProps');
			});
			if (!relNode) {
				return fallback;
			}
			const target = String(relNode['@_Target'] || '').trim();
			if (target.length === 0) {
				return fallback;
			}
			const resolved = safeResolveZipPath('ppt', target);
			return resolved ?? fallback;
		} catch {
			return fallback;
		}
	}

	/**
	 * Merge edits from a {@link ParsedTableStyleMap} onto the existing
	 * `ppt/tableStyles.xml`. Preserves the `<a:tblStyleLst @def>` GUID
	 * and any unmodelled section attributes / children. No-op when the
	 * source archive has no `ppt/tableStyles.xml` or no styles were
	 * passed via save options.
	 */
	protected async applyTableStylesPart(
		tableStyles: ParsedTableStyleMap | undefined,
	): Promise<void> {
		if (!tableStyles || Object.keys(tableStyles).length === 0) {
			return;
		}

		const path = 'ppt/tableStyles.xml';
		const xmlStr = await this.zip.file(path)?.async('string');
		if (!xmlStr) {
			// Don't invent a new part — content types / rels would also need updating.
			return;
		}

		let parsed: XmlObject;
		try {
			parsed = this.parser.parse(xmlStr) as XmlObject;
		} catch {
			return;
		}

		const styleLst = parsed['a:tblStyleLst'] as XmlObject | undefined;
		if (!styleLst) {
			return;
		}

		const styleNodes = this.ensureArray(styleLst['a:tblStyle']);
		if (styleNodes.length === 0) {
			return;
		}

		// Build a quick lookup from normalised GUID -> XML node.
		const byGuid = new Map<string, XmlObject>();
		for (const node of styleNodes) {
			const rawId = String((node as XmlObject)['@_styleId'] || '').trim();
			if (rawId) {
				byGuid.set(this.normalizeTableStyleGuid(rawId), node as XmlObject);
			}
		}

		for (const [guid, entry] of Object.entries(tableStyles)) {
			const target = byGuid.get(this.normalizeTableStyleGuid(guid));
			if (!target) {
				continue;
			}
			if (entry.styleName !== undefined) {
				target['@_styleName'] = entry.styleName;
			}
			applyTableStyleEntryToNode(target, entry);
		}

		// Preserve the `def` attribute and any other tblStyleLst-level
		// attributes via the round-tripped object (parser captures them
		// on `styleLst`).
		this.zip.file(path, this.builder.build(parsed));
	}
}

/**
 * Apply parsed fill/text edits onto a single `a:tblStyle` XML node.
 * Exported for unit testing.
 */
export function applyTableStyleEntryToNode(
	styleNode: XmlObject,
	entry: ParsedTableStyleEntry,
): void {
	for (const { xmlKey, entryKey } of FILL_SECTIONS) {
		const fill = entry[entryKey] as ParsedTableStyleFill | undefined;
		if (!fill) {
			continue;
		}
		applyFillToSection(styleNode, xmlKey, fill);
	}

	for (const { xmlKey, entryKey } of TEXT_SECTIONS) {
		const text = entry[entryKey] as ParsedTableStyleText | undefined;
		if (!text) {
			continue;
		}
		applyTextToSection(styleNode, xmlKey, text);
	}
}

function applyFillToSection(
	styleNode: XmlObject,
	sectionKey: string,
	fill: ParsedTableStyleFill,
): void {
	const section = ensureSection(styleNode, sectionKey);
	const tcStyle = ensureChild(section, 'a:tcStyle');
	const fillNode = ensureChild(tcStyle, 'a:fill');
	const solidFill = ensureChild(fillNode, 'a:solidFill');

	const schemeClr: XmlObject = { '@_val': fill.schemeColor };
	if (fill.tint !== undefined) {
		schemeClr['a:tint'] = { '@_val': String(fill.tint) };
	}
	if (fill.shade !== undefined) {
		schemeClr['a:shade'] = { '@_val': String(fill.shade) };
	}

	// Replace any existing colour choice — solidFill is a choice element,
	// so we drop sibling fill choices to avoid producing invalid XML.
	for (const key of Object.keys(solidFill)) {
		delete solidFill[key];
	}
	solidFill['a:schemeClr'] = schemeClr;
}

function applyTextToSection(
	styleNode: XmlObject,
	sectionKey: string,
	text: ParsedTableStyleText,
): void {
	const section = ensureSection(styleNode, sectionKey);
	const tcTxStyle = ensureChild(section, 'a:tcTxStyle');

	if (text.bold !== undefined) {
		if (text.bold) {
			tcTxStyle['@_b'] = 'on';
		} else {
			delete tcTxStyle['@_b'];
		}
	}
	if (text.italic !== undefined) {
		if (text.italic) {
			tcTxStyle['@_i'] = 'on';
		} else {
			delete tcTxStyle['@_i'];
		}
	}
	if (text.fontSchemeColor !== undefined) {
		const schemeClr: XmlObject = { '@_val': text.fontSchemeColor };
		if (text.fontTint !== undefined) {
			schemeClr['a:tint'] = { '@_val': String(text.fontTint) };
		}
		if (text.fontShade !== undefined) {
			schemeClr['a:shade'] = { '@_val': String(text.fontShade) };
		}
		// Drop any other colour choice on the txStyle node.
		delete tcTxStyle['a:srgbClr'];
		delete tcTxStyle['a:sysClr'];
		tcTxStyle['a:schemeClr'] = schemeClr;
	}
}

function ensureSection(styleNode: XmlObject, sectionKey: string): XmlObject {
	const existing = styleNode[sectionKey];
	// Some parsers represent repeated keys as arrays. tblStyle sections
	// only ever appear once each in a valid file, so unwrap if needed.
	if (Array.isArray(existing) && existing.length > 0) {
		return existing[0] as XmlObject;
	}
	if (existing && typeof existing === 'object') {
		return existing as XmlObject;
	}
	const created: XmlObject = {};
	styleNode[sectionKey] = created;
	return created;
}

function ensureChild(parent: XmlObject, key: string): XmlObject {
	const existing = parent[key];
	if (Array.isArray(existing) && existing.length > 0) {
		return existing[0] as XmlObject;
	}
	if (existing && typeof existing === 'object') {
		return existing as XmlObject;
	}
	const created: XmlObject = {};
	parent[key] = created;
	return created;
}
