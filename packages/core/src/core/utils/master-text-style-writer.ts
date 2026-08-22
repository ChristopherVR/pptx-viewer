/**
 * Edit path for `p:txStyles` (a slide master's title/body/other text-style
 * cascade) and `p:defaultTextStyle` (the presentation-wide last-resort
 * fallback) - the two constructs `PptxHandlerRuntimeSaveSlideMaster.ts`
 * documented as having no edit API.
 *
 * Every write merges into whatever XML already exists (via
 * {@link mergeOrderedXml} / {@link serializePlaceholderLevelStyle}) so an
 * edit to one level, or one category, leaves the rest - including XML this
 * typed model does not cover - untouched, in schema order.
 *
 * @module master-text-style-writer
 */
import type { PptxMasterTextStyles, PptxTextStyleLevels, XmlObject } from '../types';
import { mergeOrderedXml } from './ordered-xml-merge';
import { serializePlaceholderLevelStyle } from './placeholder-level-style-serializer';

/** CT_TextListStyle child order: defPPr, lvl1pPr, ..., lvl9pPr. */
const LEVEL_KEY_ORDER = [
	'a:defPPr',
	'a:lvl1pPr',
	'a:lvl2pPr',
	'a:lvl3pPr',
	'a:lvl4pPr',
	'a:lvl5pPr',
	'a:lvl6pPr',
	'a:lvl7pPr',
	'a:lvl8pPr',
	'a:lvl9pPr',
] as const;

function levelXmlKey(level: number): string {
	return level === -1 ? 'a:defPPr' : `a:lvl${level + 1}pPr`;
}

/** Merge a {@link PptxTextStyleLevels} category into an existing CT_TextListStyle node. */
export function serializeTextStyleLevels(
	levels: PptxTextStyleLevels,
	existing?: XmlObject,
): XmlObject {
	const childEdits = new Map<string, XmlObject | null>();
	for (const [key, style] of Object.entries(levels)) {
		const level = Number(key);
		if (!Number.isFinite(level)) {
			continue;
		}
		const xmlKey = levelXmlKey(level);
		childEdits.set(
			xmlKey,
			serializePlaceholderLevelStyle(style, existing?.[xmlKey] as XmlObject | undefined),
		);
	}
	return mergeOrderedXml(existing, {}, childEdits, LEVEL_KEY_ORDER);
}

/** CT_SlideMaster child order: cSld, clrMap, sldLayoutIdLst, transition, timing, hf, txStyles, extLst. */
const SLDMASTER_BEFORE_TXSTYLES = new Set(['p:extLst']);
const TX_STYLES_CATEGORY_ORDER = ['p:titleStyle', 'p:bodyStyle', 'p:otherStyle'] as const;

/**
 * Apply typed {@link PptxMasterTextStyles} edits onto a master's `p:sldMaster`
 * root, mutating `root` in place. Only the categories present on `txStyles`
 * are touched; the others (and any category-level XML this model does not
 * cover) survive untouched.
 */
export function applyMasterTextStyles(root: XmlObject, txStyles: PptxMasterTextStyles): void {
	const existing = root['p:txStyles'] as XmlObject | undefined;
	const childEdits = new Map<string, XmlObject | null>();
	if (txStyles.titleStyle) {
		childEdits.set(
			'p:titleStyle',
			serializeTextStyleLevels(
				txStyles.titleStyle,
				existing?.['p:titleStyle'] as XmlObject | undefined,
			),
		);
	}
	if (txStyles.bodyStyle) {
		childEdits.set(
			'p:bodyStyle',
			serializeTextStyleLevels(
				txStyles.bodyStyle,
				existing?.['p:bodyStyle'] as XmlObject | undefined,
			),
		);
	}
	if (txStyles.otherStyle) {
		childEdits.set(
			'p:otherStyle',
			serializeTextStyleLevels(
				txStyles.otherStyle,
				existing?.['p:otherStyle'] as XmlObject | undefined,
			),
		);
	}
	if (childEdits.size === 0) {
		return;
	}
	const node = mergeOrderedXml(existing, {}, childEdits, TX_STYLES_CATEGORY_ORDER);
	insertBeforeKeys(root, 'p:txStyles', node, SLDMASTER_BEFORE_TXSTYLES);
}

/** CT_Presentation child order: ... custDataLst, kinsoku, defaultTextStyle, modifyVerifier, extLst. */
const PRESENTATION_BEFORE_DEFAULT_TEXT_STYLE = new Set(['p:modifyVerifier', 'p:extLst']);

/**
 * Apply typed default-text-style edits onto `p:presentation`, mutating
 * `presentation` in place with the same merge-in-place contract as
 * {@link applyMasterTextStyles}.
 */
export function applyPresentationDefaultTextStyle(
	presentation: XmlObject,
	levels: PptxTextStyleLevels,
): void {
	const existing = presentation['p:defaultTextStyle'] as XmlObject | undefined;
	const node = serializeTextStyleLevels(levels, existing);
	insertBeforeKeys(
		presentation,
		'p:defaultTextStyle',
		node,
		PRESENTATION_BEFORE_DEFAULT_TEXT_STYLE,
	);
}

/** Insert (or reposition) `value` under `key` in `container`, respecting schema order. */
function insertBeforeKeys(
	container: XmlObject,
	key: string,
	value: XmlObject,
	before: ReadonlySet<string>,
): void {
	const rebuilt: XmlObject = {};
	let inserted = false;
	for (const [childKey, childValue] of Object.entries(container)) {
		if (childKey === key) {
			continue;
		}
		if (!inserted && before.has(childKey)) {
			rebuilt[key] = value;
			inserted = true;
		}
		rebuilt[childKey] = childValue;
	}
	if (!inserted) {
		rebuilt[key] = value;
	}
	for (const existingKey of Object.keys(container)) {
		delete container[existingKey];
	}
	Object.assign(container, rebuilt);
}
