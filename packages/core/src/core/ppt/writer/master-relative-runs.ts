/**
 * Make each run's bold/italic/underline relative to the master text style
 * it inherits, before the `.ppt` is written.
 *
 * PowerPoint 16.0 reads a TextCFException's bold/italic/underline mask bit
 * as "differs from the master": a set bit TOGGLES the master's value, and
 * the fontStyle value bit is not what decides it (COM-measured with a bold
 * master title style: a run written with the bold mask bit and value 1 read
 * back NOT bold, and one with the bold AND italic bits at value 0 read back
 * italic). PowerPoint's own 97-2003 SaveAs only ever sets a style bit where
 * the run differs from its master (a non-bold run on a bold master title:
 * mask `0x1`, value 0; an italic run: mask `0x2`), which reads correctly
 * under either reading. This pass enforces exactly that: a style equal to
 * the master's effective value is dropped (inherited), and only a differing
 * one is kept.
 *
 * @module ppt/writer/master-relative-runs
 */

import type {
	WAnyShape,
	WDeck,
	WMasterLevel,
	WMasterTextStyles,
	WParagraph,
	WTextBody,
} from './write-model';

type StyleKey = 'bold' | 'italic' | 'underline';
const STYLE_KEYS: readonly StyleKey[] = ['bold', 'italic', 'underline'];

/** The master style levels a text type inherits (TextTypeEnum). */
function levelsFor(
	styles: WMasterTextStyles | undefined,
	textType: number,
): WMasterLevel[] | undefined {
	switch (textType) {
		case 0: // title
		case 6: // centre title
			return styles?.title;
		case 1: // body
		case 5: // centre body
		case 7: // half body
		case 8: // quarter body
			return styles?.body;
		case 4: // other
			return styles?.other;
		default:
			return undefined; // notes: the fixed default style, no bold/italic/underline
	}
}

function relativiseParagraph(para: WParagraph, level: WMasterLevel | undefined): WParagraph {
	const runs = para.runs.map((run) => {
		const out = { ...run };
		for (const key of STYLE_KEYS) {
			const inherited = level?.run[key] ?? false;
			if (out[key] !== undefined && out[key] === inherited) {
				delete out[key];
			}
		}
		return out;
	});
	return { ...para, runs };
}

function relativiseBody(body: WTextBody, styles: WMasterTextStyles | undefined): WTextBody {
	const levels = levelsFor(styles, body.textType);
	return {
		...body,
		paragraphs: body.paragraphs.map((para) => {
			const index = levels ? Math.min(Math.max(0, para.indentLevel), levels.length - 1) : 0;
			return relativiseParagraph(para, levels?.[index]);
		}),
	};
}

function relativiseShape(shape: WAnyShape, styles: WMasterTextStyles | undefined): WAnyShape {
	if (shape.kind === 'group') {
		return { ...shape, children: shape.children.map((child) => relativiseShape(child, styles)) };
	}
	if (shape.kind === 'shape' && shape.text) {
		return { ...shape, text: relativiseBody(shape.text, styles) };
	}
	return shape;
}

/** Return `deck` with every run's style bits made master-relative (see module doc). */
export function withMasterRelativeRunStyles(deck: WDeck): WDeck {
	const styles = deck.masterStyles;
	return {
		...deck,
		slides: deck.slides.map((slide) => ({
			...slide,
			shapes: slide.shapes.map((shape) => relativiseShape(shape, styles)),
			notesParagraphs: slide.notesParagraphs?.map((para) => relativiseParagraph(para, undefined)),
		})),
	};
}
