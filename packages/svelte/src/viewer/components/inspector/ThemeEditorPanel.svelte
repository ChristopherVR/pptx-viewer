<script lang="ts">
	/**
	 * ThemeEditorPanel: full theme authoring, mirroring React's
	 * `inspector/ThemeEditorPanel.tsx` (+ its `ThemePresetGallery` and
	 * `ThemeColorSchemeEditor` children).
	 *
	 * Replaces the ad-hoc "Edit theme" disclosure this binding used to inline in
	 * `ThemeSection`, which offered raw colour inputs but none of React's
	 * preset gallery, live preview grid, curated font pair, or Reset.
	 *
	 * WHY local editing state: the panel edits a working copy and pushes each
	 * change out through `onupdate*`, exactly like React. `Reset` re-seeds that
	 * copy from the theme as loaded from the file, which is only possible while
	 * the original `theme` prop is still the untouched value; the host owns the
	 * committed theme, so this component never mutates `theme` directly.
	 *
	 * Every catalogue here (`PRESET_THEMES`, `COMMON_FONTS`, the colour labels,
	 * and the preview-grid tint/shade maths) comes from `pptx-viewer-shared`.
	 */
	import type { PptxTheme, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
	import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
	import type { PresetTheme } from 'pptx-viewer-shared';
	import {
		buildThemeColorGrid,
		COMMON_FONTS,
		PRESET_THEMES,
		THEME_COLOR_LABELS,
	} from 'pptx-viewer-shared';
	import { untrack } from 'svelte';

	import { useTranslator } from '../../../i18n/context';

	const {
		theme,
		canEdit,
		onupdatecolorscheme,
		onupdatefontscheme,
		onupdatename,
		onapply,
	}: {
		theme: PptxTheme | undefined;
		canEdit: boolean;
		onupdatecolorscheme: (colorScheme: PptxThemeColorScheme) => void;
		onupdatefontscheme: (fontScheme: PptxThemeFontScheme) => void;
		onupdatename: (name: string) => void;
		onapply: () => void;
	} = $props();
	const t = useTranslator();

	const DEFAULT_MAJOR = 'Calibri Light';
	const DEFAULT_MINOR = 'Calibri';

	// The theme AS LOADED. `untrack` is load-bearing twice over: it seeds the
	// working copy without the reference counting as a reactive read (Svelte
	// warns otherwise), and it pins the value `reset()` reverts to, so Reset
	// still restores the file's theme after a dozen edits have flowed back in
	// through the `theme` prop.
	const initialTheme = untrack(() => theme);

	// eslint-disable-next-line prefer-const
	let editColors = $state<PptxThemeColorScheme>(
		initialTheme?.colorScheme ?? PRESET_THEMES[0].colorScheme,
	);
	// eslint-disable-next-line prefer-const
	let majorFont = $state(initialTheme?.fontScheme?.majorFont?.latin ?? DEFAULT_MAJOR);
	// eslint-disable-next-line prefer-const
	let minorFont = $state(initialTheme?.fontScheme?.minorFont?.latin ?? DEFAULT_MINOR);
	// eslint-disable-next-line prefer-const
	let themeName = $state(initialTheme?.name ?? 'Custom Theme');
	// eslint-disable-next-line prefer-const
	let activePickerKey = $state<keyof PptxThemeColorScheme | null>(null);

	const previewGrid = $derived(buildThemeColorGrid(editColors));

	function setColor(key: keyof PptxThemeColorScheme, hex: string): void {
		editColors = { ...editColors, [key]: hex };
		onupdatecolorscheme(editColors);
	}

	/** Accept a typed hex only once it is a complete 6-digit value. */
	function setColorText(hex: string): void {
		if (activePickerKey && /^#[0-9a-fA-F]{6}$/.test(hex)) {
			setColor(activePickerKey, hex);
		}
	}

	function setFonts(major: string, minor: string): void {
		majorFont = major;
		minorFont = minor;
		onupdatefontscheme({ majorFont: { latin: major }, minorFont: { latin: minor } });
	}

	function setName(name: string): void {
		themeName = name;
		onupdatename(name);
	}

	function selectPreset(preset: PresetTheme): void {
		editColors = preset.colorScheme;
		themeName = preset.name;
		onupdatecolorscheme(preset.colorScheme);
		setFonts(preset.majorFont, preset.minorFont);
		onupdatename(preset.name);
	}

	/** Revert the working copy to the theme as loaded from the file. */
	function reset(): void {
		if (!initialTheme?.colorScheme) {
			return;
		}
		editColors = initialTheme.colorScheme;
		themeName = initialTheme.name ?? 'Custom Theme';
		onupdatecolorscheme(initialTheme.colorScheme);
		setFonts(
			initialTheme.fontScheme?.majorFont?.latin ?? DEFAULT_MAJOR,
			initialTheme.fontScheme?.minorFont?.latin ?? DEFAULT_MINOR,
		);
		onupdatename(themeName);
	}
</script>

<div class="pptx-svelte-theme-editor">
	<label class="pptx-svelte-theme-field">
		<span>{t('pptx.themeEditor.themeName')}</span>
		<input
			type="text"
			disabled={!canEdit}
			value={themeName}
			onchange={(event) => setName(event.currentTarget.value)}
		/>
	</label>

	<div class="pptx-svelte-theme-block">
		<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.presetThemes')}</span>
		<div class="pptx-svelte-theme-presets">
			{#each PRESET_THEMES as preset (preset.name)}
				<button
					type="button"
					disabled={!canEdit}
					title={preset.name}
					aria-label={preset.name}
					aria-pressed={themeName === preset.name}
					class:pptx-svelte-theme-preset-active={themeName === preset.name}
					onclick={() => selectPreset(preset)}
				>
					<span class="pptx-svelte-theme-preset-strip">
						{#each ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const as key (key)}
							<span style={`background:${preset.colorScheme[key]}`}></span>
						{/each}
					</span>
					<small>{preset.name}</small>
				</button>
			{/each}
		</div>
	</div>

	<div class="pptx-svelte-theme-block">
		<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.colorScheme')}</span>
		<div class="pptx-svelte-theme-swatches">
			{#each THEME_COLOR_SCHEME_KEYS as key (key)}
				<div class="pptx-svelte-theme-swatch">
					<button
						type="button"
						disabled={!canEdit}
						title={`${THEME_COLOR_LABELS[key]}: ${editColors[key]}`}
						aria-label={`${THEME_COLOR_LABELS[key]}: ${editColors[key]}`}
						aria-pressed={activePickerKey === key}
						class:pptx-svelte-theme-swatch-active={activePickerKey === key}
						style={`background:${editColors[key]}`}
						onclick={() => (activePickerKey = activePickerKey === key ? null : key)}
					></button>
					<small>{THEME_COLOR_LABELS[key]}</small>
				</div>
			{/each}
		</div>
		{#if activePickerKey}
			<div class="pptx-svelte-theme-picker">
				<span>{THEME_COLOR_LABELS[activePickerKey]}</span>
				<input
					type="color"
					disabled={!canEdit}
					aria-label={THEME_COLOR_LABELS[activePickerKey]}
					value={editColors[activePickerKey]}
					oninput={(event) => setColor(activePickerKey!, event.currentTarget.value)}
				/>
				<input
					type="text"
					disabled={!canEdit}
					aria-label={`${THEME_COLOR_LABELS[activePickerKey]} hex`}
					value={editColors[activePickerKey]}
					onchange={(event) => setColorText(event.currentTarget.value)}
				/>
			</div>
		{/if}
	</div>

	{#if previewGrid}
		<div class="pptx-svelte-theme-block">
			<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.preview')}</span>
			<div class="pptx-svelte-theme-preview">
				{#each previewGrid as row, rowIndex (rowIndex)}
					<div>
						{#each row as cell (cell.schemeKey)}
							<span
								style={`background:${cell.hex}`}
								title={`${cell.colLabel} - ${cell.rowLabel} (${cell.hex})`}
							></span>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="pptx-svelte-theme-block">
		<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.fonts')}</span>
		<label class="pptx-svelte-theme-field">
			<span>{t('pptx.themeEditor.headingFont')}</span>
			<select
				disabled={!canEdit}
				value={majorFont}
				onchange={(event) => setFonts(event.currentTarget.value, minorFont)}
			>
				{#if !COMMON_FONTS.includes(majorFont)}
					<option value={majorFont}>{majorFont}</option>
				{/if}
				{#each COMMON_FONTS as font (font)}
					<option value={font}>{font}</option>
				{/each}
			</select>
		</label>
		<label class="pptx-svelte-theme-field">
			<span>{t('pptx.themeEditor.bodyFont')}</span>
			<select
				disabled={!canEdit}
				value={minorFont}
				onchange={(event) => setFonts(majorFont, event.currentTarget.value)}
			>
				{#if !COMMON_FONTS.includes(minorFont)}
					<option value={minorFont}>{minorFont}</option>
				{/if}
				{#each COMMON_FONTS as font (font)}
					<option value={font}>{font}</option>
				{/each}
			</select>
		</label>
		<p class="pptx-svelte-theme-samples">
			<span style={`font-family:${majorFont}`}>{t('pptx.themeEditor.headingSample')}</span>
			<span aria-hidden="true">|</span>
			<span style={`font-family:${minorFont}`}>{t('pptx.themeEditor.bodySample')}</span>
		</p>
	</div>

	<div class="pptx-svelte-theme-actions">
		<button type="button" disabled={!canEdit} onclick={onapply}>
			{t('pptx.themeEditor.applyToPresentation')}
		</button>
		<button type="button" disabled={!canEdit} onclick={reset}>
			{t('pptx.themeEditor.reset')}
		</button>
	</div>
</div>

<style>
	.pptx-svelte-theme-editor {
		display: grid;
		gap: 9px;
	}

	.pptx-svelte-theme-block {
		display: grid;
		gap: 5px;
	}

	.pptx-svelte-theme-heading {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.pptx-svelte-theme-field {
		display: grid;
		gap: 3px;
	}

	.pptx-svelte-theme-field > span {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	input,
	select {
		min-width: 0;
		height: 25px;
		box-sizing: border-box;
		padding: 0 5px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-theme-presets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
	}

	.pptx-svelte-theme-presets button {
		display: grid;
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pptx-svelte-theme-preset-active {
		border-color: var(--pptx-primary, #6366f1) !important;
	}

	.pptx-svelte-theme-preset-strip {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1px;
	}

	.pptx-svelte-theme-preset-strip span {
		height: 12px;
	}

	.pptx-svelte-theme-presets small {
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-theme-swatches {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
	}

	.pptx-svelte-theme-swatch {
		display: grid;
		gap: 2px;
		justify-items: center;
	}

	.pptx-svelte-theme-swatch button {
		width: 100%;
		height: 24px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
		cursor: pointer;
	}

	.pptx-svelte-theme-swatch-active {
		outline: 1px solid var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-theme-swatch small {
		width: 100%;
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 9px;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-theme-picker {
		display: grid;
		grid-template-columns: auto 32px 1fr;
		gap: 6px;
		align-items: center;
		padding: 5px;
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		font-size: 10px;
	}

	.pptx-svelte-theme-picker input[type='color'] {
		height: 22px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-theme-preview {
		display: grid;
		gap: 1px;
	}

	.pptx-svelte-theme-preview > div {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 1px;
	}

	.pptx-svelte-theme-preview span {
		height: 13px;
		border-radius: 2px;
	}

	.pptx-svelte-theme-samples {
		display: flex;
		gap: 6px;
		margin: 2px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-theme-actions {
		display: flex;
		gap: 5px;
	}

	.pptx-svelte-theme-actions button {
		flex: 1;
		padding: 4px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pptx-svelte-theme-actions button:first-child {
		border-color: var(--pptx-primary, #6366f1);
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	button:disabled,
	input:disabled,
	select:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
