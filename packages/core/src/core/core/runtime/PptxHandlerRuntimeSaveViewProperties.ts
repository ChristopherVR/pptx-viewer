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
 *   round-trip losslessly, creates a brand-new `<a:tblStyle>` node for any
 *   GUID in the map the archive did not already have, optionally deletes
 *   styles named in `tableStylesToDelete`, and optionally repoints `@def`.
 *   The per-section fill/text/border/cell3D/background merge itself lives in
 *   `table-style-save.ts` (W3-E: all 13 `CT_TableStyle` parts, not just the
 *   9 non-corner ones this writer used to cover). When the source archive
 *   has no `ppt/tableStyles.xml`, the writer is a no-op.
 */

import type { XmlObject, PptxViewProperties, ParsedTableStyleMap } from '../../types';
import { safeResolveZipPath } from '../../utils/safe-path';
import { buildViewPropertiesXml } from './pptx-view-props-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutMaster';
import { applyTableStyleEntryToNode } from './table-style-save';

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
	 * (unless {@link defaultStyleId} overrides it) and any unmodelled section
	 * attributes / children. A GUID in `tableStyles` that the archive does not
	 * already have becomes a brand-new `<a:tblStyle styleId="...">` node
	 * (`create_table_style`); a GUID in {@link deleteStyleIds} is removed
	 * (`delete_table_style`), unless it is also the (resulting) default. No-op
	 * entirely when the source archive has no `ppt/tableStyles.xml`, or when
	 * none of the three parameters carry anything to do.
	 */
	protected async applyTableStylesPart(
		tableStyles: ParsedTableStyleMap | undefined,
		defaultStyleId?: string,
		deleteStyleIds?: string[],
	): Promise<void> {
		const hasEdits = Boolean(tableStyles && Object.keys(tableStyles).length > 0);
		const hasDefault = Boolean(defaultStyleId);
		const hasDeletes = Boolean(deleteStyleIds && deleteStyleIds.length > 0);
		if (!hasEdits && !hasDefault && !hasDeletes) {
			return;
		}

		const path = 'ppt/tableStyles.xml';
		const xmlStr = await this.zip.file(path)?.async('string');
		if (!xmlStr) {
			// Don't invent the PART itself: content types / rels would also
			// need updating; a caller with no tableStyles.xml at all gets a
			// no-op rather than a half-wired new part.
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

		const byGuid = new Map<string, XmlObject>();
		for (const node of styleNodes) {
			const rawId = String((node as XmlObject)['@_styleId'] || '').trim();
			if (rawId) {
				byGuid.set(this.normalizeTableStyleGuid(rawId), node as XmlObject);
			}
		}

		if (hasEdits) {
			for (const [guid, entry] of Object.entries(tableStyles as ParsedTableStyleMap)) {
				const normalizedGuid = this.normalizeTableStyleGuid(guid);
				let target = byGuid.get(normalizedGuid);
				if (!target) {
					// No existing node for this GUID: create one (issue: a
					// caller-created style previously had no serialize path at
					// all, so `create_table_style` could never actually persist).
					target = { '@_styleId': normalizedGuid };
					styleNodes.push(target);
					byGuid.set(normalizedGuid, target);
				}
				if (entry.styleName !== undefined) {
					target['@_styleName'] = entry.styleName;
				}
				applyTableStyleEntryToNode(target, entry);
			}
		}

		let finalStyleNodes = styleNodes;
		if (hasDeletes) {
			const toDelete = new Set(
				(deleteStyleIds as string[]).map((id) => this.normalizeTableStyleGuid(id)),
			);
			const protectedId = this.normalizeTableStyleGuid(
				defaultStyleId || String(styleLst['@_def'] || ''),
			);
			finalStyleNodes = styleNodes.filter((node) => {
				const id = this.normalizeTableStyleGuid(String((node as XmlObject)['@_styleId'] || ''));
				return id === protectedId || !toDelete.has(id);
			});
		}
		styleLst['a:tblStyle'] = finalStyleNodes;

		if (hasDefault) {
			styleLst['@_def'] = this.normalizeTableStyleGuid(defaultStyleId as string);
		}

		this.zip.file(path, this.builder.build(parsed));
	}
}
