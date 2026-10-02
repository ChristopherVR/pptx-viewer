<script lang="ts">
	/**
	 * DrawingGroup: the Home tab's Drawing controls, all in the shared
	 * `pptx-ui-ribbon-home-drawing` element: the Shapes gallery and Arrange
	 * z-order menu, the Shape Fill and Shape Outline colour popovers (theme,
	 * standard and recent colours), and the Quick Styles (Shape Styles) and Shape
	 * Effects galleries. Edits run through `EditorState` and the ribbon gallery host.
	 */
	import { hasShapeProperties } from 'pptx-viewer-core';
	import {
		drawingHomeControls,
		fillColorOf,
		homeGalleryControls,
		homeSnapshotTranslator,
		strokeColorOf,
		withHomeGalleries,
	} from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ZOrderDirection } from '../../../editor';
	import { newPresetShapeElement, setSolidFillPatch, setStrokeColorPatch } from '../../../editor';
	import { refocusViewerRoot } from '../anchored-popup';
	import { useRibbonGalleryHost } from '../galleries/ribbon-gallery-host';
	import { homeGalleryId } from './home-adapter';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const host = useRibbonGalleryHost();

	const el = $derived(editor.selectedElement);
	const hasShape = $derived(el !== undefined && hasShapeProperties(el));
	const style = $derived(el && hasShapeProperties(el) ? el.shapeStyle : undefined);
	const hex = (value: string, fallback: string): string => (/^#/.test(value) ? value : fallback);

	// Fill and Outline need a selected shape (not merely a selection), and obey
	// read-only mode like every other trigger.
	const view = $derived.by(() => {
		const controls = drawingHomeControls({
			editable: editor.editable,
			hasSelection: Boolean(editor.selectedElementId),
			fill: {
				value: el && hasShape ? hex(fillColorOf(el), '#ffffff') : '#ffffff',
				ref: style?.fillColorRef,
				themeColors: editor.themeColorMap,
				recent: editor.mruColors,
			},
			outline: {
				value: el && hasShape ? hex(strokeColorOf(el), '#000000') : '#000000',
				ref: style?.strokeColorRef,
				themeColors: editor.themeColorMap,
				recent: editor.mruColors,
			},
		});
		const noShape = !editor.editable || !hasShape;
		return {
			controls: withHomeGalleries(
				{
					...controls,
					'home.drawing.shapeFill': { ...controls['home.drawing.shapeFill'], disabled: noShape },
					'home.drawing.shapeOutline': {
						...controls['home.drawing.shapeOutline'],
						disabled: noShape,
					},
				},
				homeGalleryControls('drawing', host?.context() ?? { element: el ?? null }, editor.editable),
				editor.editable,
			),
			translate: homeSnapshotTranslator(['drawing'], t),
		};
	});

	function request(event: RibbonHomeRequestEvent): void {
		const { id, value, ref } = event.detail;
		const pick = value !== undefined;
		if (pick) {
			refocusViewerRoot(event.currentTarget as HTMLElement);
		}
		switch (id) {
			case 'home.drawing.shapes':
				editor.insertElement(newPresetShapeElement(String(value) as never));
				break;
			case 'home.drawing.arrange':
				editor.reorderSelected(String(value) as ZOrderDirection);
				break;
			case 'home.drawing.shapeFill':
				if (el) {
					editor.patchSelected(setSolidFillPatch(el, String(value), ref));
				}
				editor.recordRecentColor(String(value));
				break;
			case 'home.drawing.shapeOutline':
				if (el) {
					editor.patchSelected(setStrokeColorPatch(el, String(value), ref));
				}
				editor.recordRecentColor(String(value));
				break;
			default: {
				const gallery = homeGalleryId('drawing', id);
				if (gallery && pick) {
					void host?.apply(gallery, String(value));
				}
			}
		}
	}
</script>

<div class="pptx-svelte-drawgrp">
	<pptx-ui-ribbon-home-drawing state={view} onhome-request={request}></pptx-ui-ribbon-home-drawing>
</div>

<style>
	.pptx-svelte-drawgrp {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
</style>
