/**
 * slide-size.ts: the Design > Slide Size decision function.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 *
 * ## Why the dimensions, not the `type`, are the source of truth
 *
 * `p:sldSz` carries `@cx`, `@cy` and an optional `@type` (ST_SlideSizeType).
 * It is tempting to treat `@type` as the selection and the dimensions as a
 * derived detail. PowerPoint does the opposite. Measured through COM: a deck
 * whose `p:sldSz` said `type="A4"` while carrying 4:3 dimensions reported
 * `PageSetup.SlideSize = ppSlideSizeCustom`, and the same deck with A4
 * dimensions and NO `@type` at all reported `ppSlideSizeA4Paper`. So every
 * preset below is defined by its EMU pair, and `@type` is written alongside
 * for fidelity only.
 *
 * Each `emuWidth`/`emuHeight` pair here was confirmed by writing it into a
 * real package and asking PowerPoint what preset it saw (the `ppSlideSize*`
 * value in the `comValue` field). Two entries are exceptions and say so.
 */

/** EMU per CSS pixel, matching `pptx-viewer-core`'s `EMU_PER_PIXEL`. */
const EMU_PER_PIXEL = 9525;

export type SlideSizeOrientation = 'landscape' | 'portrait';

export interface SlideSizeEmu {
	widthEmu: number;
	heightEmu: number;
	/** ST_SlideSizeType token, or `''` for a size with no preset. */
	type: string;
}

export interface SlideSizePreset {
	/** `p:sldSz/@type` (ST_SlideSizeType). `custom` is the schema default. */
	readonly type: string;
	/** i18n key under `pptx.slideSize.presets`. */
	readonly labelKey: string;
	/** Landscape width in EMU. Portrait swaps the pair. */
	readonly widthEmu: number;
	/** Landscape height in EMU. */
	readonly heightEmu: number;
	/**
	 * The `PpSlideSizeType` value PowerPoint reports for these dimensions,
	 * or `undefined` where that could not be confirmed.
	 */
	readonly comValue?: number;
}

/**
 * The 16 ST_SlideSizeType values, in PowerPoint's own menu order, plus the
 * modern 16:9 default that PowerPoint itself reports as `custom`.
 *
 * `letter` and `overhead` share `screen4x3`'s 10 x 7.5in slide, which is why
 * all three report `ppSlideSizeOnScreen`: PowerPoint sizes the SLIDE, not the
 * paper, and only the paper differs.
 */
export const SLIDE_SIZE_PRESETS: readonly SlideSizePreset[] = [
	{
		type: 'screen4x3',
		labelKey: 'screen4x3',
		widthEmu: 9144000,
		heightEmu: 6858000,
		comValue: 1,
	},
	{
		type: 'screen16x9',
		labelKey: 'screen16x9',
		widthEmu: 9144000,
		heightEmu: 5143500,
		comValue: 15,
	},
	{
		type: 'screen16x10',
		labelKey: 'screen16x10',
		widthEmu: 9144000,
		heightEmu: 5715000,
		comValue: 16,
	},
	// PowerPoint's own "Widescreen" default. It has no ST_SlideSizeType of its
	// own - PowerPoint writes no `@type` and reports ppSlideSizeCustom - but
	// it is the size most decks are actually authored at, so it is offered.
	{ type: '', labelKey: 'widescreen', widthEmu: 12192000, heightEmu: 6858000, comValue: 7 },
	{ type: 'letter', labelKey: 'letter', widthEmu: 9144000, heightEmu: 6858000, comValue: 1 },
	{ type: 'ledger', labelKey: 'ledger', widthEmu: 12179300, heightEmu: 9134475, comValue: 8 },
	{ type: 'A3', labelKey: 'a3', widthEmu: 12801600, heightEmu: 9601200, comValue: 9 },
	{ type: 'A4', labelKey: 'a4', widthEmu: 9906000, heightEmu: 6858000, comValue: 3 },
	{ type: 'B4ISO', labelKey: 'b4Iso', widthEmu: 10826750, heightEmu: 8120063, comValue: 10 },
	{ type: 'B5ISO', labelKey: 'b5Iso', widthEmu: 7169150, heightEmu: 5376863, comValue: 11 },
	{ type: 'B4JIS', labelKey: 'b4Jis', widthEmu: 10972800, heightEmu: 8229600, comValue: 12 },
	{ type: 'B5JIS', labelKey: 'b5Jis', widthEmu: 7315200, heightEmu: 5486400, comValue: 13 },
	{ type: '35mm', labelKey: 'slide35mm', widthEmu: 10287000, heightEmu: 6858000, comValue: 4 },
	{ type: 'overhead', labelKey: 'overhead', widthEmu: 9144000, heightEmu: 6858000, comValue: 1 },
	{ type: 'banner', labelKey: 'banner', widthEmu: 7315200, heightEmu: 914400, comValue: 6 },
	// 148 x 100 mm. The English-language PowerPoint used for the sweep still
	// reported ppSlideSizeCustom for it, so the value is spec-derived rather
	// than COM-confirmed.
	{ type: 'hagakiCard', labelKey: 'hagakiCard', widthEmu: 5327650, heightEmu: 3600450 },
];

/** Landscape when width >= height, which is how PowerPoint's toggle reads. */
export function slideSizeOrientation(widthEmu: number, heightEmu: number): SlideSizeOrientation {
	return widthEmu >= heightEmu ? 'landscape' : 'portrait';
}

/**
 * Rotate a size to the requested orientation.
 *
 * PowerPoint's Portrait/Landscape toggle swaps `cx` and `cy` and nothing else,
 * so a portrait A4 deck keeps `type="A4"`.
 */
export function withSlideSizeOrientation(
	size: SlideSizeEmu,
	orientation: SlideSizeOrientation,
): SlideSizeEmu {
	if (slideSizeOrientation(size.widthEmu, size.heightEmu) === orientation) {
		return size;
	}
	return { widthEmu: size.heightEmu, heightEmu: size.widthEmu, type: size.type };
}

/**
 * The preset a size matches, ignoring orientation, or `undefined` for a size
 * the user sized by hand.
 *
 * Matching is exact. A tolerance would be worse than useless here: the
 * presets sit as little as 0.5in apart (A4 vs 35mm share a height and differ
 * by 381000 EMU in width), and PowerPoint itself matches exactly.
 */
export function matchSlideSizePreset(
	widthEmu: number,
	heightEmu: number,
): SlideSizePreset | undefined {
	const long = Math.max(widthEmu, heightEmu);
	const short = Math.min(widthEmu, heightEmu);
	return SLIDE_SIZE_PRESETS.find(
		(preset) =>
			Math.max(preset.widthEmu, preset.heightEmu) === long &&
			Math.min(preset.widthEmu, preset.heightEmu) === short,
	);
}

/** The size a preset produces in the given orientation. */
export function slideSizeFromPreset(
	preset: SlideSizePreset,
	orientation: SlideSizeOrientation,
): SlideSizeEmu {
	return withSlideSizeOrientation(
		{ widthEmu: preset.widthEmu, heightEmu: preset.heightEmu, type: preset.type },
		orientation,
	);
}

/** The canvas size in CSS pixels a viewer should render an EMU size at. */
export function slideSizeToCanvasPx(size: { widthEmu: number; heightEmu: number }): {
	width: number;
	height: number;
} {
	return {
		width: Math.round(size.widthEmu / EMU_PER_PIXEL),
		height: Math.round(size.heightEmu / EMU_PER_PIXEL),
	};
}

/** The EMU size a hand-typed pixel canvas size means. */
export function slideSizeFromCanvasPx(canvas: { width: number; height: number }): SlideSizeEmu {
	const widthEmu = Math.round(canvas.width * EMU_PER_PIXEL);
	const heightEmu = Math.round(canvas.height * EMU_PER_PIXEL);
	return {
		widthEmu,
		heightEmu,
		type: matchSlideSizePreset(widthEmu, heightEmu)?.type ?? '',
	};
}

export interface SlideSizeSelectionInput {
	/**
	 * The EMU size the viewer is holding, if it has one. Present once the deck
	 * has loaded (`PptxData.widthEmu`) or the user has picked a preset.
	 */
	readonly current?: { widthEmu: number; heightEmu: number; type?: string } | undefined;
	/** The pixel canvas size, which the raw W/H inputs edit directly. */
	readonly canvas: { width: number; height: number };
}

export interface SlideSizeSelectionDescriptor {
	/** The effective size, in EMU, that a save should persist. */
	readonly size: SlideSizeEmu;
	/** The matching preset, or `undefined` for a custom size. */
	readonly preset: SlideSizePreset | undefined;
	readonly orientation: SlideSizeOrientation;
	/** The canvas size the stage should use for this selection. */
	readonly canvas: { width: number; height: number };
}

/**
 * The single decision every binding's Slide Size control needs.
 *
 * The EMU size wins whenever it still agrees with the pixel canvas size,
 * because rounding through pixels is lossy: Ledger is 12179300 EMU, which is
 * 1278.5px, and a round-trip through an integer pixel would move it 6350 EMU
 * and cost the deck its `ppSlideSizeLedgerPaper` identity. When the two
 * disagree the user has typed into the raw W/H inputs, and the pixels win.
 */
export function resolveSlideSizeSelection(
	input: SlideSizeSelectionInput,
): SlideSizeSelectionDescriptor {
	const current = input.current;
	const currentPx = current ? slideSizeToCanvasPx(current) : undefined;
	const agrees =
		currentPx !== undefined &&
		currentPx.width === Math.round(input.canvas.width) &&
		currentPx.height === Math.round(input.canvas.height);
	const size: SlideSizeEmu =
		agrees && current
			? {
					widthEmu: current.widthEmu,
					heightEmu: current.heightEmu,
					type:
						current.type ?? matchSlideSizePreset(current.widthEmu, current.heightEmu)?.type ?? '',
				}
			: slideSizeFromCanvasPx(input.canvas);
	return {
		size,
		preset: matchSlideSizePreset(size.widthEmu, size.heightEmu),
		orientation: slideSizeOrientation(size.widthEmu, size.heightEmu),
		canvas: slideSizeToCanvasPx(size),
	};
}
