import type { PptxTheme, PptxThemeColorScheme } from 'pptx-viewer-core';
import { PRESET_THEMES } from 'pptx-viewer-shared';
import type { PresetTheme } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

/** PowerPoint's own default theme fonts, used when a deck declares none. */
const DEFAULT_MAJOR = 'Calibri Light';
const DEFAULT_MINOR = 'Calibri';

/** The three commit channels the panel pushes each edit out through. */
export interface ThemeEditorCommits {
	onupdatecolorscheme: (colorScheme: PptxThemeColorScheme) => void;
	onupdatefontscheme: (fontScheme: {
		majorFont: { latin: string };
		minorFont: { latin: string };
	}) => void;
	onupdatename: (name: string) => void;
}

/**
 * The theme editor's working copy.
 *
 * The panel edits this copy and pushes every change out through the
 * `onupdate*` callbacks, exactly like React's `ThemeEditorPanel`: the host owns
 * the committed theme, so the panel never mutates the `theme` prop.
 *
 * `initialTheme` is captured with `untrack` at construction, which is
 * load-bearing twice over: it seeds the working copy without the read counting
 * as a reactive dependency (Svelte warns otherwise), and it pins the value
 * {@link reset} reverts to, so Reset still restores the file's theme after a
 * dozen edits have flowed back in through the `theme` prop.
 */
export class ThemeEditorState {
	readonly #commits: ThemeEditorCommits;
	readonly #initialTheme: PptxTheme | undefined;

	colors = $state<PptxThemeColorScheme>(PRESET_THEMES[0].colorScheme);
	majorFont = $state(DEFAULT_MAJOR);
	minorFont = $state(DEFAULT_MINOR);
	name = $state('Custom Theme');
	/** The swatch whose colour picker is open, or null when none is. */
	activePickerKey = $state<keyof PptxThemeColorScheme | null>(null);

	constructor(getTheme: () => PptxTheme | undefined, commits: ThemeEditorCommits) {
		this.#commits = commits;
		const initial = untrack(getTheme);
		this.#initialTheme = initial;
		this.colors = initial?.colorScheme ?? PRESET_THEMES[0].colorScheme;
		this.majorFont = initial?.fontScheme?.majorFont?.latin ?? DEFAULT_MAJOR;
		this.minorFont = initial?.fontScheme?.minorFont?.latin ?? DEFAULT_MINOR;
		this.name = initial?.name ?? 'Custom Theme';
	}

	setColor(key: keyof PptxThemeColorScheme, hex: string): void {
		this.colors = { ...this.colors, [key]: hex };
		this.#commits.onupdatecolorscheme(this.colors);
	}

	/** Accept a typed hex only once it is a complete 6-digit value. */
	setColorText(hex: string): void {
		if (this.activePickerKey && /^#[0-9a-fA-F]{6}$/u.test(hex)) {
			this.setColor(this.activePickerKey, hex);
		}
	}

	setFonts(major: string, minor: string): void {
		this.majorFont = major;
		this.minorFont = minor;
		this.#commits.onupdatefontscheme({
			majorFont: { latin: major },
			minorFont: { latin: minor },
		});
	}

	setName(name: string): void {
		this.name = name;
		this.#commits.onupdatename(name);
	}

	selectPreset(preset: PresetTheme): void {
		this.colors = preset.colorScheme;
		this.name = preset.name;
		this.#commits.onupdatecolorscheme(preset.colorScheme);
		this.setFonts(preset.majorFont, preset.minorFont);
		this.#commits.onupdatename(preset.name);
	}

	/** Revert the working copy to the theme as loaded from the file. */
	reset(): void {
		const initial = this.#initialTheme;
		if (!initial?.colorScheme) {
			return;
		}
		this.colors = initial.colorScheme;
		this.name = initial.name ?? 'Custom Theme';
		this.#commits.onupdatecolorscheme(initial.colorScheme);
		this.setFonts(
			initial.fontScheme?.majorFont?.latin ?? DEFAULT_MAJOR,
			initial.fontScheme?.minorFont?.latin ?? DEFAULT_MINOR,
		);
		this.#commits.onupdatename(this.name);
	}
}
