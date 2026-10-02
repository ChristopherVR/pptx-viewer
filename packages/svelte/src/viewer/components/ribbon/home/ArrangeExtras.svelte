<script lang="ts">
	import ArrangeHomeStrip from './ArrangeHomeStrip.svelte';
	/**
	 * ArrangeExtras: the multi-select-aware half of the Home tab's Arrange group,
	 * all shared elements: the align / distribute strip, the labelled Format
	 * Painter, the flip strip and the shape extras (Group, Ungroup, Merge Shapes,
	 * Crop and outline width). Z-order, Duplicate and Delete are further shared
	 * strips composed in `HomeTab`. Reads `editor.selectedElements`/`selection`
	 * and routes every mutation through `EditorState`.
	 */
	import {
		arrangePainterHomeControls,
		arrangeShapeHomeControls,
		canGroupSelection,
		canInteractWithElement,
		canMergeShapes,
		canSetStrokeWidth,
		canUngroupSelection,
		homeSnapshotTranslator,
		isActionHidden,
		strokeWidthOf,
	} from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent, ToolbarActionId } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { setStrokeWidthPatch } from '../../../editor';
	import { refocusViewerRoot } from '../anchored-popup';
	import { cropUpdateFor } from './home-crop';

	const {
		editor,
		hiddenActions,
	}: { editor: EditorState; hiddenActions?: readonly ToolbarActionId[] } = $props();
	const t = useTranslator();
	const count = $derived(editor.selection.size);
	const el = $derived(editor.selectedElement ?? null);
	// Mirrors the a:spLocks/@noGrp guard editor.arrangeOps.groupSelected already
	// enforces on the command, so a locked selection reads as disabled.
	const selectionGroupable = $derived(
		editor.selectedElements.every((element) => canInteractWithElement(element, 'group')),
	);
	const cropping = $derived(editor.cropOps.active);
	const painter = $derived({
		controls: arrangePainterHomeControls({
			editable: editor.editable,
			active: editor.formatPainter.active,
			canFormatPaint: editor.formatPainter.enabled,
			show: true,
		}),
		translate: homeSnapshotTranslator(['arrange-painter'], t),
	});
	const shape = $derived({
		controls: arrangeShapeHomeControls({
			editable: editor.editable,
			canGroup: canGroupSelection(editor.editable, count, selectionGroupable),
			canUngroup: canUngroupSelection(editor.editable, el),
			canMerge: canMergeShapes(editor.selectedElements),
			canCrop: cropping || editor.cropOps.canCrop,
			cropActive: cropping,
			canStrokeWidth: canSetStrokeWidth(editor.editable, el),
			strokeWidth: strokeWidthOf(el),
			hideMerge: isActionHidden('mergeShapes', hiddenActions),
			hideCrop: isActionHidden('crop', hiddenActions),
		}),
		translate: homeSnapshotTranslator(['arrange-shape'], t),
	});

	function requestShape(event: RibbonHomeRequestEvent): void {
		const { id, value } = event.detail;
		if (value !== undefined) {
			refocusViewerRoot(event.currentTarget as HTMLElement);
		}
		switch (id) {
			case 'home.arrange.group':
				editor.arrangeOps.groupSelected();
				break;
			case 'home.arrange.ungroup':
				editor.arrangeOps.ungroupSelected();
				break;
			case 'home.arrange.mergeShapes':
				editor.arrangeOps.mergeSelected(
					value as Parameters<typeof editor.arrangeOps.mergeSelected>[0],
				);
				break;
			case 'home.arrange.crop':
				if (value === undefined) {
					editor.cropOps.toggle();
				} else if (el) {
					const update = cropUpdateFor(el, value);
					if (update) {
						editor.cropOps.applyOnce(update);
					}
				}
				break;
			case 'home.arrange.outlineWidth':
				if (el) {
					editor.patchSelected(setStrokeWidthPatch(el, Number(value)));
				}
		}
	}
</script>

<div class="pptx-svelte-arrangex" data-pptx-chrome="control-fragment" role="group" aria-label={t('pptx.ribbon.arrange')}>
	<ArrangeHomeStrip {editor} strip="align" />
	<!-- The Arrange group's labelled Format Painter, beside the Clipboard group's
	     icon-only one; both drive the same controller. -->
	<pptx-ui-ribbon-home-arrange-painter
		state={painter}
		onhome-request={() => editor.formatPainter.toggle()}
	></pptx-ui-ribbon-home-arrange-painter>
	<ArrangeHomeStrip {editor} strip="flip" />
	<pptx-ui-ribbon-home-arrange-shape state={shape} onhome-request={requestShape}></pptx-ui-ribbon-home-arrange-shape>
</div>

<style>
	.pptx-svelte-arrangex {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
</style>
