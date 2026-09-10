/**
 * `<p:graphicFrame>`/`<p:oleObj>` XML for a `PptOleObject` shape, split out
 * of `shape-writer.ts` to stay under this repo's 300-LOC file budget.
 *
 * Emits the canonical `p:graphicFrame > a:graphic > a:graphicData uri="…/ole"
 * > p:oleObj` envelope per ECMA-376 §19.3.1.34 / §13.3.4, the same shape
 * `save-shape-xml-ole.ts#buildOleGraphicFrameXml` builds for the normal
 * OOXML save path: the embed relationship + part this module references are
 * then read back by the SAME existing OOXML load code
 * (`PptxHandlerRuntimeLoadSession.ts`), so this module only needs to emit a
 * schema-valid envelope, not re-derive the embedded payload's real file
 * name/type itself.
 *
 * @module ppt/pptx/shape-writer-ole
 */

import type { PptOleObject } from '../ppt-model';
import { cNvPrXml, xfrmXml } from './shape-writer-context';
import type { ShapeWriterContext } from './shape-writer-context';
import { emu, esc } from './xml-utils';

const OLE_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';

/** A plain `<p:pic>` fallback, identical in shape to `shape-writer.ts#picXml`. */
function fallbackPicXml(ole: PptOleObject, ctx: ShapeWriterContext): string {
	const media = ctx.mediaRel(ole.pictureIndex);
	if (!media) {
		return '';
	}
	const id = ctx.nextId();
	const name = esc(ole.name ?? `Picture ${id}`);
	return (
		`<p:pic>` +
		`<p:nvPicPr>${cNvPrXml(id, name, ole.actionClick, ctx)}<p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
		`<p:blipFill><a:blip r:embed="${media.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
		`<p:spPr>${xfrmXml(ole)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
		`</p:pic>`
	);
}

/**
 * Serialize an OLE object shape. Falls back to a plain picture frame (the
 * same preview image) when the package writer could not resolve an
 * embedding relationship for this `exObjId` (e.g. the ExOleObjStg failed to
 * decompress): degrading to a static picture, exactly like this writer's own
 * `.ppt` output degrades an unrecoverable embed, beats dropping the shape.
 */
export function oleXml(ole: PptOleObject, ctx: ShapeWriterContext): string {
	const embed = ctx.oleRel(ole.exObjId);
	if (!embed) {
		return fallbackPicXml(ole, ctx);
	}

	const id = ctx.nextId();
	const name = esc(ole.name ?? `Object ${id}`);
	const anchor = ole.anchor ?? { x: 0, y: 0, w: 0, h: 0 };
	const cx = Math.max(0, emu(anchor.w));
	const cy = Math.max(0, emu(anchor.h));
	const media = ctx.mediaRel(ole.pictureIndex);
	const blip = media ? `<a:blip r:embed="${media.relId}"/>` : '<a:blip/>';
	const progIdAttr = embed.progId ? ` progId="${esc(embed.progId)}"` : '';
	const clsIdAttr = embed.clsId ? ` classid="${esc(embed.clsId)}"` : '';

	const pic =
		`<p:pic><p:nvPicPr><p:cNvPr id="0" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
		`<p:blipFill>${blip}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
		`<p:spPr>${xfrmXml(ole)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
	const oleObj =
		`<p:oleObj showAsIcon="0"${progIdAttr}${clsIdAttr} r:id="${embed.relId}" imgW="${cx}" imgH="${cy}">` +
		`<p:embed/>${pic}</p:oleObj>`;

	return (
		`<p:graphicFrame>` +
		`<p:nvGraphicFramePr>${cNvPrXml(id, name, ole.actionClick, ctx)}` +
		`<p:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></p:cNvGraphicFramePr>` +
		`<p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${emu(anchor.x)}" y="${emu(anchor.y)}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="${OLE_GRAPHIC_DATA_URI}">${oleObj}</a:graphicData></a:graphic>` +
		`</p:graphicFrame>`
	);
}
