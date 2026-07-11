<script lang="ts">
	/**
	 * ShapePicker: the Insert tab's shape gallery, a trigger button that opens
	 * a popup grid of the full shared `SHAPE_PRESET_DEFS` catalogue (30
	 * presets). Split out of `InsertTab.svelte` to keep that orchestrator file
	 * within the file-size budget as more Insert actions land.
	 */
	import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { newPresetShapeElement } from '../../../editor';
	import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from './shape-glyphs';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	let open = $state(false);

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}

	function insertShape(type: (typeof SHAPE_PRESET_DEFS)[number]['type']): void {
		open = false;
		editor.insertElement(newPresetShapeElement(type));
	}
</script>

<div class="pptx-svelte-inserttab-shapes" onfocusout={onFocusOut}>
	<button
		type="button"
		disabled={!editor.editable}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={t('pptx.drawing.shapes')}
		title={t('pptx.drawing.shapes')}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="11.5" cy="4.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M2 14 6 8l4 6z" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
		<span>{t('pptx.drawing.shapes')}</span>
	</button>
	{#if open}
		<div class="pptx-svelte-inserttab-grid" role="menu">
			{#each SHAPE_PRESET_DEFS as preset (preset.type)}
				<button
					type="button"
					role="menuitem"
					aria-label={t(preset.i18nKey)}
					title={t(preset.i18nKey)}
					onclick={() => insertShape(preset.type)}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true" style={`transform:${glyphClassToTransform(preset.glyphClass)}`}>
						{#if isStrokeGlyph(preset.glyph)}
							<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
						{:else}
							<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
						{/if}
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-inserttab-shapes {
		position: relative;
	}

	.pptx-svelte-inserttab-shapes button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-inserttab-shapes button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-inserttab-shapes button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-inserttab-shapes svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-inserttab-grid {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 3px;
		width: 220px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 6px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-inserttab-grid button {
		width: 30px;
		height: 30px;
		padding: 0;
		justify-content: center;
		background: transparent;
	}
</style>
