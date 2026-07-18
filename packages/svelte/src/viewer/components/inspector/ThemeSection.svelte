<script lang="ts">
	/**
	 * ThemeSection: the inspector's THEME OVERRIDE body. Mirrors React's
	 * `SlideThemeOverridePanel`: a single "Override theme for this slide"
	 * checkbox that toggles the per-slide colour-map override
	 * (`p:clrMapOvr / a:overrideClrMapping`), revealing the alias -> scheme-slot
	 * mapping rows when active. The panel already renders the "THEME OVERRIDE"
	 * heading, so this component starts straight at the checkbox.
	 *
	 * React exposes no inspector surface for editing the raw theme colours/fonts
	 * (that lives on the Design tab's theme gallery), so this binding's richer
	 * per-colour editor is preserved as a secondary, collapsed "Edit theme"
	 * disclosure below the override control rather than deleted.
	 */
	import type { ColorMapAliasKey, PptxHandler, PptxTheme, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
	import { applyThemeOverrideToSlide, COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP, THEME_COLOR_SCHEME_KEYS, THEME_PRESETS } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, handler, theme, onthemechange }: { editor: EditorState; handler: PptxHandler; theme: PptxTheme | undefined; onthemechange: (theme: PptxTheme) => void } = $props();
	const t = useTranslator();
	let busy = $state(false);
	const current = $derived(theme ?? { name: 'Custom Theme', colorScheme: THEME_PRESETS[0].colorScheme, fontScheme: THEME_PRESETS[0].fontScheme });
	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);
	const canEdit = $derived(editor.editable);

	async function apply(colorScheme: PptxThemeColorScheme, fontScheme: PptxThemeFontScheme = current.fontScheme ?? {}, name = current.name ?? 'Custom Theme'): Promise<void> {
		busy = true;
		try {
			const result = await handler.switchTheme({ slides: editor.slides, width: 0, height: 0, theme: current }, colorScheme, fontScheme, name);
			editor.commitSlides(result.slides);
			onthemechange(result.theme ?? { ...current, colorScheme, fontScheme, name });
		} finally { busy = false; }
	}

	function setOverride(next: Record<string, string> | undefined): void {
		if (!activeSlide) {
			return;
		}
		const updated = current.colorScheme ? applyThemeOverrideToSlide(activeSlide, current.colorScheme, next) : { ...activeSlide, clrMapOverride: next };
		editor.commitSlides(editor.slides.map((slide, index) => index === editor.currentSlideIndex ? updated : slide));
	}

	function toggleOverride(enabled: boolean): void {
		setOverride(enabled ? Object.fromEntries(COLOR_MAP_ALIAS_KEYS.map((key) => [key, DEFAULT_COLOR_MAP[key]])) : undefined);
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
		<input type="checkbox" disabled={!canEdit} checked={Boolean(activeSlide.clrMapOverride)} onchange={(event) => toggleOverride(event.currentTarget.checked)} />
		<span>{t('pptx.themeOverride.enableOverride')}</span>
	</label>
	{#if activeSlide.clrMapOverride}
		<div class="aliases">{#each COLOR_MAP_ALIAS_KEYS as alias}<label>{alias}<span style={`background:${current.colorScheme?.[(activeSlide.clrMapOverride[alias] ?? DEFAULT_COLOR_MAP[alias]) as keyof PptxThemeColorScheme] ?? 'transparent'}`}></span><select disabled={!canEdit} value={activeSlide.clrMapOverride[alias] ?? DEFAULT_COLOR_MAP[alias]} onchange={(event) => aliasChange(alias,event.currentTarget.value)}>{#each THEME_COLOR_SCHEME_KEYS as slot}<option value={slot}>{slot}</option>{/each}</select></label>{/each}</div>
	{/if}
{/if}

<details class="edit-theme"><summary>{t('pptx.themeEditor.title')}</summary>
	<label>Theme name<input disabled={busy} value={current.name ?? ''} onchange={(event) => void apply(current.colorScheme ?? THEME_PRESETS[0].colorScheme, current.fontScheme, event.currentTarget.value)} /></label>
	<div class="presets">{#each THEME_PRESETS as preset}<button disabled={busy} title={preset.name} onclick={() => void apply(preset.colorScheme, preset.fontScheme, preset.name)}><span style={`background:${preset.colorScheme.accent1}`}></span><span style={`background:${preset.colorScheme.accent2}`}></span><span style={`background:${preset.colorScheme.accent3}`}></span><small>{preset.name}</small></button>{/each}</div>
	<h5>Scheme colors</h5><div class="colors">{#each THEME_COLOR_SCHEME_KEYS as key}<label>{key}<input type="color" disabled={busy} value={current.colorScheme?.[key] ?? '#000000'} onchange={(event) => void apply({ ...(current.colorScheme ?? THEME_PRESETS[0].colorScheme), [key]: event.currentTarget.value }, current.fontScheme)} /></label>{/each}</div>
	<h5>Fonts</h5><div class="grid"><label>Heading<input disabled={busy} value={current.fontScheme?.majorFont?.latin ?? 'Calibri Light'} onchange={(event) => void apply(current.colorScheme ?? THEME_PRESETS[0].colorScheme, { ...current.fontScheme, majorFont: { ...current.fontScheme?.majorFont, latin: event.currentTarget.value } })} /></label><label>Body<input disabled={busy} value={current.fontScheme?.minorFont?.latin ?? 'Calibri'} onchange={(event) => void apply(current.colorScheme ?? THEME_PRESETS[0].colorScheme, { ...current.fontScheme, minorFont: { ...current.fontScheme?.minorFont, latin: event.currentTarget.value } })} /></label></div>
</details>

<style>
	label{display:grid;gap:3px;margin-top:6px;color:var(--pptx-muted-foreground,#94a3b8);font-size:11px}
	.inline{display:flex;align-items:center;gap:8px;margin-top:0}
	.inline input{width:auto}
	.aliases{margin-top:8px}
	.aliases label{display:grid;grid-template-columns:70px 18px 1fr;align-items:center}
	.aliases span{width:16px;height:16px;border:1px solid var(--pptx-border,#33334d);border-radius:3px}
	.edit-theme{margin-top:12px;border-top:1px solid var(--pptx-border,#33334d);padding-top:8px}
	.edit-theme summary{cursor:pointer;font-weight:600;color:var(--pptx-card-foreground,#e2e8f0)}
	.presets{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}
	.presets button{display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden;padding:0;border:1px solid var(--pptx-border,#33334d);border-radius:5px;background:var(--pptx-muted,#2a2a3d);color:inherit}
	.presets span{height:16px}
	.presets small{grid-column:1/-1;padding:3px;overflow:hidden;text-overflow:ellipsis}
	.colors,.grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
	input,select{min-width:0;height:25px;border:1px solid var(--pptx-border,#33334d);border-radius:5px;background:var(--pptx-background,#11111b);color:inherit}
	h5{margin:9px 0 0;font-size:10px;text-transform:uppercase}
</style>
