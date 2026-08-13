/**
 * @fileoverview Presentation-level header/footer <-> part-level OOXML.
 *
 * PowerPoint's "Header and Footer" dialog looks presentation-wide, but there
 * is no presentation-wide element behind it. `p:hf` (CT_HeaderFooter,
 * ECMA-376 §19.3.1.21) is NOT a child of `p:presentation`; it lives on slide
 * masters, notes/handout masters and slide layouts, and the dialog's *text*
 * does not live in `p:hf` at all - it is the literal content of the master's
 * `ftr` / `dt` / `hdr` placeholder shapes.
 *
 * Verified against PowerPoint through COM on a deck authored by PowerPoint
 * itself:
 *
 *   - `Presentation.SlideMaster.HeadersFooters.Footer.Visible` follows
 *     `p:sldMaster/p:hf/@ftr`; forcing `ftr="0" dt="0" sldNum="0"` flipped all
 *     three to False on reopen.
 *   - `.Footer.Text` / `.DateAndTime.Text` come from the master's `ftr` / `dt`
 *     placeholder text bodies. PowerPoint leaves the per-slide copies of those
 *     placeholders EMPTY and lets them inherit.
 *   - PowerPoint writes only the non-default flags (`<p:hf hdr="0"/>` on a
 *     slide master), and writes no `p:hf` on `p:sld` at all: per-slide
 *     visibility is expressed by the presence or absence of the placeholder
 *     shape in the slide's `p:spTree`.
 *
 * So the round-trip implemented here is master-scoped, which is what the
 * dialog's "Apply to All" means.
 */

import type { XmlObject, PptxHeaderFooter } from '../../types';
import { applyHeaderFooterFlagsToNode } from './master-save-helpers';

/** Placeholder types the header/footer dialog owns. */
export type HeaderFooterPlaceholderType = 'hdr' | 'ftr' | 'dt' | 'sldNum';

const DEFAULT_DATE_FIELD_TYPE = 'datetime1';

function asArray(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is XmlObject => typeof entry === 'object' && entry !== null);
	}
	return typeof value === 'object' && value !== null ? [value as XmlObject] : [];
}

function child(node: XmlObject | undefined, key: string): XmlObject | undefined {
	const value = node?.[key];
	return typeof value === 'object' && value !== null ? (value as XmlObject) : undefined;
}

/** The `p:spTree` of a master/layout/slide root node (`p:sldMaster`, ...). */
function shapeTree(root: XmlObject | undefined): XmlObject | undefined {
	return child(child(root, 'p:cSld'), 'p:spTree');
}

/** The first `p:sp` in `root`'s shape tree whose `p:ph/@type` is `type`. */
export function findPlaceholderShape(
	root: XmlObject | undefined,
	type: HeaderFooterPlaceholderType,
): XmlObject | undefined {
	for (const sp of asArray(shapeTree(root)?.['p:sp'])) {
		const ph = child(child(child(sp, 'p:nvSpPr'), 'p:nvPr'), 'p:ph');
		if (ph && String(ph['@_type'] ?? '') === type) {
			return sp;
		}
	}
	return undefined;
}

/**
 * The literal text of a placeholder shape, with `a:fld` runs EXCLUDED.
 *
 * A field is a live substitution (`<a:fld type="datetime1">` renders today's
 * date), so its cached `a:t` is a stale snapshot, not authored text. Reading
 * it back would turn "update automatically" into a frozen string on the next
 * save.
 */
export function readPlaceholderLiteralText(sp: XmlObject | undefined): string {
	const txBody = child(sp, 'p:txBody');
	if (!txBody) {
		return '';
	}
	const parts: string[] = [];
	for (const paragraph of asArray(txBody['a:p'])) {
		for (const run of asArray(paragraph['a:r'])) {
			const text = run['a:t'];
			if (typeof text === 'string' || typeof text === 'number') {
				parts.push(String(text));
			}
		}
	}
	return parts.join('');
}

/** The `a:fld/@type` of the first field run in a placeholder, if any. */
export function readPlaceholderFieldType(sp: XmlObject | undefined): string | undefined {
	const txBody = child(sp, 'p:txBody');
	if (!txBody) {
		return undefined;
	}
	for (const paragraph of asArray(txBody['a:p'])) {
		for (const field of asArray(paragraph['a:fld'])) {
			const type = field['@_type'];
			if (typeof type === 'string' && type.length > 0) {
				return type;
			}
		}
	}
	return undefined;
}

/**
 * Read the dialog's state out of a slide master's parsed XML.
 *
 * The four flags are resolved, not passed through: `p:hf` omits every
 * attribute whose value is the spec default (`true`), so PowerPoint writes
 * `<p:hf hdr="0"/>` on a slide master that shows footer, date and slide
 * number. Returning `undefined` for the three it left out would have the
 * dialog render them UNTICKED on a deck that shows all three.
 *
 * An omitted flag therefore resolves to "does this master actually carry that
 * placeholder", which is what PowerPoint's own dialog reflects: the spec
 * default of `true` is meaningless for a placeholder that does not exist, and
 * a slide master has no `hdr` placeholder at all.
 *
 * The tri-state is not lost, only moved: `PptxSlideMaster.headerFooter`
 * (`PptxHeaderFooterFlags`) still distinguishes "unset" from "false" for the
 * per-master save writer.
 */
export function readHeaderFooterFromMaster(masterRoot: XmlObject | undefined): PptxHeaderFooter {
	const result: PptxHeaderFooter = {};
	const hf = child(masterRoot, 'p:hf');
	const flag = (attribute: string, placeholder: HeaderFooterPlaceholderType): boolean => {
		const raw = hf?.[attribute];
		if (raw !== undefined) {
			return String(raw) !== '0' && String(raw) !== 'false';
		}
		return findPlaceholderShape(masterRoot, placeholder) !== undefined;
	};
	result.hasHeader = flag('@_hdr', 'hdr');
	result.hasFooter = flag('@_ftr', 'ftr');
	result.hasDateTime = flag('@_dt', 'dt');
	result.hasSlideNumber = flag('@_sldNum', 'sldNum');

	const headerText = readPlaceholderLiteralText(findPlaceholderShape(masterRoot, 'hdr'));
	if (headerText.length > 0) {
		result.headerText = headerText;
	}
	const footerText = readPlaceholderLiteralText(findPlaceholderShape(masterRoot, 'ftr'));
	if (footerText.length > 0) {
		result.footerText = footerText;
	}
	const datePlaceholder = findPlaceholderShape(masterRoot, 'dt');
	const dateFieldType = readPlaceholderFieldType(datePlaceholder);
	if (dateFieldType) {
		result.dateTimeAuto = true;
		result.dateFormat = dateFieldType;
	} else {
		const dateText = readPlaceholderLiteralText(datePlaceholder);
		if (dateText.length > 0) {
			result.dateTimeText = dateText;
			result.dateTimeAuto = false;
		}
	}
	return result;
}

/**
 * Replace a placeholder's paragraphs with a single literal run.
 *
 * `p:txBody`'s siblings (`a:bodyPr`, `a:lstStyle`) carry the master's
 * formatting for this placeholder and are left untouched: only `a:p` is
 * rewritten, so changing the footer text never restyles the footer.
 */
function writeLiteralText(sp: XmlObject | undefined, text: string): void {
	const txBody = child(sp, 'p:txBody');
	if (!txBody) {
		return;
	}
	// Re-writing the same string would still discard the authored run
	// properties (`dirty`, `lang`, `smtClean`) for no gain, and every save
	// passes the dialog's state whether or not the user opened it.
	if (readPlaceholderLiteralText(sp) === text && readPlaceholderFieldType(sp) === undefined) {
		return;
	}
	txBody['a:p'] =
		text.length > 0
			? { 'a:r': { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': text } }
			: { 'a:endParaRPr': { '@_lang': 'en-US' } };
}

/**
 * Replace a placeholder's paragraphs with a single auto-updating field run.
 *
 * The `a:fld/@id` GUID is reused from the existing field when there is one.
 * PowerPoint keys its field instances off that GUID, and minting a fresh one
 * on every save would churn the part for no reason.
 */
function writeFieldText(sp: XmlObject | undefined, fieldType: string, cached: string): void {
	const txBody = child(sp, 'p:txBody');
	if (!txBody) {
		return;
	}
	const existingId = (() => {
		for (const paragraph of asArray(txBody['a:p'])) {
			for (const field of asArray(paragraph['a:fld'])) {
				const id = field['@_id'];
				if (typeof id === 'string' && id.length > 0) {
					return id;
				}
			}
		}
		return undefined;
	})();
	txBody['a:p'] = {
		'a:fld': {
			'@_id': existingId ?? '{5D4A5A73-1C69-4B0B-9C2E-6C1D8D2C4E11}',
			'@_type': fieldType,
			'a:rPr': { '@_lang': 'en-US' },
			'a:t': cached,
		},
		'a:endParaRPr': { '@_lang': 'en-US' },
	};
}

/**
 * Write the dialog's state onto one slide-master root node, in place.
 *
 * Only fields the caller actually set are written, so a partially-filled
 * `PptxHeaderFooter` never blanks a footer the user did not touch.
 *
 * A flag whose requested value already matches what the part means is left
 * alone rather than restated. Every binding passes the dialog's state on every
 * save, whether or not the user ever opened the dialog, so restating would
 * rewrite `<p:hf hdr="0"/>` as `<p:hf hdr="0" ftr="1" dt="1" sldNum="1"/>` on
 * an untouched deck: identical in meaning (those ARE the spec defaults) but a
 * gratuitous diff on a part that would otherwise pass through verbatim.
 */
export function applyHeaderFooterToMaster(
	masterRoot: XmlObject,
	headerFooter: PptxHeaderFooter,
): void {
	const current = readHeaderFooterFromMaster(masterRoot);
	const changedFlag = (requested: boolean | undefined, effective: boolean | undefined): boolean =>
		requested !== undefined && requested !== effective;
	applyHeaderFooterFlagsToNode(masterRoot, {
		...(changedFlag(headerFooter.hasHeader, current.hasHeader)
			? { hasHeader: headerFooter.hasHeader }
			: {}),
		...(changedFlag(headerFooter.hasFooter, current.hasFooter)
			? { hasFooter: headerFooter.hasFooter }
			: {}),
		...(changedFlag(headerFooter.hasDateTime, current.hasDateTime)
			? { hasDateTime: headerFooter.hasDateTime }
			: {}),
		...(changedFlag(headerFooter.hasSlideNumber, current.hasSlideNumber)
			? { hasSlideNumber: headerFooter.hasSlideNumber }
			: {}),
	});

	if (headerFooter.headerText !== undefined) {
		writeLiteralText(findPlaceholderShape(masterRoot, 'hdr'), headerFooter.headerText);
	}
	if (headerFooter.footerText !== undefined) {
		writeLiteralText(findPlaceholderShape(masterRoot, 'ftr'), headerFooter.footerText);
	}

	const datePlaceholder = findPlaceholderShape(masterRoot, 'dt');
	if (headerFooter.dateTimeAuto === true) {
		writeFieldText(
			datePlaceholder,
			headerFooter.dateFormat && headerFooter.dateFormat.length > 0
				? headerFooter.dateFormat
				: DEFAULT_DATE_FIELD_TYPE,
			headerFooter.dateTimeText ?? '',
		);
	} else if (headerFooter.dateTimeText !== undefined) {
		writeLiteralText(datePlaceholder, headerFooter.dateTimeText);
	}
}
