/**
 * `ShapeWriterContext` (the package writer's callbacks into shape XML
 * generation) plus the small element-agnostic helpers built on it
 * (`cNvPrXml`, `xfrmXml`). Split out of `shape-writer.ts` so both it and
 * `shape-writer-ole.ts` can depend on this without depending on each other.
 *
 * @module ppt/pptx/shape-writer-context
 */

import type { PptHyperlinkTarget } from '../hyperlink-target';
import type { EmuRect } from '../ppt-model';
import { hyperlinkClickXml } from './hyperlink-xml';
import type { HyperlinkRelAllocator } from './hyperlink-xml';
import { emu } from './xml-utils';

/** Media reference resolved by the package writer. */
export interface MediaRef {
	/** Relationship id inside the containing part. */
	relId: string;
}

/** An OLE embedding part resolved by the package writer, for one `exObjId`. */
export interface OleRef {
	/** Relationship id inside the containing part. */
	relId: string;
	/** `ExOleEmbedContainer`'s `ProgIDAtom` string, when present. */
	progId?: string;
	/** The nested storage's root CLSID, when recoverable. */
	clsId?: string;
}

/** Callbacks the package writer supplies while serializing shapes. */
export interface ShapeWriterContext {
	/** Next shape id. */
	nextId(): number;
	/** Resolve a picture index to a relationship id, or undefined. */
	mediaRel(pictureIndex: number): MediaRef | undefined;
	/** Resolve an OLE embed's `exObjId` to its embedding relationship, or undefined. */
	oleRel(exObjId: number): OleRef | undefined;
	/** Relationship allocator for `a:hlinkClick` targets; see `hyperlink-xml.ts`. */
	hyperlinkRels: HyperlinkRelAllocator;
	/** Total slide count, for validating a `slide` hyperlink target's index. */
	slideCount: number;
}

/** Build a `<p:cNvPr>` element, embedding a shape-level `a:hlinkClick` when present. */
export function cNvPrXml(
	id: number,
	name: string,
	actionClick: PptHyperlinkTarget | undefined,
	ctx: ShapeWriterContext,
): string {
	const hlink = hyperlinkClickXml(actionClick, ctx.hyperlinkRels, ctx.slideCount);
	return hlink.length > 0
		? `<p:cNvPr id="${id}" name="${name}">${hlink}</p:cNvPr>`
		: `<p:cNvPr id="${id}" name="${name}"/>`;
}

export function xfrmXml(
	shape: { anchor?: EmuRect; rotationDeg?: number; flipH?: boolean; flipV?: boolean },
	inner = '',
): string {
	const anchor = shape.anchor ?? { x: 0, y: 0, w: 0, h: 0 };
	const attrs: string[] = [];
	if (shape.rotationDeg !== undefined && shape.rotationDeg !== 0) {
		attrs.push(`rot="${Math.round(shape.rotationDeg * 60000)}"`);
	}
	if (shape.flipH) {
		attrs.push('flipH="1"');
	}
	if (shape.flipV) {
		attrs.push('flipV="1"');
	}
	const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
	return (
		`<a:xfrm${attrText}>` +
		`<a:off x="${emu(anchor.x)}" y="${emu(anchor.y)}"/>` +
		`<a:ext cx="${Math.max(0, emu(anchor.w))}" cy="${Math.max(0, emu(anchor.h))}"/>${inner}</a:xfrm>`
	);
}
