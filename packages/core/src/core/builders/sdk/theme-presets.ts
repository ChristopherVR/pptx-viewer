/**
 * Pre-built theme presets for the headless PPTX SDK.
 *
 * Each preset provides a complete {@link PresentationThemeInput} that can
 * be passed directly to `Presentation.create({ theme: ThemePresets.MODERN_BLUE })`.
 *
 * @module sdk/theme-presets
 */

import type { PresentationThemeInput } from './types';

/** A single theme preset definition. */
export interface ThemePreset extends PresentationThemeInput {
	name: string;
	colors: Required<NonNullable<PresentationThemeInput['colors']>>;
	fonts: Required<NonNullable<PresentationThemeInput['fonts']>>;
}

/** Pre-built theme presets. */
export const ThemePresets = {
	/** Default Office theme (Calibri, blue accent palette). */
	OFFICE: {
		name: 'Office Theme',
		colors: {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#44546A',
			lt2: '#E7E6E6',
			accent1: '#4472C4',
			accent2: '#ED7D31',
			accent3: '#A5A5A5',
			accent4: '#FFC000',
			accent5: '#5B9BD5',
			accent6: '#70AD47',
			hlink: '#0563C1',
			folHlink: '#954F72',
		},
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},

	/** Modern blue - clean, professional look. */
	MODERN_BLUE: {
		name: 'Modern Blue',
		colors: {
			dk1: '#1B2A4A',
			lt1: '#FFFFFF',
			dk2: '#2C3E6B',
			lt2: '#F0F4F8',
			accent1: '#2563EB',
			accent2: '#3B82F6',
			accent3: '#60A5FA',
			accent4: '#93C5FD',
			accent5: '#1D4ED8',
			accent6: '#1E40AF',
			hlink: '#2563EB',
			folHlink: '#7C3AED',
		},
		fonts: { majorFont: 'Inter', minorFont: 'Inter' },
	},

	/** Warm earth tones. */
	EARTH: {
		name: 'Earth',
		colors: {
			dk1: '#2D1B0E',
			lt1: '#FFF8F0',
			dk2: '#4A3728',
			lt2: '#F5EDE4',
			accent1: '#B45309',
			accent2: '#D97706',
			accent3: '#92400E',
			accent4: '#78716C',
			accent5: '#059669',
			accent6: '#0D9488',
			hlink: '#B45309',
			folHlink: '#7C2D12',
		},
		fonts: { majorFont: 'Georgia', minorFont: 'Georgia' },
	},

	/** High contrast monochrome. */
	MONOCHROME: {
		name: 'Monochrome',
		colors: {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#1A1A1A',
			lt2: '#F5F5F5',
			accent1: '#333333',
			accent2: '#555555',
			accent3: '#777777',
			accent4: '#999999',
			accent5: '#BBBBBB',
			accent6: '#DDDDDD',
			hlink: '#0066CC',
			folHlink: '#551A8B',
		},
		fonts: { majorFont: 'Helvetica Neue', minorFont: 'Helvetica Neue' },
	},

	/** Vibrant and energetic. */
	VIBRANT: {
		name: 'Vibrant',
		colors: {
			dk1: '#1A1A2E',
			lt1: '#FFFFFF',
			dk2: '#16213E',
			lt2: '#F8F9FA',
			accent1: '#E94560',
			accent2: '#0F3460',
			accent3: '#533483',
			accent4: '#F9A826',
			accent5: '#2ECC71',
			accent6: '#3498DB',
			hlink: '#E94560',
			folHlink: '#533483',
		},
		fonts: { majorFont: 'Montserrat', minorFont: 'Open Sans' },
	},

	/** Professional corporate look. */
	CORPORATE: {
		name: 'Corporate',
		colors: {
			dk1: '#003366',
			lt1: '#FFFFFF',
			dk2: '#1A3A5C',
			lt2: '#EEF2F7',
			accent1: '#0056A3',
			accent2: '#00875A',
			accent3: '#CF4500',
			accent4: '#6B778C',
			accent5: '#004C97',
			accent6: '#006644',
			hlink: '#0056A3',
			folHlink: '#403294',
		},
		fonts: { majorFont: 'Arial', minorFont: 'Arial' },
	},

	/** Minimalist with soft pastels. */
	MINIMAL: {
		name: 'Minimal',
		colors: {
			dk1: '#2D3436',
			lt1: '#FFFFFF',
			dk2: '#636E72',
			lt2: '#F9FAFB',
			accent1: '#6C5CE7',
			accent2: '#A29BFE',
			accent3: '#74B9FF',
			accent4: '#55EFC4',
			accent5: '#FFEAA7',
			accent6: '#FAB1A0',
			hlink: '#6C5CE7',
			folHlink: '#A29BFE',
		},
		fonts: { majorFont: 'SF Pro Display', minorFont: 'SF Pro Text' },
	},

	/** Dark mode theme. */
	DARK: {
		name: 'Dark',
		colors: {
			dk1: '#E4E4E7',
			lt1: '#18181B',
			dk2: '#A1A1AA',
			lt2: '#27272A',
			accent1: '#3B82F6',
			accent2: '#8B5CF6',
			accent3: '#EC4899',
			accent4: '#F59E0B',
			accent5: '#10B981',
			accent6: '#06B6D4',
			hlink: '#60A5FA',
			folHlink: '#A78BFA',
		},
		fonts: { majorFont: 'Inter', minorFont: 'Inter' },
	},
} as const satisfies Record<string, ThemePreset>;

/** Type representing the names of available theme presets. */
export type ThemePresetName = keyof typeof ThemePresets;

/** Get a theme preset by name string. */
export function getThemePreset(name: ThemePresetName): ThemePreset {
	return ThemePresets[name];
}
