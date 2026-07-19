/**
 * theme-gallery-presets: the exact theme set shown in the Design tab's Browse
 * Themes gallery, shared by every binding.
 *
 * This is a DIFFERENT set from core's `THEME_PRESETS`: it adds Wisp, Berlin,
 * Slice, and Dividend and omits Slate and Metropolitan, in this order:
 *
 *   office, facet, integral, ion, retrospect, organic,
 *   wisp, berlin, slice, dividend
 *
 * The six themes that also exist in core (office, facet, integral, ion,
 * organic, retrospect) are reused verbatim from core's `THEME_PRESETS` (looked
 * up by id) so their colour/font schemes stay canonical. The four gallery-only
 * themes are defined here as `PptxThemePreset` values with core's nested
 * `{ majorFont: { latin }, minorFont: { latin } }` font-scheme shape.
 */

import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset } from 'pptx-viewer-core';

/** Look up a canonical core preset by id (must exist in `THEME_PRESETS`). */
function corePreset(id: string): PptxThemePreset {
	const preset = THEME_PRESETS.find((p) => p.id === id);
	if (!preset) {
		// Core always ships these ids; throw early if a rename ever breaks that.
		throw new Error(`theme-gallery-presets: core THEME_PRESETS is missing "${id}"`);
	}
	return preset;
}

/** Wisp (gallery-only): soft warm reds and muted greens. */
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

/** Berlin (gallery-only): cool teal base with a broad pastel accent spread. */
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

/** Slice (gallery-only): deep navy with vivid orange and magenta accents. */
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

/** Dividend (gallery-only): rich plum-to-gold gradient of warm accents. */
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
 * The gallery theme set, in canonical order. Six canonical core presets plus
 * the four gallery-only additions.
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
