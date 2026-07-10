import type { ViewerTheme } from 'pptx-svelte-viewer';
import { vermilionDarkTheme, vermilionLightTheme } from 'pptx-svelte-viewer';

/**
 * Theme presets for the Svelte demo, mirroring the vanilla demo's `themes`
 * object. Selection persists to `localStorage` under `pptx-demo-theme`
 * (see App.svelte).
 */
export interface ThemePreset {
	label: string;
	theme: ViewerTheme;
}

export const themes: Record<string, ThemePreset> = {
	vermilionDark: { label: 'Vermilion Dark', theme: vermilionDarkTheme },
	vermilionLight: { label: 'Vermilion Light', theme: vermilionLightTheme },
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
};

export const defaultThemeKey = 'vermilionDark';

export function readStoredTheme(): string {
	try {
		const stored = localStorage.getItem('pptx-demo-theme');
		return stored && stored in themes ? stored : defaultThemeKey;
	} catch {
		return defaultThemeKey;
	}
}

export function storeTheme(key: string): void {
	try {
		localStorage.setItem('pptx-demo-theme', key);
	} catch {
		/* ignore */
	}
}

/** Read a `File` into the raw bytes the viewer's `source` prop accepts. */
export function fileToBytes(file: File): Promise<Uint8Array> {
	return file.arrayBuffer().then((buf) => new Uint8Array(buf));
}
