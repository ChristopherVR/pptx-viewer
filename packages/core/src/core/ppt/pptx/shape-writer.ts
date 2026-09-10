/**
 * Shape tree (p:spTree children) XML generation for converted .ppt shapes.
 *
 * @module ppt/pptx/shape-writer
 */

import type { PptAnyShape, PptGroup, PptPicture, PptShape } from '../ppt-model';
import { cNvPrXml, xfrmXml } from './shape-writer-context';
import type { ShapeWriterContext } from './shape-writer-context';
import { oleXml } from './shape-writer-ole';
import { txBodyXml } from './txbody-writer';
import { emu, esc, solidFill } from './xml-utils';

export type { MediaRef, OleRef, ShapeWriterContext } from './shape-writer-context';

function fillXml(shape: PptShape): string {
	if (!shape.fill) {
		return '';
	}
	return shape.fill.kind === 'solid' ? solidFill(shape.fill.rgb) : '<a:noFill/>';
}

function lineXml(shape: PptShape): string {
	if (!shape.line) {
		return '';
	}
	if (shape.line.kind === 'noLine') {
		return '<a:ln><a:noFill/></a:ln>';
	}
	const line = shape.line;
	let inner = solidFill(line.rgb);
	if (line.dash) {
		inner += `<a:prstDash val="${line.dash}"/>`;
	}
	if (line.headArrow) {
		inner += `<a:headEnd type="${line.headArrow}"/>`;
	}
	if (line.tailArrow) {
		inner += `<a:tailEnd type="${line.tailArrow}"/>`;
	}
	return `<a:ln w="${Math.max(0, emu(line.widthEmu))}">${inner}</a:ln>`;
}

function spXml(shape: PptShape, ctx: ShapeWriterContext): string {
	const id = ctx.nextId();
	const name = esc(shape.name ?? `Shape ${id}`);
	const ph = shape.placeholderType ? `<p:ph type="${shape.placeholderType}"/>` : '';
	const nv =
		`<p:nvSpPr>${cNvPrXml(id, name, shape.actionClick, ctx)}` +
		`<p:cNvSpPr${shape.text && !shape.placeholderType ? ' txBox="1"' : ''}/>` +
		`<p:nvPr>${ph}</p:nvPr></p:nvSpPr>`;
	const spPr = `<p:spPr>${xfrmXml(
		shape,
	)}<a:prstGeom prst="${shape.preset}"><a:avLst/></a:prstGeom>${fillXml(shape)}${lineXml(
		shape,
	)}</p:spPr>`;
	const body = shape.text
		? txBodyXml(shape.text, ctx)
		: '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>';
	return `<p:sp>${nv}${spPr}${body}</p:sp>`;
}

function cxnXml(shape: PptShape, ctx: ShapeWriterContext): string {
	const id = ctx.nextId();
	const name = esc(shape.name ?? `Connector ${id}`);
	const nv = `<p:nvCxnSpPr>${cNvPrXml(id, name, shape.actionClick, ctx)}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`;
	const spPr = `<p:spPr>${xfrmXml(
		shape,
	)}<a:prstGeom prst="${shape.preset}"><a:avLst/></a:prstGeom>${fillXml(shape)}${lineXml(
		shape,
	)}</p:spPr>`;
	return `<p:cxnSp>${nv}${spPr}</p:cxnSp>`;
}

export function picXml(picture: PptPicture, ctx: ShapeWriterContext): string {
	const media = ctx.mediaRel(picture.pictureIndex);
	if (!media) {
		return '';
	}
	const id = ctx.nextId();
	const name = esc(picture.name ?? `Picture ${id}`);
	return (
		`<p:pic>` +
		`<p:nvPicPr>${cNvPrXml(id, name, picture.actionClick, ctx)}<p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
		`<p:blipFill><a:blip r:embed="${media.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
		`<p:spPr>${xfrmXml(picture)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`</p:spPr>` +
		`</p:pic>`
	);
}

function grpXml(group: PptGroup, ctx: ShapeWriterContext): string {
	const id = ctx.nextId();
	const anchor = group.anchor ?? group.childRect;
	const child = group.childRect;
	const inner =
		`<a:chOff x="${emu(child.x)}" y="${emu(child.y)}"/>` +
		`<a:chExt cx="${Math.max(0, emu(child.w))}" cy="${Math.max(0, emu(child.h))}"/>`;
	return (
		`<p:grpSp>` +
		`<p:nvGrpSpPr>${cNvPrXml(id, `Group ${id}`, group.actionClick, ctx)}<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr>${xfrmXml({ ...group, anchor }, inner)}</p:grpSpPr>${group.children
			.map((c) => shapeXml(c, ctx))
			.join('')}</p:grpSp>`
	);
}

/**
 * Serialize a parsed shape into its spTree XML.
 */
export function shapeXml(shape: PptAnyShape, ctx: ShapeWriterContext): string {
	if (shape.kind === 'picture') {
		return picXml(shape, ctx);
	}
	if (shape.kind === 'ole') {
		return oleXml(shape, ctx);
	}
	if (shape.kind === 'group') {
		return grpXml(shape, ctx);
	}
	if (shape.isConnector && !shape.text) {
		return cxnXml(shape, ctx);
	}
	return spXml(shape, ctx);
}
