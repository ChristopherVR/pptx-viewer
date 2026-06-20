/**
 * text-body-codec.ts: Encode/decode a PPTX TextSegment[] to/from a Yjs Y.Text.
 *
 * Each TextSegment maps to one Y.Text delta operation:
 *  - Normal text run  -> {insert: run.text, attributes: {s: JSON(style), ...meta}}
 *  - Paragraph break  -> {insert: '\n', attributes: {pb: '1', ...meta}}
 *  - Line break       -> {insert: '\n', attributes: {lb: '1', ...meta}}
 *  - Empty placeholder -> {insert: '​', attributes: {ep: '1', ...meta}}
 *
 * All complex fields (style, bulletInfo, etc.) are JSON-serialised into string
 * attribute values (Y.Text attribute values must be primitives).
 *
 * The codec is intentionally opaque: it round-trips any Record<string,unknown>
 * array so the typed TextSegment model can evolve without changing this file.
 */

import { Text as YText } from 'yjs';

// Zero-width space used as a placeholder for empty non-break runs.
const EMPTY_PLACEHOLDER = '​'; // ​

function buildAttrs(seg: Record<string, unknown>): Record<string, string> | undefined {
	const a: Record<string, string> = {};
	const style = seg.style;
	if (style && typeof style === 'object' && Object.keys(style).length > 0) {
		a.s = JSON.stringify(style);
	}
	if (seg.isParagraphBreak) {
		a.pb = '1';
	}
	if (seg.isLineBreak) {
		a.lb = '1';
	}
	if (seg.ep === true) {
		a.ep = '1';
	}
	if (seg.bulletInfo) {
		a.bi = JSON.stringify(seg.bulletInfo);
	}
	if (seg.paragraphLevel !== undefined) {
		a.pl = String(seg.paragraphLevel);
	}
	if (seg.endParaRunProperties) {
		a.pr = JSON.stringify(seg.endParaRunProperties);
	}
	if (typeof seg.fieldType === 'string') {
		a.ft = seg.fieldType;
	}
	if (typeof seg.fieldGuid === 'string') {
		a.fg = seg.fieldGuid;
	}
	if (seg.fieldGuidAttr === 'uuid' || seg.fieldGuidAttr === 'id') {
		a.fga = seg.fieldGuidAttr;
	}
	if (seg.fieldParagraphPropertiesXml) {
		a.fp = JSON.stringify(seg.fieldParagraphPropertiesXml);
	}
	if (seg.equationXml) {
		a.eq = JSON.stringify(seg.equationXml);
	}
	if (typeof seg.equationNumber === 'string') {
		a.en = seg.equationNumber;
	}
	if (seg.breakRunProperties) {
		a.br = JSON.stringify(seg.breakRunProperties);
	}
	if (typeof seg.rubyText === 'string') {
		a.rt = seg.rubyText;
	}
	if (typeof seg.rubyAlignment === 'string') {
		a.ra = seg.rubyAlignment;
	}
	if (seg.rubyFontSize !== undefined) {
		a.rfs = String(seg.rubyFontSize);
	}
	if (seg.rubyStyle) {
		a.rs = JSON.stringify(seg.rubyStyle);
	}
	return Object.keys(a).length > 0 ? a : undefined;
}

/** Encode an array of TextSegment-shaped objects into a Y.Text. */
export function encodeTextBodyToYText(segments: unknown[], ytext: YText): void {
	let offset = 0;
	for (const raw of segments) {
		const seg = raw as Record<string, unknown>;
		const attrs = buildAttrs(seg);
		if (seg.isParagraphBreak === true || seg.isLineBreak === true) {
			ytext.insert(offset, '\n', attrs);
			offset += 1;
		} else if (typeof seg.text === 'string' && seg.text.length > 0) {
			ytext.insert(offset, seg.text, attrs);
			offset += seg.text.length;
		} else {
			// Empty non-break run: use placeholder to preserve attributes
			const epAttrs: Record<string, string> = { ep: '1', ...(attrs ?? {}) };
			ytext.insert(offset, EMPTY_PLACEHOLDER, epAttrs);
			offset += 1;
		}
	}
}

/** Decode a Y.Text delta back into TextSegment-shaped objects. */
export function decodeTextBodyFromYText(ytext: YText): Record<string, unknown>[] {
	const delta = ytext.toDelta() as Array<{
		insert?: unknown;
		attributes?: Record<string, string>;
	}>;
	const segments: Record<string, unknown>[] = [];
	for (const op of delta) {
		if (typeof op.insert !== 'string' || op.insert === '') {
			continue;
		}
		const a = op.attributes ?? {};
		const seg: Record<string, unknown> = { text: '', style: {} };
		if (a.s) {
			try {
				seg.style = JSON.parse(a.s);
			} catch {
				seg.style = {};
			}
		}
		if (a.pb === '1') {
			seg.isParagraphBreak = true;
		}
		if (a.lb === '1') {
			seg.isLineBreak = true;
		}
		if (a.bi) {
			try {
				seg.bulletInfo = JSON.parse(a.bi);
			} catch {
				/* skip */
			}
		}
		if (a.pl !== undefined) {
			seg.paragraphLevel = Number(a.pl);
		}
		if (a.pr) {
			try {
				seg.endParaRunProperties = JSON.parse(a.pr);
			} catch {
				/* skip */
			}
		}
		if (a.ft) {
			seg.fieldType = a.ft;
		}
		if (a.fg) {
			seg.fieldGuid = a.fg;
		}
		if (a.fga === 'uuid' || a.fga === 'id') {
			seg.fieldGuidAttr = a.fga;
		}
		if (a.fp) {
			try {
				seg.fieldParagraphPropertiesXml = JSON.parse(a.fp);
			} catch {
				/* skip */
			}
		}
		if (a.eq) {
			try {
				seg.equationXml = JSON.parse(a.eq);
			} catch {
				/* skip */
			}
		}
		if (a.en) {
			seg.equationNumber = a.en;
		}
		if (a.br) {
			try {
				seg.breakRunProperties = JSON.parse(a.br);
			} catch {
				/* skip */
			}
		}
		if (a.rt) {
			seg.rubyText = a.rt;
		}
		if (a.ra) {
			seg.rubyAlignment = a.ra;
		}
		if (a.rfs !== undefined) {
			seg.rubyFontSize = Number(a.rfs);
		}
		if (a.rs) {
			try {
				seg.rubyStyle = JSON.parse(a.rs);
			} catch {
				/* skip */
			}
		}
		// Restore text content (empty-placeholder and breaks have no user text)
		if (op.insert !== '\n' && op.insert !== EMPTY_PLACEHOLDER) {
			seg.text = op.insert;
		}
		segments.push(seg);
	}
	return segments;
}
