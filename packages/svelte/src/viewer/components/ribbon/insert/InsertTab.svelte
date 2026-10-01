<script lang="ts">
	/**
	 * InsertTab: thin adapter for the shared `pptx-ui-ribbon-insert`. The shared
	 * element owns the groups, icons, labels, shape/chart pickers, Freeform tools and
	 * the Action / Field menus; this component supplies viewer state and routes typed
	 * intents to the native handlers. Every insertion routes through
	 * `EditorState.insertElement` (undoable, selects the new element). The file
	 * pickers, the SmartArt gallery, the equation editor and the hyperlink dialog stay
	 * native to the Svelte binding.
	 */
	import type { SmartArtLayout } from 'pptx-viewer-core';
	import {
		DEFAULT_INSERT_CHART_KIND,
		FREEFORM_TOOL_IDS,
		isDrawingToolVisible,
	} from 'pptx-viewer-shared';
	import type {
		CanvasSize,
		FreeformToolKind,
		InsertChartKind,
		PptxUiRibbonInsertElement,
		RibbonInsertRequestEvent,
		ShapePresetType,
	} from 'pptx-viewer-shared';
	import { tick } from 'svelte';

	import { useTranslator } from '../../../../i18n/context';
	import {
		buildActionButtonInsertElement,
		buildChartInsertElement,
		buildFieldInsertElement,
		buildMediaInsertElement,
		buildSmartArtInsertElement,
		newImageElement,
		newPresetShapeElement,
		newTableElement,
		newTextElement,
		resolveFieldDisplayText,
	} from '../../../editor';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { useViewerCustomization } from '../../../state/viewer-customization.svelte';
	import EquationEditorDialog from './EquationEditorDialog.svelte';
	import HyperlinkDialog from './HyperlinkDialog.svelte';
	import SmartArtDialog from './SmartArtDialog.svelte';

	const { editor, canvasSize, onheaderfooter }: { editor: EditorState; canvasSize: CanvasSize; onheaderfooter?: () => void } = $props();
	const t = useTranslator();
	const customization = useViewerCustomization();

	// eslint-disable-next-line prefer-const
	let host = $state<PptxUiRibbonInsertElement | null>(null);
	// eslint-disable-next-line prefer-const
	let imageInput = $state<HTMLInputElement | null>(null);
	// eslint-disable-next-line prefer-const
	let mediaInput = $state<HTMLInputElement | null>(null);
	let equationOpen = $state(false);
	let smartArtOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let hyperlinkOpen = $state(false);
	let shapeType = $state<ShapePresetType>('rect');
	let chartKind = $state<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	$effect(() => {
		if (editor.equationOps.editingId) {
			equationOpen = true;
		}
	});

	const insertState = $derived({
		editable: editor.editable,
		hasSelection: Boolean(editor.selectedElementId),
		shapeType,
		chartKind,
		activeFreeformTool: editor.outlineOps.freeformTool,
		freeformTools: FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization.resolved, tool)),
		headerFooterAvailable: Boolean(onheaderfooter),
		translate: t,
	});

	const MAX_IMAGE_EDGE = 400;

	function closeEquationDialog(): void {
		equationOpen = false;
		editor.equationOps.close();
	}

	function closeSmartArt(): void {
		smartArtOpen = false;
		void tick().then(() => host?.focusControl('insert.illustrations.smartArt'));
	}

	function insertSmartArt(layout: SmartArtLayout, defaultItems: string[]): void {
		editor.insertElement(buildSmartArtInsertElement(layout, defaultItems, canvasSize));
		closeSmartArt();
	}

	function insertField(fieldType: string): void {
		const displayText = resolveFieldDisplayText(fieldType, {
			slideNumber: editor.currentSlideIndex + 1,
		});
		editor.insertElement(buildFieldInsertElement(fieldType, displayText, canvasSize));
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

	function request(event: RibbonInsertRequestEvent): void {
		const intent = event.detail;
		switch (intent.kind) {
			case 'command':
				switch (intent.value) {
					case 'textBox': editor.insertElement(newTextElement()); break;
					case 'table': editor.insertElement(newTableElement()); break;
					case 'image': imageInput?.click(); break;
					case 'media': mediaInput?.click(); break;
					case 'smartArt': smartArtOpen = true; break;
					case 'equation': equationOpen = !equationOpen; break;
					case 'link': hyperlinkOpen = true; break;
					case 'headerFooter': onheaderfooter?.(); break;
				}
				break;
			case 'shapeType': shapeType = intent.value as ShapePresetType; break;
			case 'shape': editor.insertElement(newPresetShapeElement(intent.value as ShapePresetType)); break;
			case 'chartType': chartKind = intent.value as InsertChartKind; break;
			case 'chart': editor.insertElement(buildChartInsertElement(intent.value as InsertChartKind, canvasSize)); break;
			case 'freeform': editor.outlineOps.armFreeformTool(intent.value as FreeformToolKind | null); break;
			case 'actionButton': {
				const el = buildActionButtonInsertElement(intent.value, canvasSize);
				if (el) {
					editor.insertElement(el);
				}
				break;
			}
			case 'field': insertField(intent.value); break;
		}
	}
</script>

<pptx-ui-ribbon-insert bind:this={host} state={insertState} oninsert-request={request}></pptx-ui-ribbon-insert>
<input bind:this={imageInput} type="file" accept="image/*" class="pptx-svelte-inserttab-file" onchange={onImageFileChange} />
<input bind:this={mediaInput} type="file" accept="video/*,audio/*" class="pptx-svelte-inserttab-file" onchange={onMediaFileChange} />

{#if smartArtOpen}<SmartArtDialog oncancel={closeSmartArt} oninsert={insertSmartArt} />{/if}
<EquationEditorDialog {editor} {canvasSize} open={equationOpen} onclose={closeEquationDialog} />
{#if hyperlinkOpen}<HyperlinkDialog {editor} onclose={() => (hyperlinkOpen = false)} />{/if}

<style>
	.pptx-svelte-inserttab-file {
		display: none;
	}
</style>
