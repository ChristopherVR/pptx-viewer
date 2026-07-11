<script lang="ts">
	/**
	 * InsertTab: the ribbon's Insert tab. Text box / image / table stay the
	 * same one-click inserts as the pre-ribbon `InsertMenu`; the shape picker
	 * is upgraded from 3 hardcoded shapes (rect/ellipse/line) to the full
	 * shared `SHAPE_PRESET_DEFS` catalogue (30 presets) via a dropdown grid.
	 */
	import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { newImageElement, newPresetShapeElement, newTableElement, newTextElement } from '../../../editor';
	import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from './shape-glyphs';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	let shapesOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let fileInput = $state<HTMLInputElement | null>(null);

	const MAX_IMAGE_EDGE = 400;

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			shapesOpen = false;
		}
	}

	function insertShape(type: (typeof SHAPE_PRESET_DEFS)[number]['type']): void {
		shapesOpen = false;
		editor.insertElement(newPresetShapeElement(type));
	}

	function pickImage(): void {
		fileInput?.click();
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = typeof reader.result === 'string' ? reader.result : '';
			if (!dataUrl) {
				return;
			}
			const probe = new Image();
			probe.onload = () => {
				const ratio = Math.min(
					1,
					MAX_IMAGE_EDGE / Math.max(probe.naturalWidth || 1, probe.naturalHeight || 1),
				);
				const w = Math.max(1, Math.round((probe.naturalWidth || MAX_IMAGE_EDGE) * ratio));
				const h = Math.max(1, Math.round((probe.naturalHeight || MAX_IMAGE_EDGE) * ratio));
				editor.insertElement(newImageElement(dataUrl, 120, 120, w, h));
			};
			probe.onerror = () => {
				editor.insertElement(newImageElement(dataUrl, 120, 120, 300, 200));
			};
			probe.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}
</script>

<div class="pptx-svelte-inserttab" role="group" aria-label={t('pptx.ribbon.insert')}>
	<button
		type="button"
		disabled={!editor.editable}
		aria-label={t('pptx.ribbon.textBox')}
		title={t('pptx.ribbon.textBox')}
		onclick={() => editor.insertElement(newTextElement())}
	>
		<span aria-hidden="true">T</span>
		<span>{t('pptx.ribbon.textBox')}</span>
	</button>

	<div class="pptx-svelte-inserttab-shapes" onfocusout={onFocusOut}>
		<button
			type="button"
			disabled={!editor.editable}
			aria-haspopup="menu"
			aria-expanded={shapesOpen}
			aria-label={t('pptx.drawing.shapes')}
			title={t('pptx.drawing.shapes')}
			onclick={() => (shapesOpen = !shapesOpen)}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="11.5" cy="4.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M2 14 6 8l4 6z" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
			<span>{t('pptx.drawing.shapes')}</span>
		</button>
		{#if shapesOpen}
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

	<button
		type="button"
		disabled={!editor.editable}
		aria-label={t('pptx.ribbon.insertImage')}
		title={t('pptx.ribbon.insertImage')}
		onclick={pickImage}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM4 11l3-3 2 2 2.5-3 1.5 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /><circle cx="5.5" cy="6" r="1" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.image')}</span>
	</button>
	<button
		type="button"
		disabled={!editor.editable}
		aria-label={t('pptx.insert.insertTable')}
		title={t('pptx.insert.insertTable')}
		onclick={() => editor.insertElement(newTableElement())}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6 3.5v9M10 3.5v9" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
		<span>{t('pptx.ribbon.table')}</span>
	</button>
	<input bind:this={fileInput} type="file" accept="image/*" class="pptx-svelte-inserttab-file" onchange={onFileChange} />
</div>

<style>
	.pptx-svelte-inserttab {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-inserttab button {
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

	.pptx-svelte-inserttab button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-inserttab button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-inserttab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-inserttab-shapes {
		position: relative;
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

	.pptx-svelte-inserttab-file {
		display: none;
	}
</style>
