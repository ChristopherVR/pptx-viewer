/**
 * `PptxElementBase` -> EMU rectangle, preferring the exact EMU integers the
 * element was parsed with (or authored with) over re-quantizing pixels.
 *
 * @module ppt/writer/element-rect
 */

import { EMU_PER_PX } from '../../constants';
import type { PptxElementBase } from '../../types/element-base';
import type { WRect } from './write-model';

/** Resolve an element's bounding rectangle in EMU. */
export function elementRectEmu(el: PptxElementBase): WRect {
	return {
		x: el.xEmu ?? Math.round(el.x * EMU_PER_PX),
		y: el.yEmu ?? Math.round(el.y * EMU_PER_PX),
		w: el.widthEmu ?? Math.round(el.width * EMU_PER_PX),
		h: el.heightEmu ?? Math.round(el.height * EMU_PER_PX),
	};
}

/**
 * `el` without its parsed EMU geometry, so {@link elementRectEmu} falls back
 * to its pixel geometry. A group member's pixels are local to its group
 * (origin at the group's top-left, in the group's own size), while its parsed
 * EMU are raw `a:chOff`/`a:chExt` child-space values; the `.ppt` group
 * writer needs every member in ONE space, the group-local one.
 */
export function withoutEmuGeometry<T extends PptxElementBase>(el: T): T {
	const copy = { ...el };
	delete copy.xEmu;
	delete copy.yEmu;
	delete copy.widthEmu;
	delete copy.heightEmu;
	return copy;
}
