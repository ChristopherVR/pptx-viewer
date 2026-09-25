/**
 * Text atom writer: TextHeaderAtom, TextCharsAtom and StyleTextPropAtom, the
 * inverse of `text/text-atoms.ts` + `text/style-props.ts`.
 *
 * Paragraphs are joined with '\r'; the paragraph-mark character (whether or
 * not it is materialised as a literal '\r' in the buffer, which it is not
 * for the last paragraph) counts as one character for both the
 * TextPFException and TextCFException run tables, matching
 * `parseStyleTextPropAtom`'s `total = textLength + 1` convention.
 *
 * @module ppt/writer/text-atom-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildInteractiveInfo, buildTextInteractiveInfoAtom } from './hyperlink-writer';
import type { HyperlinkCollector } from './hyperlink-writer';
import { writeCfException, writePfException } from './text-exception-writer';
import type { WTextBody } from './write-model';

/** Join a text body's paragraphs into the flat string TextCharsAtom stores. */
export function joinParagraphText(body: WTextBody): string {
	return body.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\r');
}

function buildTextHeaderAtom(textType: number): Uint8Array {
	const data = new ByteWriter().u32(textType).toBytes();
	return record(RT.TextHeaderAtom, data, 0, false, 0);
}

function buildTextCharsAtom(text: string): Uint8Array {
	const data = new ByteWriter().utf16(text).toBytes();
	return record(RT.TextCharsAtom, data, 0, false, 0);
}

/** Build a StyleTextPropAtom (paragraph + character runs) for `body`. */
export function buildStyleTextPropAtom(
	body: WTextBody,
	fontIndex: (name?: string) => number | undefined,
): Uint8Array {
	const w = new ByteWriter();

	for (const para of body.paragraphs) {
		const textLen = para.runs.reduce((sum, r) => sum + r.text.length, 0);
		w.u32(textLen + 1); // paragraph-mark char counts as one
		w.u16(Math.min(4, Math.max(0, para.indentLevel)));
		writePfException(w, para);
	}

	for (const para of body.paragraphs) {
		const runs = para.runs.length > 0 ? para.runs : [{ text: '' }];
		runs.forEach((run, i) => {
			const isLast = i === runs.length - 1;
			w.u32(run.text.length + (isLast ? 1 : 0));
			writeCfException(w, run, fontIndex);
		});
	}

	return record(RT.StyleTextPropAtom, w.toBytes(), 0, false, 0);
}

/**
 * Build the `(MouseClickInteractiveInfoContainer,
 * MouseClickTextInteractiveInfoAtom)` pair for every run carrying a
 * run-level hyperlink, anchored to that run's 0-based character range
 * within the flattened text `joinParagraphText` produces (paragraphs joined
 * by `'\r'`, one character each, matching `buildStyleTextPropAtom`'s own
 * `total = textLength + 1` convention). These trail the text atoms directly
 * inside the same `OfficeArtClientTextbox`, per
 * `MouseClickTextInteractiveInfoAtom`'s own spec ("anchors the preceding
 * MouseClickInteractiveInfoContainer record in the containing
 * OfficeArtClientTextbox"), confirmed against a COM-authored ground-truth
 * fixture (see `hyperlink-writer.ts`).
 */
function buildRunHyperlinks(body: WTextBody, hyperlinks: HyperlinkCollector): Uint8Array {
	const w = new ByteWriter();
	let offset = 0;
	body.paragraphs.forEach((para, paraIndex) => {
		for (const run of para.runs) {
			if (run.hyperlink) {
				const begin = offset;
				const end = offset + run.text.length;
				w.bytes(buildInteractiveInfo(run.hyperlink, hyperlinks));
				w.bytes(buildTextInteractiveInfoAtom(begin, end));
			}
			offset += run.text.length;
		}
		if (paraIndex < body.paragraphs.length - 1) {
			offset += 1; // '\r' paragraph separator: one character, no run of its own
		}
	});
	return w.toBytes();
}

/**
 * Build the (TextHeaderAtom, TextCharsAtom, StyleTextPropAtom, [run
 * hyperlinks]) sequence for a text body, ready to embed directly inside an
 * OfficeArtClientTextbox.
 *
 * @param fonts - The deck's font collection (see `font-collection-writer.ts`);
 *   used to resolve each run's `fontName` to a `FontEntityAtom` index.
 * @param hyperlinks - Document-wide hyperlink target collector (see
 *   `hyperlink-writer.ts`); registers any run-level hyperlink target found.
 */
export function buildTextAtoms(
	body: WTextBody,
	fonts: string[],
	hyperlinks: HyperlinkCollector,
): Uint8Array {
	const text = joinParagraphText(body);
	const fontIndex = (name?: string): number | undefined => {
		if (!name) {
			return undefined;
		}
		const idx = fonts.indexOf(name);
		return idx >= 0 ? idx : undefined;
	};
	return new ByteWriter()
		.bytes(buildTextHeaderAtom(body.textType))
		.bytes(buildTextCharsAtom(text))
		.bytes(buildStyleTextPropAtom(body, fontIndex))
		.bytes(buildRunHyperlinks(body, hyperlinks))
		.toBytes();
}
