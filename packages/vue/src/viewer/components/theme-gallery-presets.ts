/**
 * Theme-gallery preset list for the Vue Design ▸ Browse Themes gallery.
 *
 * This mirrors React's built-in gallery set (`toolbar/theme-gallery-data.ts`)
 * so the Vue gallery shows the EXACT same themes in the same order:
 *
 *   office, facet, integral, ion, retrospect, organic,
 *   wisp, berlin, slice, dividend
 *
 * The six themes that already ship in core's `THEME_PRESETS`
 * (office / facet / integral / ion / organic / retrospect) are reused verbatim
 * from core so their colours and fonts stay canonical. The four extra gallery
 * themes (wisp / berlin / slice / dividend) are defined here, with colour
 * schemes copied from React and the flat React font pairs converted into core's
 * nested `PptxThemeFontScheme` shape (`{ latin: 'X' }`).
 *
 * Note the gallery deliberately ADDS wisp/berlin/slice/dividend and OMITS core's
 * slate/metropolitan, matching React.
 */
import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset } from 'pptx-viewer-core';

/** Look up a canonical core preset by id (must exist in `THEME_PRESETS`). */
function corePreset(id: string): PptxThemePreset {
	const preset = THEME_PRESETS.find((p) => p.id === id);
	if (!preset) {
		throw new Error(`theme-gallery-presets: missing core preset "${id}"`);
	}
	return preset;
}

/** Wisp — soft warm reds and muted greens. */
const WISP_PRESET: PptxThemePreset = {
	id: 'wisp',
	name: 'Wisp',
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#46393B',
		lt2: '#E8DCD8',
		accent1: '#A53010',
		accent2: '#DE7E18',
		accent3: '#9F8351',
		accent4: '#728653',
		accent5: '#92AA4C',
		accent6: '#6AAC91',
		hlink: '#FB4F14',
		folHlink: '#E25839',
	},
	fontScheme: {
		majorFont: { latin: 'Century Gothic' },
		minorFont: { latin: 'Century Gothic' },
	},
};

/** Berlin — cool teal base with a broad pastel accent spread. */
const BERLIN_PRESET: PptxThemePreset = {
	id: 'berlin',
	name: 'Berlin',
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#3E5C61',
		lt2: '#D5E0D0',
		accent1: '#F09415',
		accent2: '#C1B56B',
		accent3: '#89C2A3',
		accent4: '#729BBE',
		accent5: '#9A90C2',
		accent6: '#BE8DBE',
		hlink: '#25A0DA',
		folHlink: '#FF7F00',
	},
	fontScheme: {
		majorFont: { latin: 'Trebuchet MS' },
		minorFont: { latin: 'Trebuchet MS' },
	},
};

/** Slice — deep navy with vivid orange and magenta accents. */
const SLICE_PRESET: PptxThemePreset = {
	id: 'slice',
	name: 'Slice',
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#2E3B4C',
		lt2: '#C7CDD3',
		accent1: '#E2751D',
		accent2: '#C53B23',
		accent3: '#A13D69',
		accent4: '#58599E',
		accent5: '#36749D',
		accent6: '#4EA39A',
		hlink: '#FD6B32',
		folHlink: '#D14D0F',
	},
	fontScheme: {
		majorFont: { latin: 'Century Gothic' },
		minorFont: { latin: 'Century Gothic' },
	},
};

/** Dividend — rich plum-to-gold gradient of warm accents. */
const DIVIDEND_PRESET: PptxThemePreset = {
	id: 'dividend',
	name: 'Dividend',
	colorScheme: {
		dk1: '#000000',
		lt1: '#FFFFFF',
		dk2: '#3D3D3D',
		lt2: '#E1E1E1',
		accent1: '#4D1434',
		accent2: '#903163',
		accent3: '#B2324B',
		accent4: '#D34817',
		accent5: '#E8971C',
		accent6: '#FDCB00',
		hlink: '#A03068',
		folHlink: '#C34882',
	},
	fontScheme: {
		majorFont: { latin: 'Gill Sans MT' },
		minorFont: { latin: 'Gill Sans MT' },
	},
};

/**
 * The gallery's built-in themes, in React's exact order. The first six are the
 * canonical core presets; the last four are the gallery-only additions.
 */
export const GALLERY_THEME_PRESETS: readonly PptxThemePreset[] = [
	corePreset('office'),
	corePreset('facet'),
	corePreset('integral'),
	corePreset('ion'),
	corePreset('retrospect'),
	corePreset('organic'),
	WISP_PRESET,
	BERLIN_PRESET,
	SLICE_PRESET,
	DIVIDEND_PRESET,
];
