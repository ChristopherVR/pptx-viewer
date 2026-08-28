<script lang="ts">
	/**
	 * InsertTab: the ribbon's Insert tab. Text box / image / table stay the
	 * same one-click inserts as the pre-ribbon `InsertMenu`; the shape gallery
	 * lives in `ShapePicker.svelte`. This wave adds the "structured" Insert
	 * actions React's `InsertSection` offers: media (audio/video file picker),
	 * a chart-type dropdown, a modal equation editor dialog, a SmartArt
	 * gallery picker, an action-button dropdown, and a field dropdown. Every
	 * insertion routes through `EditorState.insertElement` (undoable, selects
	 * the new element), except Equation, which stages LaTeX -> OMML in
	 * `EquationEditorDialog` before inserting (there's no single-click default
	 * for free-form maths).
	 */
	import Link from '@lucide/svelte/icons/link';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildMediaInsertElement, newImageElement, newTableElement, newTextElement } from '../../../editor';
	import ActionButtonMenu from './ActionButtonMenu.svelte';
	import ChartMenu from './ChartMenu.svelte';
	import EquationEditorDialog from './EquationEditorDialog.svelte';
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
	// eslint-disable-next-line prefer-const
	let hyperlinkOpen = $state(false);
	$effect(() => {
		if (editor.equationOps.editingId) {
			equationOpen = true;
		}
	});

	const MAX_IMAGE_EDGE = 400;

	function toggleEquationDialog(): void {
		equationOpen = !equationOpen;
	}

	function closeEquationDialog(): void {
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
		title={t('pptx.ribbon.insertImage')}
		onclick={() => imageInput?.click()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM4 11l3-3 2 2 2.5-3 1.5 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /><circle cx="5.5" cy="6" r="1" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.image')}</span>
	</button>

	<button
		type="button"
		disabled={!editor.editable}
		title={t('pptx.ribbon.insertMedia')}
		onclick={() => mediaInput?.click()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11v8h-11z" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M6.5 6.2 10 8l-3.5 1.8Z" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.media')}</span>
	</button>

	<button
		type="button"
		disabled={!editor.editable}
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
		title={t('pptx.ribbon.insertEquation')}
		onclick={toggleEquationDialog}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h6l-3 5 3 5H4M9 8h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.ribbon.equation')}</span>
	</button>

	<SmartArtMenu {editor} {canvasSize} />
	<ActionButtonMenu {editor} {canvasSize} />
	<FieldMenu {editor} {canvasSize} />
	<!-- No icon, matching React/Vue's plain-text Header & Footer pill (every
	     other Insert control pairs an icon with its label; this one doesn't). -->
	{#if onheaderfooter}<button type="button" onclick={onheaderfooter}><span>{t('pptx.headerFooter.title')}</span></button>{/if}
	<!-- `pptx.hyperlink.title` has no dictionary entry, so this button used to
	     render as the humanised key fallback, "Title". -->
	<button type="button" disabled={!editor.selectedElementId} onclick={() => (hyperlinkOpen = true)}><Link size={15} aria-hidden="true" /> <span>{t('pptx.hyperlinkDialog.title')}</span></button>

	<input bind:this={imageInput} type="file" accept="image/*" class="pptx-svelte-inserttab-file" onchange={onImageFileChange} />
	<input bind:this={mediaInput} type="file" accept="video/*,audio/*" class="pptx-svelte-inserttab-file" onchange={onMediaFileChange} />

	<EquationEditorDialog {editor} {canvasSize} open={equationOpen} onclose={closeEquationDialog} />
	{#if hyperlinkOpen}<HyperlinkDialog {editor} onclose={() => (hyperlinkOpen = false)} />{/if}
</div>

<style>
	/* `Ribbon.svelte`'s `.pptx-svelte-ribbon-content > :global(*)` rule forces
	   `align-self: stretch` + `align-items: flex-start` on every tab's root
	   (a handful of grouped/multi-row tabs - Animations, Slide Show, Review,
	   View - genuinely need the full row height for their own internal
	   layout). Insert is a flat single row of fixed-height pill buttons like
	   Home/Design/Draw, so that rule stretched this wrapper to the full
	   82px row and top-anchored its buttons, leaving dead space below them
	   instead of the row-level `align-items: center` fix (from the "stop
	   ribbon action buttons from stretching" change) centering them. Both
	   declarations tie that global rule's specificity, so cascade order (not
	   intent) decides the winner; `!important` here makes Insert's own
	   values win regardless of build/bundling order. */
	.pptx-svelte-inserttab {
		display: flex;
		align-items: center !important;
		align-self: auto !important;
		flex-wrap: nowrap;
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
</style>
