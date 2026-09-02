<script lang="ts">
	/**
	 * ShapeFormatGroup: fill-colour, stroke-colour, and stroke-width controls for
	 * the selected shape/connector. Reads via the shared inspector helpers; every
	 * write is history-integrated through `EditorState.patchSelected`. Disabled
	 * whenever the selection has no shape properties.
	 */
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { fillColorOf, strokeColorOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import {
		setFillColorPatch,
		setStrokeColorPatch,
		setStrokeWidthPatch,
		strokeWidthOf,
	} from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasShapeProperties(el));
	const fill = $derived(el && active ? fillColorOf(el) : '#ffffff');
	const stroke = $derived(el && active ? strokeColorOf(el) : '#000000');
	const strokeWidth = $derived(el && active ? strokeWidthOf(el) : 1);

	function setFill(value: string): void {
		if (el) {
			editor.patchSelected(setFillColorPatch(el, value));
		}
		editor.recordRecentColor(value);
	}
	function setStroke(value: string): void {
		if (el) {
			editor.patchSelected(setStrokeColorPatch(el, value));
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
	<label class="pptx-svelte-fmt-color" title={t('pptx.drawing.shapeFill')}>
		<span class="pptx-svelte-fmt-label">{t('pptx.inspector.fill')}</span>
		<input
			type="color"
			disabled={!active}
			aria-label={t('pptx.drawing.shapeFill')}
			value={/^#/.test(fill) ? fill : '#ffffff'}
			onchange={(e) => setFill(e.currentTarget.value)}
		/>
	</label>
	<label class="pptx-svelte-fmt-color" title={t('pptx.drawing.shapeOutline')}>
		<span class="pptx-svelte-fmt-label">{t('pptx.inspector.stroke')}</span>
		<input
			type="color"
			disabled={!active}
			aria-label={t('pptx.drawing.shapeOutline')}
			value={/^#/.test(stroke) ? stroke : '#000000'}
			onchange={(e) => setStroke(e.currentTarget.value)}
		/>
	</label>
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

	.pptx-svelte-fmt-color {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		cursor: pointer;
	}

	.pptx-svelte-fmt-label {
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-fmt-color input[type='color'] {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-fmt-color input[type='color']:disabled {
		opacity: 0.35;
		cursor: default;
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
