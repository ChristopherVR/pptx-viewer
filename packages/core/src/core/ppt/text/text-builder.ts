/**
 * Builds the resolved text body model from raw text plus style runs.
 *
 * Paragraphs are split on \r (the PPT paragraph mark); the style runs from
 * the StyleTextPropAtom are sliced across the paragraph boundaries.
 *
 * @module ppt/text/text-builder
 */

import type { PptParagraph, PptRun, PptTextBody } from '../ppt-model';
import { masterToEmu } from '../record-types';
import type { PptCharProps, PptParagraphProps } from './style-props';
import type { PptRawText } from './text-atoms';

/** Find the run active at a character position. */
function runAt<T extends { count: number }>(runs: T[], position: number): T | undefined {
	let covered = 0;
	for (const run of runs) {
		covered += run.count;
		if (position < covered) {
			return run;
		}
	}
	return runs[runs.length - 1];
}

/** Slice character runs into [start, end) segments of equal formatting. */
function sliceCharRuns(
	charRuns: PptCharProps[],
	start: number,
	end: number,
): Array<{ start: number; end: number; props: PptCharProps | undefined }> {
	if (charRuns.length === 0) {
		return [{ start, end, props: undefined }];
	}
	const segments: Array<{ start: number; end: number; props: PptCharProps | undefined }> = [];
	let runStart = 0;
	for (const run of charRuns) {
		const runEnd = runStart + run.count;
		const segStart = Math.max(start, runStart);
		const segEnd = Math.min(end, runEnd);
		if (segStart < segEnd) {
			segments.push({ start: segStart, end: segEnd, props: run });
		}
		runStart = runEnd;
		if (runStart >= end) {
			break;
		}
	}
	if (segments.length === 0) {
		segments.push({ start, end, props: charRuns[charRuns.length - 1] });
	} else {
		const last = segments[segments.length - 1];
		if (last.end < end) {
			segments.push({ start: last.end, end, props: last.props });
		}
	}
	return segments;
}

function makeRun(text: string, props: PptCharProps | undefined, fonts: string[]): PptRun {
	const run: PptRun = { text };
	if (!props) {
		return run;
	}
	if (props.bold !== undefined) {
		run.bold = props.bold;
	}
	if (props.italic !== undefined) {
		run.italic = props.italic;
	}
	if (props.underline !== undefined) {
		run.underline = props.underline;
	}
	if (props.sizePt !== undefined) {
		run.sizePt = props.sizePt;
	}
	if (props.colorRgb !== undefined) {
		run.colorRgb = props.colorRgb;
	}
	if (props.fontRef !== undefined && fonts[props.fontRef]) {
		run.fontName = fonts[props.fontRef];
	}
	return run;
}

function applyParagraphProps(
	paragraph: PptParagraph,
	props: PptParagraphProps | undefined,
	fonts: string[],
): void {
	if (!props) {
		return;
	}
	paragraph.indentLevel = props.indentLevel;
	if (props.align !== undefined) {
		paragraph.align = props.align;
	}
	if (props.hasBullet !== undefined) {
		paragraph.hasBullet = props.hasBullet;
	}
	if (props.bulletChar !== undefined) {
		paragraph.bulletChar = props.bulletChar;
	}
	if (props.bulletColorRgb !== undefined) {
		paragraph.bulletColorRgb = props.bulletColorRgb;
	}
	if (props.bulletFontRef !== undefined && fonts[props.bulletFontRef]) {
		paragraph.bulletFontName = fonts[props.bulletFontRef];
	}
	if (props.leftMarginMu !== undefined) {
		paragraph.marginLeftEmu = masterToEmu(props.leftMarginMu);
	}
	if (props.indentMu !== undefined) {
		paragraph.indentEmu = masterToEmu(props.indentMu);
	}
}

/**
 * Build the resolved text body for a raw text record.
 *
 * @param raw - Raw text (with \r paragraph marks) plus style runs.
 * @param fonts - Document font collection for FontIndexRef resolution.
 */
export function buildTextBody(raw: PptRawText, fonts: string[]): PptTextBody {
	// Normalize: treat lone \n as paragraph marks too.
	const text = raw.text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
	const paragraphTexts = text.split('\r');
	const paragraphRuns = raw.styles?.paragraphRuns ?? [];
	const charRuns = raw.styles?.charRuns ?? [];

	const paragraphs: PptParagraph[] = [];
	let offset = 0;
	for (const paragraphText of paragraphTexts) {
		const paragraph: PptParagraph = { indentLevel: 0, runs: [] };
		applyParagraphProps(paragraph, runAt(paragraphRuns, offset), fonts);

		for (const seg of sliceCharRuns(charRuns, offset, offset + paragraphText.length)) {
			const segText = paragraphText.slice(seg.start - offset, seg.end - offset);
			if (segText.length > 0) {
				paragraph.runs.push(makeRun(segText, seg.props, fonts));
			}
		}
		if (paragraph.runs.length === 0 && paragraphText.length > 0) {
			paragraph.runs.push({ text: paragraphText });
		}

		paragraphs.push(paragraph);
		offset += paragraphText.length + 1; // account for the \r
	}

	// Drop a single empty trailing paragraph caused by a terminal \r.
	if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1].runs.length === 0) {
		paragraphs.pop();
	}

	return { textType: raw.textType, paragraphs };
}
