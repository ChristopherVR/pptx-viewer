<script lang="ts">
	/**
	 * ShapeFormatGroup: fill-colour, stroke-colour, and stroke-width controls for
	 * the selected shape/connector. Reads via the shared inspector helpers; every
	 * write is history-integrated through `EditorState.patchSelected`. Disabled
	 * whenever the selection has no shape properties.
	 *
	 * Fill/stroke swatch pickers render the deck's real "Theme Colors" grid
	 * (`SwatchColorPicker`'s `themeColorMap`/`onselectTheme`, React/Vue parity:
	 * `ShapeColorPopover` / `DrawingGroup.vue`) above the standard swatch row. A
	 * theme swatch commits both the resolved hex and its `PptxThemeColorRef` (so
	 * the fill/outline keeps following the theme after a later theme change); a
	 * standard or custom pick clears the ref.
	 */
	import type { PptxThemeColorRef } from 'pptx-viewer-core';
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { fillColorOf, RIBBON_SHAPE_SWATCHES, strokeColorOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import {
		setSolidFillPatch,
		setStrokeColorPatch,
		setStrokeWidthPatch,
		strokeWidthOf,
	} from '../editor';
	import SwatchColorPicker from './ribbon/SwatchColorPicker.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasShapeProperties(el));
	const fill = $derived(el && active ? fillColorOf(el) : '#ffffff');
	const stroke = $derived(el && active ? strokeColorOf(el) : '#000000');
	const strokeWidth = $derived(el && active ? strokeWidthOf(el) : 1);
	const fillRef = $derived(
		el && hasShapeProperties(el) ? el.shapeStyle?.fillColorRef : undefined,
	);
	const strokeRef = $derived(
		el && hasShapeProperties(el) ? el.shapeStyle?.strokeColorRef : undefined,
	);

	function setFill(value: string, ref?: PptxThemeColorRef): void {
		if (el) {
			editor.patchSelected(setSolidFillPatch(el, value, ref));
		}
		editor.recordRecentColor(value);
	}
	function setStroke(value: string, ref?: PptxThemeColorRef): void {
		if (el) {
			editor.patchSelected(setStrokeColorPatch(el, value, ref));
		}
		editor.recordRecentColor(value);
	}
	function setWidth(value: string): void {
		const n = Number(value);
		if (el && Number.isFinite(n)) {
			editor.patchSelected(setStrokeWidthPatch(el, n));
		}
	}
</script>

<div class="pptx-svelte-fmt" role="group" aria-label={t('pptx.inspector.fillStroke')}>
	<span class="pptx-svelte-fmt-label">{t('pptx.inspector.fill')}</span>
	<SwatchColorPicker
		value={/^#/.test(fill) ? fill : '#ffffff'}
		disabled={!active}
		label={t('pptx.drawing.shapeFill')}
		glyph="F"
		swatches={RIBBON_SHAPE_SWATCHES}
		recentColors={editor.mruColors}
		themeColorMap={editor.themeColorMap}
		currentRef={fillRef}
		onselect={(hex) => setFill(hex)}
		onselectTheme={(commit) => setFill(commit.hex, commit.ref)}
	/>
	<span class="pptx-svelte-fmt-label">{t('pptx.inspector.stroke')}</span>
	<SwatchColorPicker
		value={/^#/.test(stroke) ? stroke : '#000000'}
		disabled={!active}
		label={t('pptx.drawing.shapeOutline')}
		glyph="O"
		swatches={RIBBON_SHAPE_SWATCHES}
		recentColors={editor.mruColors}
		themeColorMap={editor.themeColorMap}
		currentRef={strokeRef}
		onselect={(hex) => setStroke(hex)}
		onselectTheme={(commit) => setStroke(commit.hex, commit.ref)}
	/>
	<input
		class="pptx-svelte-fmt-size"
		type="number"
		min="0"
		max="120"
		step="0.5"
		disabled={!active}
		aria-label={t('pptx.ribbon.strokeWidth')}
		title={t('pptx.ribbon.strokeWidth')}
		value={strokeWidth}
		onchange={(e) => setWidth(e.currentTarget.value)}
	/>
</div>

<style>
	.pptx-svelte-fmt {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-fmt-label {
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-fmt-size {
		width: 52px;
		height: 28px;
		text-align: center;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-fmt-size:disabled {
		opacity: 0.35;
	}
</style>
