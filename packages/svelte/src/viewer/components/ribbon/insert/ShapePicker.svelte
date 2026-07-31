<script lang="ts">
	/**
	 * ShapePicker: the Insert tab's shape control, React's split pair (a
	 * `<select>` named "Shape type" over the full shared `SHAPE_PRESET_DEFS`
	 * catalogue, beside a "Shape" button that inserts the staged type).
	 *
	 * The button carries the staged preset's own glyph, so the control still
	 * shows you what you are about to draw the way the old popup grid did,
	 * without the tab claiming a control no other binding has. The glyph
	 * helpers stay in `shape-glyphs.ts`; the Home tab's Shapes gallery is where
	 * a browsable grid of presets lives.
	 */
	import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { newPresetShapeElement } from '../../../editor';
	import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from './shape-glyphs';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	type PresetType = (typeof SHAPE_PRESET_DEFS)[number]['type'];

	// eslint-disable-next-line prefer-const
	let shapeType = $state<PresetType>(SHAPE_PRESET_DEFS[0].type);
	const preset = $derived(
		SHAPE_PRESET_DEFS.find((entry) => entry.type === shapeType) ?? SHAPE_PRESET_DEFS[0],
	);
</script>

<div class="pptx-svelte-inserttab-shapes">
	<select
		class="pptx-svelte-inserttab-shapetype"
		disabled={!editor.editable}
		aria-label={t('pptx.insert.shapeType')}
		title={t('pptx.insert.shapeType')}
		value={shapeType}
		onchange={(event) => (shapeType = event.currentTarget.value as PresetType)}
	>
		{#each SHAPE_PRESET_DEFS as entry (entry.type)}
			<option value={entry.type}>{t(entry.i18nKey)}</option>
		{/each}
	</select>
	<button
		type="button"
		disabled={!editor.editable}
		title={t('pptx.insert.addShape')}
		onclick={() => editor.insertElement(newPresetShapeElement(shapeType))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true" style={`transform:${glyphClassToTransform(preset.glyphClass)}`}>
			{#if isStrokeGlyph(preset.glyph)}
				<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
			{:else}
				<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
			{/if}
		</svg>
		<span>{t('pptx.insert.shape')}</span>
	</button>
</div>

<style>
	.pptx-svelte-inserttab-shapes {
		display: inline-flex;
		align-items: stretch;
		overflow: hidden;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-inserttab-shapetype {
		height: 28px;
		max-width: 112px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		padding: 0 6px;
	}

	.pptx-svelte-inserttab-shapes button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-inserttab-shapes button:hover:not(:disabled),
	.pptx-svelte-inserttab-shapetype:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-inserttab-shapes button:disabled,
	.pptx-svelte-inserttab-shapetype:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-inserttab-shapes svg {
		width: 15px;
		height: 15px;
	}
</style>
