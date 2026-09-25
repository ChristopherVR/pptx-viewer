<script lang="ts">
	/**
	 * ThemeSection: the inspector's THEME OVERRIDE body. Mirrors React's
	 * `SlideThemeOverridePanel`: a single "Override theme for this slide"
	 * checkbox that toggles the per-slide colour-map override
	 * (`p:clrMapOvr / a:overrideClrMapping`), revealing the alias -> scheme-slot
	 * mapping rows when active. The panel already renders the "THEME OVERRIDE"
	 * heading, so this component starts straight at the checkbox.
	 *
	 * Below it, an "Edit Theme" disclosure hosts {@link DeckThemeEditor}, this
	 * binding's port of React's theme editor (Design > Edit Theme opens the
	 * same editor from the ribbon).
	 */
	import type {
		ColorMapAliasKey,
		PptxHandler,
		PptxTheme,
		PptxThemeColorScheme,
	} from 'pptx-viewer-core';
	import {
		applyThemeOverrideToSlide,
		COLOR_MAP_ALIAS_KEYS,
		DEFAULT_COLOR_MAP,
		THEME_COLOR_SCHEME_KEYS,
		THEME_PRESETS,
	} from 'pptx-viewer-core';
	import { schemaLabel, THEME_COLOR_SLOT_LABEL_KEYS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import DeckThemeEditor from './DeckThemeEditor.svelte';

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
	const current = $derived(
		theme ?? {
			name: 'Custom Theme',
			colorScheme: THEME_PRESETS[0].colorScheme,
			fontScheme: THEME_PRESETS[0].fontScheme,
		},
	);
	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);
	const canEdit = $derived(editor.editable);

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
		<pptx-ui-checkbox
			disabled={!canEdit}
			checked={Boolean(activeSlide.clrMapOverride)}
			onchange={(event) => toggleOverride(event.currentTarget.checked)}
		></pptx-ui-checkbox>
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
					<pptx-ui-select
						aria-label={alias}
						disabled={!canEdit}
						value={activeSlide.clrMapOverride[alias] ?? DEFAULT_COLOR_MAP[alias]}
						onchange={(event) => aliasChange(alias, event.currentTarget.value)}
					>
						<!--
							The target is an `a:clrScheme` element name (`dk1`, `folHlink`); the
							shared table spells each one the way PowerPoint's own colour pickers
							do, without changing which slots the select offers. The row caption
							stays the raw alias (`bg1`, `tx1`) because it is this select's
							accessible name, which the parity specs diff verbatim.
						-->
						{#each THEME_COLOR_SCHEME_KEYS as slot (slot)}
							<option value={slot}>{schemaLabel(THEME_COLOR_SLOT_LABEL_KEYS, slot, t)}</option>
						{/each}
					</pptx-ui-select>
				</label>
			{/each}
		</div>
	{/if}
{/if}

<details class="edit-theme">
	<summary>{t('pptx.themeEditor.title')}</summary>
	<DeckThemeEditor {editor} {handler} {theme} {onthemechange} />
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
