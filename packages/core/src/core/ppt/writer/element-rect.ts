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
