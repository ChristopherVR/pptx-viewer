import type { ViewerTheme } from 'pptx-angular-viewer';
import { vermilionDarkTheme, vermilionLightTheme } from 'pptx-angular-viewer';

/**
 * Demo theme presets.
 *
 * Mirrors the React demo's `themes` object (demos/demo-react/main.tsx) one for
 * one: four presets (dark, light, midnight, sepia), each carrying the full
 * ~19-key semantic colour palette so the viewer and the demo chrome resolve
 * every CSS variable. Keep this in sync with the React source of truth.
 */
export interface ThemePreset {
	label: string;
	theme: ViewerTheme;
}

export const THEMES: Record<string, ThemePreset> = {
	dark: {
		label: 'Dark',
		theme: {
			colors: {
				background: '#030712',
				foreground: '#f3f4f6',
				card: '#111827',
				cardForeground: '#f3f4f6',
				popover: '#111827',
				popoverForeground: '#f3f4f6',
				primary: '#6366f1',
				primaryForeground: '#ffffff',
				secondary: '#1f2937',
				secondaryForeground: '#f3f4f6',
				muted: '#1f2937',
				mutedForeground: '#9ca3af',
				accent: '#1f2937',
				accentForeground: '#f3f4f6',
				destructive: '#ef4444',
				destructiveForeground: '#ffffff',
				border: '#374151',
				input: '#374151',
				ring: '#6366f1',
			},
		},
	},
	light: {
		label: 'Light',
		theme: {
			colors: {
				background: '#f8fafc',
				foreground: '#0f172a',
				card: '#ffffff',
				cardForeground: '#0f172a',
				popover: '#ffffff',
				popoverForeground: '#0f172a',
				primary: '#4f46e5',
				primaryForeground: '#ffffff',
				secondary: '#f1f5f9',
				secondaryForeground: '#0f172a',
				muted: '#f1f5f9',
				mutedForeground: '#64748b',
				accent: '#f1f5f9',
				accentForeground: '#0f172a',
				destructive: '#dc2626',
				destructiveForeground: '#ffffff',
				border: '#e2e8f0',
				input: '#e2e8f0',
				ring: '#4f46e5',
			},
		},
	},
	midnight: {
		label: 'Midnight Blue',
		theme: {
			colors: {
				background: '#0c1222',
				foreground: '#e2e8f0',
				card: '#162032',
				cardForeground: '#e2e8f0',
				popover: '#162032',
				popoverForeground: '#e2e8f0',
				primary: '#38bdf8',
				primaryForeground: '#0c1222',
				secondary: '#1e3a5f',
				secondaryForeground: '#e2e8f0',
				muted: '#1e3a5f',
				mutedForeground: '#7dd3fc',
				accent: '#1e3a5f',
				accentForeground: '#e2e8f0',
				destructive: '#f87171',
				destructiveForeground: '#ffffff',
				border: '#1e3a5f',
				input: '#1e3a5f',
				ring: '#38bdf8',
			},
		},
	},
	sepia: {
		label: 'Warm Sepia',
		theme: {
			colors: {
				background: '#faf6f1',
				foreground: '#292524',
				card: '#ffffff',
				cardForeground: '#292524',
				popover: '#ffffff',
				popoverForeground: '#292524',
				primary: '#b45309',
				primaryForeground: '#ffffff',
				secondary: '#f5f0eb',
				secondaryForeground: '#292524',
				muted: '#f5f0eb',
				mutedForeground: '#78716c',
				accent: '#f5f0eb',
				accentForeground: '#292524',
				destructive: '#dc2626',
				destructiveForeground: '#ffffff',
				border: '#d6d3d1',
				input: '#d6d3d1',
				ring: '#b45309',
			},
		},
	},
	vermilionDark: {
		label: 'Vermilion Dark',
		theme: vermilionDarkTheme,
	},
	vermilionLight: {
		label: 'Vermilion Light',
		theme: vermilionLightTheme,
	},
};

export const THEME_KEYS = Object.keys(THEMES);

/** Persisted-theme localStorage key (shared with the React demo). */
export const THEME_STORAGE_KEY = 'pptx-demo-theme';

/** Read the persisted theme key, defaulting to `dark`. */
export function restoreThemeKey(): string {
	try {
		return localStorage.getItem(THEME_STORAGE_KEY) ?? 'dark';
	} catch {
		return 'dark';
	}
}

/** Persist the selected theme key (best-effort; ignores storage failures). */
export function persistThemeKey(key: string): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, key);
	} catch {
		/* ignore */
	}
}
