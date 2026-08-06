/**
 * Text body (a:txBody / p:txBody) XML generation for converted .ppt text.
 *
 * @module ppt/pptx/txbody-writer
 */

import type { PptParagraph, PptRun, PptTextBody } from '../ppt-model';
import { TEXT_TYPE } from '../record-types';
import { emu, esc, solidFill } from './xml-utils';

function runPropsXml(run: PptRun): string {
	const attrs: string[] = ['lang="en-US"'];
	if (run.sizePt !== undefined) {
		attrs.push(`sz="${Math.round(run.sizePt * 100)}"`);
	}
	if (run.bold) {
		attrs.push('b="1"');
	}
	if (run.italic) {
		attrs.push('i="1"');
	}
	if (run.underline) {
		attrs.push('u="sng"');
	}
	attrs.push('dirty="0"');

	let children = '';
	if (run.colorRgb !== undefined) {
		children += solidFill(run.colorRgb);
	}
	if (run.fontName !== undefined) {
		children += `<a:latin typeface="${esc(run.fontName)}"/>`;
	}
	return children.length > 0
		? `<a:rPr ${attrs.join(' ')}>${children}</a:rPr>`
		: `<a:rPr ${attrs.join(' ')}/>`;
}

function runXml(run: PptRun): string {
	// Vertical tab (0x0B) marks a soft line break inside the paragraph.
	const segments = run.text.split(String.fromCharCode(0x0b));
	const rPr = runPropsXml(run);
	return segments.map((segment) => `<a:r>${rPr}<a:t>${esc(segment)}</a:t></a:r>`).join('<a:br/>');
}

function paragraphPropsXml(paragraph: PptParagraph): string {
	const attrs: string[] = [];
	if (paragraph.indentLevel > 0) {
		attrs.push(`lvl="${Math.min(paragraph.indentLevel, 8)}"`);
	}
	if (paragraph.marginLeftEmu !== undefined) {
		attrs.push(`marL="${emu(paragraph.marginLeftEmu)}"`);
	}
	if (paragraph.indentEmu !== undefined) {
		attrs.push(`indent="${-Math.abs(emu(paragraph.indentEmu))}"`);
	}
	if (paragraph.align !== undefined) {
		attrs.push(`algn="${paragraph.align}"`);
	}

	let bullet = '';
	if (paragraph.hasBullet === false) {
		bullet = '<a:buNone/>';
	} else if (paragraph.hasBullet === true || paragraph.bulletChar !== undefined) {
		if (paragraph.bulletColorRgb !== undefined) {
			bullet += `<a:buClr><a:srgbClr val="${paragraph.bulletColorRgb}"/></a:buClr>`;
		}
		if (paragraph.bulletFontName !== undefined) {
			bullet += `<a:buFont typeface="${esc(paragraph.bulletFontName)}"/>`;
		}
		bullet += `<a:buChar char="${esc(paragraph.bulletChar ?? '•')}"/>`;
	}

	if (attrs.length === 0 && bullet.length === 0) {
		return '';
	}
	const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
	return bullet.length > 0 ? `<a:pPr${attrText}>${bullet}</a:pPr>` : `<a:pPr${attrText}/>`;
}

function paragraphXml(paragraph: PptParagraph): string {
	const parts: string[] = [paragraphPropsXml(paragraph)];
	for (const run of paragraph.runs) {
		parts.push(runXml(run));
	}
	if (paragraph.runs.length === 0) {
		parts.push('<a:endParaRPr lang="en-US"/>');
	}
	return `<a:p>${parts.join('')}</a:p>`;
}

/**
 * Generate the p:txBody XML for a converted text body.
 *
 * Title-like text types get centered anchoring; everything else keeps the
 * PowerPoint defaults.
 */
export function txBodyXml(text: PptTextBody): string {
	const isTitleLike = text.textType === TEXT_TYPE.title || text.textType === TEXT_TYPE.centerTitle;
	const bodyPr = isTitleLike
		? '<a:bodyPr wrap="square" anchor="ctr"><a:normAutofit/></a:bodyPr>'
		: '<a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr>';
	const paragraphs = text.paragraphs.map(paragraphXml).join('');
	return `<p:txBody>${bodyPr}<a:lstStyle/>${paragraphs}</p:txBody>`;
}
