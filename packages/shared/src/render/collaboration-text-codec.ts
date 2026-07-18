/**
 * collaboration-text-codec.ts: TextSegment[] <-> Y.Text delta codec used by the
 * collaboration sync layer. Split out of collaboration-sync.ts to keep both
 * modules focused.
 *
 * Exports:
 *  - DeltaOp / YTextLike: structural Yjs text interfaces (no yjs import)
 *  - encodeTextBody: write TextSegment[] into a live YTextLike
 *  - encodeSegmentsToDelta: pure simulation of the delta Y.Text would produce
 *  - decodeDelta / decodeTextBody: delta -> TextSegment[]
 *  - isYTextLike: runtime guard
 */

export interface DeltaOp {
	insert?: unknown;
	attributes?: Record<string, unknown>;
}

export interface YTextLike {
	insert: (index: number, text: string, attrs?: Record<string, string>) => void;
	toDelta: () => DeltaOp[];
	toString: () => string;
}

export function isYTextLike(value: unknown): value is YTextLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as YTextLike).toDelta === 'function'
	);
}

function buildSegmentAttrs(seg: Record<string, unknown>): Record<string, string> {
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
	return a;
}

/** Resolve the literal text a segment contributes to the Y.Text document. */
function segmentInsertText(seg: Record<string, unknown>): string {
	if (seg.isParagraphBreak === true || seg.isLineBreak === true) {
		return '\n';
	}
	if (typeof seg.text === 'string' && seg.text.length > 0) {
		return seg.text;
	}
	// Empty non-break run: zero-width space holds the attributes.
	return '​';
}

export function encodeTextBody(segments: unknown[], ytext: YTextLike): void {
	let offset = 0;
	for (const raw of segments) {
		const seg = raw as Record<string, unknown>;
		const attrs = buildSegmentAttrs(seg);
		const text = segmentInsertText(seg);
		// Always pass an explicit attrs object: Yjs makes attribute-less inserts
		// inherit the preceding character's formatting, which bled styles and
		// paragraph-break markers into unstyled runs.
		ytext.insert(offset, text, attrs);
		offset += text.length;
	}
}

/**
 * Pure simulation of the delta a Y.Text produces after `encodeTextBody`:
 * adjacent runs with identical attribute maps merge into one op, matching
 * Yjs run-merging. Used to compare desired segments against a live Y.Text
 * without instantiating one.
 */
export function encodeSegmentsToDelta(segments: unknown[]): DeltaOp[] {
	const ops: DeltaOp[] = [];
	for (const raw of segments) {
		const seg = raw as Record<string, unknown>;
		const attrs = buildSegmentAttrs(seg);
		const attributes = Object.keys(attrs).length > 0 ? attrs : undefined;
		const text = segmentInsertText(seg);
		const prev = ops[ops.length - 1];
		if (
			prev &&
			typeof prev.insert === 'string' &&
			JSON.stringify(prev.attributes ?? null) === JSON.stringify(attributes ?? null)
		) {
			prev.insert += text;
		} else {
			ops.push(attributes ? { insert: text, attributes } : { insert: text });
		}
	}
	return ops;
}

export function decodeDelta(delta: DeltaOp[]): Record<string, unknown>[] {
	const segments: Record<string, unknown>[] = [];
	for (const op of delta) {
		if (typeof op.insert !== 'string' || op.insert === '') {
			continue;
		}
		const a = (op.attributes ?? {}) as Record<string, string>;
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
		// '\n' is only the synthetic break marker when the op carries a break
		// attribute; a literal newline TEXT run (no pb/lb) must keep its text or
		// runs like "Project\nAtlas" collapse to "ProjectAtlas" on decode. The
		// zero-width space is always the empty-run attribute holder.
		const isBreakMarker = op.insert === '\n' && (a.pb === '1' || a.lb === '1');
		if (!isBreakMarker && op.insert !== '​') {
			seg.text = op.insert;
		}
		segments.push(seg);
	}
	return segments;
}

export function decodeTextBody(ytext: YTextLike): Record<string, unknown>[] {
	return decodeDelta(ytext.toDelta());
}
