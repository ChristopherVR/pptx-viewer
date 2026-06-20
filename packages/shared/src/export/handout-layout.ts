/**
 * Pure handout layout calculations, shared by every binding's print path.
 *
 * Handles distributing slides across pages, computing grid dimensions, and
 * positioning cells within A4 page space. No DOM/framework dependency: callers
 * render the resulting rectangles however their view layer prefers.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Supported slides-per-page values. */
export type HandoutSlidesPerPage = 1 | 2 | 3 | 4 | 6 | 9;

/** Grid dimensions for a handout layout. */
export interface HandoutGrid {
	rows: number;
	columns: number;
}

/** A4 page dimensions in mm. */
export interface PageDimensions {
	width: number;
	height: number;
	marginTop: number;
	marginRight: number;
	marginBottom: number;
	marginLeft: number;
}

/** Computed cell position within a handout page. */
export interface HandoutCellPosition {
	/** Zero-based index of the slide in the source array (or -1 for empty). */
	slideIndex: number;
	/** Row in the grid (0-based). */
	row: number;
	/** Column in the grid (0-based). */
	col: number;
	/** X offset in mm from the printable area left edge. */
	x: number;
	/** Y offset in mm from the printable area top edge. */
	y: number;
	/** Width of the cell in mm. */
	width: number;
	/** Height of the cell in mm. */
	height: number;
}

/** A single page of a handout layout. */
export interface HandoutPage {
	pageIndex: number;
	cells: HandoutCellPosition[];
	/** Whether this layout includes note lines (3-per-page). */
	hasNoteLines: boolean;
}

/** Page orientation for handout/notes layouts. */
export type HandoutOrientation = 'portrait' | 'landscape';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Standard A4 portrait dimensions in mm. */
export const A4_PORTRAIT: PageDimensions = {
	width: 210,
	height: 297,
	marginTop: 12,
	marginRight: 12,
	marginBottom: 12,
	marginLeft: 12,
};

/** Standard A4 landscape dimensions in mm. */
export const A4_LANDSCAPE: PageDimensions = {
	width: 297,
	height: 210,
	marginTop: 12,
	marginRight: 12,
	marginBottom: 12,
	marginLeft: 12,
};

/** Available slides-per-page choices. */
export const HANDOUT_OPTIONS: HandoutSlidesPerPage[] = [1, 2, 3, 4, 6, 9];

/** Type guard: is the given number one of the supported slides-per-page values? */
export function isHandoutSlidesPerPage(value: number): value is HandoutSlidesPerPage {
	return (HANDOUT_OPTIONS as number[]).includes(value);
}

/** Gap between cells in mm. */
const CELL_GAP = 4;

/** Width fraction for the slide column in 3-per-page layout (rest is note lines). */
const THREE_PER_PAGE_SLIDE_FRACTION = 0.45;

/* ------------------------------------------------------------------ */
/*  Grid mapping                                                       */
/* ------------------------------------------------------------------ */

const GRID_MAP: Record<number, HandoutGrid> = {
	1: { rows: 1, columns: 1 },
	2: { rows: 2, columns: 1 },
	3: { rows: 3, columns: 1 },
	4: { rows: 2, columns: 2 },
	6: { rows: 3, columns: 2 },
	9: { rows: 3, columns: 3 },
};

/** Return grid dimensions for the given slides-per-page value. */
export function getHandoutGrid(slidesPerPage: number): HandoutGrid {
	return GRID_MAP[slidesPerPage] ?? { rows: 3, columns: 2 };
}

/* ------------------------------------------------------------------ */
/*  Page count                                                         */
/* ------------------------------------------------------------------ */

/** Calculate the number of pages needed for the given slide count and layout. */
export function computePageCount(slideCount: number, slidesPerPage: HandoutSlidesPerPage): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.ceil(slideCount / slidesPerPage);
}

/* ------------------------------------------------------------------ */
/*  Cell positions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compute the cell positions for a single handout page.
 *
 * For 3-per-page layout, slides are placed in a left column with note lines on
 * the right.
 */
export function computePageCells(
	pageIndex: number,
	slidesPerPage: HandoutSlidesPerPage,
	totalSlides: number,
	startSlideIndex: number,
	page: PageDimensions = A4_PORTRAIT,
): HandoutPage {
	const grid = getHandoutGrid(slidesPerPage);
	const printableWidth = page.width - page.marginLeft - page.marginRight;
	const printableHeight = page.height - page.marginTop - page.marginBottom;
	const isThreePerPage = slidesPerPage === 3;

	const cells: HandoutCellPosition[] = [];

	if (isThreePerPage) {
		// 3-per-page: left column for slides, right column for note lines
		const slideAreaWidth = printableWidth * THREE_PER_PAGE_SLIDE_FRACTION;
		const cellHeight = (printableHeight - CELL_GAP * (grid.rows - 1)) / grid.rows;

		for (let row = 0; row < grid.rows; row++) {
			const slideIdx = startSlideIndex + row;
			cells.push({
				slideIndex: slideIdx < totalSlides ? slideIdx : -1,
				row,
				col: 0,
				x: 0,
				y: row * (cellHeight + CELL_GAP),
				width: slideAreaWidth,
				height: cellHeight,
			});
		}
	} else {
		// General grid layout
		const cellWidth = (printableWidth - CELL_GAP * (grid.columns - 1)) / grid.columns;
		const cellHeight = (printableHeight - CELL_GAP * (grid.rows - 1)) / grid.rows;

		let cellIndex = 0;
		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.columns; col++) {
				const slideIdx = startSlideIndex + cellIndex;
				cells.push({
					slideIndex: slideIdx < totalSlides ? slideIdx : -1,
					row,
					col,
					x: col * (cellWidth + CELL_GAP),
					y: row * (cellHeight + CELL_GAP),
					width: cellWidth,
					height: cellHeight,
				});
				cellIndex++;
			}
		}
	}

	return {
		pageIndex,
		cells,
		hasNoteLines: isThreePerPage,
	};
}

/* ------------------------------------------------------------------ */
/*  Full layout                                                        */
/* ------------------------------------------------------------------ */

/**
 * Compute the complete handout layout: all pages with positioned cells.
 *
 * @param slideIndices Array of slide indices to include in the handout.
 * @param slidesPerPage Number of slides per page.
 * @param orientation Page orientation.
 */
export function computeHandoutLayout(
	slideIndices: number[],
	slidesPerPage: HandoutSlidesPerPage,
	orientation: HandoutOrientation = 'portrait',
): HandoutPage[] {
	const totalSlides = slideIndices.length;
	if (totalSlides === 0) {
		return [];
	}

	const pageDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
	const pageCount = computePageCount(totalSlides, slidesPerPage);
	const pages: HandoutPage[] = [];

	for (let p = 0; p < pageCount; p++) {
		const startSlideIndex = p * slidesPerPage;
		const page = computePageCells(p, slidesPerPage, totalSlides, startSlideIndex, pageDimensions);
		// Remap cell slideIndex to actual slide indices
		const remappedCells = page.cells.map((cell) => ({
			...cell,
			slideIndex:
				cell.slideIndex >= 0 && cell.slideIndex < totalSlides ? slideIndices[cell.slideIndex] : -1,
		}));
		pages.push({ ...page, cells: remappedCells });
	}

	return pages;
}

/** Get the printable area dimensions for the given orientation. */
export function getPrintableArea(orientation: HandoutOrientation = 'portrait'): {
	width: number;
	height: number;
} {
	const page = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
	return {
		width: page.width - page.marginLeft - page.marginRight,
		height: page.height - page.marginTop - page.marginBottom,
	};
}

/**
 * Number of horizontal ruled lines to draw in the 3-per-page handout layout.
 */
export function generateNoteLineCount(): number {
	return 8;
}
