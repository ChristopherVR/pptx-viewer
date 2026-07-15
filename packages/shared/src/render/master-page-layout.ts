import type { CanvasSize } from '../types';

export interface MasterPageRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const DEFAULT_MASTER_PAGE_SIZE: Readonly<CanvasSize> = { width: 720, height: 960 };

export const NOTES_MASTER_PLACEHOLDER_RECTS: Readonly<Record<string, MasterPageRect>> = {
	sldImg: { x: 0.1, y: 0.05, w: 0.8, h: 0.4 },
	body: { x: 0.1, y: 0.5, w: 0.8, h: 0.4 },
	hdr: { x: 0, y: 0, w: 0.4, h: 0.04 },
	ftr: { x: 0, y: 0.96, w: 0.4, h: 0.04 },
	dt: { x: 0.6, y: 0, w: 0.4, h: 0.04 },
	sldNum: { x: 0.6, y: 0.96, w: 0.4, h: 0.04 },
};

const HANDOUT_MARGIN = 0.06;
const HANDOUT_GAP = 0.02;

/** Framework-neutral handout slot geometry, expressed as page fractions. */
export function computeHandoutSlotLayout(
	slidesPerPage: number,
	slideAspect = 4 / 3,
): MasterPageRect[] {
	const contentW = 1 - 2 * HANDOUT_MARGIN;
	const contentH = 1 - 2 * HANDOUT_MARGIN;
	if (slidesPerPage === 1) {
		const w = contentW * 0.8;
		const h = w / slideAspect;
		return [
			{
				x: HANDOUT_MARGIN + (contentW - w) / 2,
				y: HANDOUT_MARGIN + (contentH - h) / 2,
				w,
				h,
			},
		];
	}
	if (slidesPerPage === 2) {
		const w = contentW * 0.75;
		const h = w / slideAspect;
		const startY = HANDOUT_MARGIN + (contentH - (h * 2 + HANDOUT_GAP)) / 2;
		return [0, 1].map((index) => ({
			x: HANDOUT_MARGIN + (contentW - w) / 2,
			y: startY + index * (h + HANDOUT_GAP),
			w,
			h,
		}));
	}
	if (slidesPerPage === 3) {
		const w = contentW * 0.5;
		const h = w / slideAspect;
		const startY = HANDOUT_MARGIN + (contentH - (h * 3 + HANDOUT_GAP * 2)) / 2;
		return [0, 1, 2].map((index) => ({
			x: HANDOUT_MARGIN,
			y: startY + index * (h + HANDOUT_GAP),
			w,
			h,
		}));
	}
	const columns = slidesPerPage === 9 ? 3 : 2;
	const rows = slidesPerPage === 4 ? 2 : 3;
	if (![4, 6, 9].includes(slidesPerPage)) {
		return [];
	}
	const w = (contentW - HANDOUT_GAP * (columns - 1)) / columns;
	const h = w / slideAspect;
	const startY = HANDOUT_MARGIN + (contentH - (h * rows + HANDOUT_GAP * (rows - 1))) / 2;
	return Array.from({ length: slidesPerPage }, (_unused, index) => ({
		x: HANDOUT_MARGIN + (index % columns) * (w + HANDOUT_GAP),
		y: startY + Math.floor(index / columns) * (h + HANDOUT_GAP),
		w,
		h,
	}));
}
