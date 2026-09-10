/**
 * `OfficeArtClientData` / `OfficeArtClientTextbox` field extraction helpers
 * for `sp-container.ts#parseShape`, split out to stay under this repo's
 * 300-LOC file budget.
 *
 * @module ppt/escher/client-data-extract
 */

import { collectTextHyperlinkRanges } from '../hyperlink-parser';
import type { PptTextBody } from '../ppt-model';
import { findChild } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { RT } from '../record-types';
import { collectTextBodies, findOutlineTextRef } from '../text/text-atoms';
import { buildTextBody } from '../text/text-builder';
import type { DrawingContext } from './sp-container';

const PLACEHOLDER_TYPE_MAP: Record<number, string> = {
	13: 'title',
	14: 'body',
	15: 'ctrTitle',
	16: 'subTitle',
};

/** Extract the text body (including any run-level hyperlinks) from a client textbox record. */
export function extractText(
	ctx: DrawingContext,
	clientTextbox: PptRecord,
): PptTextBody | undefined {
	const start = clientTextbox.dataOffset;
	const end = clientTextbox.dataOffset + clientTextbox.recLen;
	const hyperlinkRanges = collectTextHyperlinkRanges(ctx.view, start, end, ctx.hyperlinkStrings);
	const outlineRef = findOutlineTextRef(ctx.view, start, end);
	if (outlineRef !== undefined && ctx.rawOutlineText) {
		const raw = ctx.rawOutlineText[outlineRef];
		if (raw) {
			return buildTextBody(raw, ctx.fonts, hyperlinkRanges);
		}
	}
	const bodies = collectTextBodies(ctx.view, start, end, ctx.scheme);
	if (bodies.length === 0) {
		return undefined;
	}
	return buildTextBody(bodies[0], ctx.fonts, hyperlinkRanges);
}

/** Read the placeholder type from the client data, when present. */
export function extractPlaceholder(ctx: DrawingContext, clientData: PptRecord): string | undefined {
	const placeholder = findChild(ctx.view, clientData, RT.OEPlaceholderAtom);
	if (!placeholder || placeholder.recLen < 5) {
		return undefined;
	}
	const placeholderId = ctx.view.getUint8(placeholder.dataOffset + 4);
	return PLACEHOLDER_TYPE_MAP[placeholderId];
}

/** Read the `ExObjRefAtom`'s `exObjId` from the client data, when present. */
export function extractExObjId(ctx: DrawingContext, clientData: PptRecord): number | undefined {
	const atom = findChild(ctx.view, clientData, RT.ExternalObjectRefAtom);
	if (!atom || atom.recLen < 4) {
		return undefined;
	}
	return ctx.view.getUint32(atom.dataOffset, true);
}
