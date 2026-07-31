<script lang="ts">
	/**
	 * ThemeSection: the inspector's THEME OVERRIDE body. Mirrors React's
	 * `SlideThemeOverridePanel`: a single "Override theme for this slide"
	 * checkbox that toggles the per-slide colour-map override
	 * (`p:clrMapOvr / a:overrideClrMapping`), revealing the alias -> scheme-slot
	 * mapping rows when active. The panel already renders the "THEME OVERRIDE"
	 * heading, so this component starts straight at the checkbox.
	 *
	 * Below it, an "Edit Theme" disclosure hosts {@link ThemeEditorPanel}, this
	 * binding's port of React's theme editor (React reaches the same panel from
	 * a side panel rather than the inspector).
	 *
	 * WHY two update paths: a colour-picker drag fires continuously, so a live
	 * colour edit takes the CHEAP route React settled on (write the scheme into
	 * the archive, then re-resolve the live slides' colours in place via core's
	 * `reResolveSlideColors`). Only the explicit "Apply to Presentation" button
	 * runs the heavy `switchTheme` round-trip. Doing the heavy path per picker
	 * frame is what previously froze the React renderer for seconds.
	 */
	import type {
		ColorMapAliasKey,
		PptxHandler,
		PptxTheme,
		PptxThemeColorScheme,
		PptxThemeFontScheme,
	} from 'pptx-viewer-core';
	import {
		applyThemeOverrideToSlide,
		buildThemeColorMap,
		COLOR_MAP_ALIAS_KEYS,
		DEFAULT_COLOR_MAP,
		reResolveSlideColors,
		THEME_COLOR_SCHEME_KEYS,
		THEME_PRESETS,
	} from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import ThemeEditorPanel from './ThemeEditorPanel.svelte';

	const {
		editor,
		handler,
		theme,
		onthemechange,
	}: {
		editor: EditorState;
		handler: PptxHandler;
		theme: PptxTheme | undefined;
		onthemechange: (theme: PptxTheme) => void;
	} = $props();
	const t = useTranslator();
	let busy = $state(false);
	const current = $derived(
		theme ?? {
			name: 'Custom Theme',
			colorScheme: THEME_PRESETS[0].colorScheme,
			fontScheme: THEME_PRESETS[0].fontScheme,
		},
	);
	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);
	const canEdit = $derived(editor.editable);

	/** Cheap live colour edit: rewrite the archive scheme + remap live slides. */
	async function updateColorScheme(colorScheme: PptxThemeColorScheme): Promise<void> {
		const previousMap = current.colorScheme ? buildThemeColorMap(current.colorScheme) : {};
		await handler.updateThemeColorScheme(colorScheme);
		editor.commitSlides(reResolveSlideColors(editor.slides, previousMap, colorScheme));
		onthemechange({ ...current, colorScheme });
	}

	async function updateFontScheme(fontScheme: PptxThemeFontScheme): Promise<void> {
		await handler.updateThemeFontScheme(fontScheme);
		onthemechange({ ...current, fontScheme });
	}

	async function updateName(name: string): Promise<void> {
		await handler.updateThemeName(name);
		onthemechange({ ...current, name });
	}

	/** Heavy path: re-derive every slide from the theme (explicit button only). */
	async function applyToPresentation(): Promise<void> {
		busy = true;
		try {
			const result = await handler.switchTheme(
				{ slides: editor.slides, width: 0, height: 0, theme: current },
				current.colorScheme ?? THEME_PRESETS[0].colorScheme,
				current.fontScheme ?? {},
				current.name ?? 'Custom Theme',
			);
			editor.commitSlides(result.slides);
			onthemechange(result.theme ?? current);
		} finally {
			busy = false;
		}
	}

	function setOverride(next: Record<string, string> | undefined): void {
		if (!activeSlide) {
			return;
		}
		const updated = current.colorScheme
			? applyThemeOverrideToSlide(activeSlide, current.colorScheme, next)
			: { ...activeSlide, clrMapOverride: next };
		editor.commitSlides(
			editor.slides.map((slide, index) => (index === editor.currentSlideIndex ? updated : slide)),
		);
	}

	function toggleOverride(enabled: boolean): void {
		setOverride(
			enabled
				? Object.fromEntries(COLOR_MAP_ALIAS_KEYS.map((key) => [key, DEFAULT_COLOR_MAP[key]]))
				: undefined,
		);
	}

	function aliasChange(alias: ColorMapAliasKey, target: string): void {
		const next = { ...(activeSlide?.clrMapOverride ?? {}) };
		for (const key of COLOR_MAP_ALIAS_KEYS) {
			next[key] ??= DEFAULT_COLOR_MAP[key];
		}
		next[alias] = target;
		setOverride(next);
	}
</script>

{#if activeSlide}
	<label class="inline">
		<input
			type="checkbox"
			disabled={!canEdit}
			checked={Boolean(activeSlide.clrMapOverride)}
			onchange={(event) => toggleOverride(event.currentTarget.checked)}
		/>
		<span>{t('pptx.themeOverride.enableOverride')}</span>
	</label>
	{#if activeSlide.clrMapOverride}
		<div class="aliases">
			{#each COLOR_MAP_ALIAS_KEYS as alias (alias)}
				<label>
					{alias}
					<span
						style={`background:${
							current.colorScheme?.[
								(activeSlide.clrMapOverride[alias] ??
									DEFAULT_COLOR_MAP[alias]) as keyof PptxThemeColorScheme
							] ?? 'transparent'
						}`}
					></span>
					<select
						disabled={!canEdit}
						value={activeSlide.clrMapOverride[alias] ?? DEFAULT_COLOR_MAP[alias]}
						onchange={(event) => aliasChange(alias, event.currentTarget.value)}
					>
						{#each THEME_COLOR_SCHEME_KEYS as slot (slot)}
							<option value={slot}>{slot}</option>
						{/each}
					</select>
				</label>
			{/each}
		</div>
	{/if}
{/if}

<details class="edit-theme">
	<summary>{t('pptx.themeEditor.title')}</summary>
	<ThemeEditorPanel
		theme={current}
		canEdit={canEdit && !busy}
		onupdatecolorscheme={(colorScheme) => void updateColorScheme(colorScheme)}
		onupdatefontscheme={(fontScheme) => void updateFontScheme(fontScheme)}
		onupdatename={(name) => void updateName(name)}
		onapply={() => void applyToPresentation()}
	/>
</details>

<style>
	label {
		display: grid;
		gap: 3px;
		margin-top: 6px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 0;
	}

	.inline input {
		width: auto;
	}

	.aliases {
		margin-top: 8px;
	}

	.aliases label {
		display: grid;
		grid-template-columns: 70px 18px 1fr;
		align-items: center;
	}

	.aliases span {
		width: 16px;
		height: 16px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
	}

	.edit-theme {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.edit-theme summary {
		margin-bottom: 8px;
		color: var(--pptx-card-foreground, #e2e8f0);
		font-weight: 600;
		cursor: pointer;
	}

	select {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}
</style>
