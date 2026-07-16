<script lang="ts">
	/**
	 * InsertTab: the ribbon's Insert tab. Text box / image / table stay the
	 * same one-click inserts as the pre-ribbon `InsertMenu`; the shape gallery
	 * lives in `ShapePicker.svelte`. This wave adds the "structured" Insert
	 * actions React's `InsertSection` offers: media (audio/video file picker),
	 * a chart-type dropdown, a docked equation panel, a SmartArt gallery
	 * picker, an action-button dropdown, and a field dropdown. Every insertion
	 * routes through `EditorState.insertElement` (undoable, selects the new
	 * element), except Equation, which stages LaTeX -> OMML in a docked panel
	 * before inserting (there's no single-click default for free-form maths).
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildMediaInsertElement, newImageElement, newTableElement, newTextElement } from '../../../editor';
	import ActionButtonMenu from './ActionButtonMenu.svelte';
	import ChartMenu from './ChartMenu.svelte';
	import EquationPanel from './EquationPanel.svelte';
	import FieldMenu from './FieldMenu.svelte';
	import HyperlinkDialog from './HyperlinkDialog.svelte';
	import ShapePicker from './ShapePicker.svelte';
	import SmartArtMenu from './SmartArtMenu.svelte';

	const { editor, canvasSize, onheaderfooter }: { editor: EditorState; canvasSize: CanvasSize; onheaderfooter?: () => void } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let imageInput = $state<HTMLInputElement | null>(null);
	// eslint-disable-next-line prefer-const
	let mediaInput = $state<HTMLInputElement | null>(null);
	let equationOpen = $state(false);
	let hyperlinkOpen = $state(false);
	$effect(() => {
		if (editor.equationOps.editingId) {
			equationOpen = true;
		}
	});

	const MAX_IMAGE_EDGE = 400;

	function toggleEquationPanel(): void {
		equationOpen = !equationOpen;
	}

	function closeEquationPanel(): void {
		equationOpen = false;
		editor.equationOps.close();
	}

	function onImageFileChange(event: Event): void {
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

	async function onMediaFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		const el = await buildMediaInsertElement(file, canvasSize);
		if (el) {
			editor.insertElement(el);
		}
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

	<ShapePicker {editor} />

	<button
		type="button"
		disabled={!editor.editable}
		aria-label={t('pptx.ribbon.insertImage')}
		title={t('pptx.ribbon.insertImage')}
		onclick={() => imageInput?.click()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM4 11l3-3 2 2 2.5-3 1.5 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /><circle cx="5.5" cy="6" r="1" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.image')}</span>
	</button>

	<button
		type="button"
		disabled={!editor.editable}
		aria-label={t('pptx.ribbon.insertMedia')}
		title={t('pptx.ribbon.insertMedia')}
		onclick={() => mediaInput?.click()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11v8h-11z" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M6.5 6.2 10 8l-3.5 1.8Z" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.insertMedia')}</span>
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

	<ChartMenu {editor} {canvasSize} />

	<button
		type="button"
		disabled={!editor.editable}
		aria-haspopup="dialog"
		aria-expanded={equationOpen}
		aria-label={t('pptx.ribbon.insertEquation')}
		title={t('pptx.ribbon.insertEquation')}
		onclick={toggleEquationPanel}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h6l-3 5 3 5H4M9 8h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.equation.insertTitle')}</span>
	</button>

	<SmartArtMenu {editor} {canvasSize} />
	<ActionButtonMenu {editor} {canvasSize} />
	<FieldMenu {editor} {canvasSize} />
	{#if onheaderfooter}<button type="button" onclick={onheaderfooter}># <span>{t('pptx.headerFooter.title')}</span></button>{/if}
	<button type="button" disabled={!editor.selectedElementId} onclick={() => (hyperlinkOpen = true)}>↗ <span>{t('pptx.hyperlink.title')}</span></button>

	<input bind:this={imageInput} type="file" accept="image/*" class="pptx-svelte-inserttab-file" onchange={onImageFileChange} />
	<input bind:this={mediaInput} type="file" accept="video/*,audio/*" class="pptx-svelte-inserttab-file" onchange={onMediaFileChange} />

	{#if equationOpen}
		<div class="pptx-svelte-inserttab-equation">
			<EquationPanel {editor} {canvasSize} open={equationOpen} onclose={closeEquationPanel} />
		</div>
	{/if}
	{#if hyperlinkOpen}<HyperlinkDialog {editor} onclose={() => (hyperlinkOpen = false)} />{/if}
</div>

<style>
	.pptx-svelte-inserttab {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pptx-svelte-inserttab > button {
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

	.pptx-svelte-inserttab > button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-inserttab > button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-inserttab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-inserttab-file {
		display: none;
	}

	.pptx-svelte-inserttab-equation {
		flex-basis: 100%;
	}
</style>
