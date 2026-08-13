<script lang="ts">
	/**
	 * EditorLayer: the editing overlay mounted over the slide stage. Renders the
	 * selection box + handles (`SelectionOverlay`) and, while inline editing, the
	 * contenteditable surface (`InlineTextEditor`), both driven by the reactive
	 * `EditorController`. Pointer/keyboard wiring lives in `PowerPointViewer`
	 * (attached to the stage holder + viewer root); this component is purely the
	 * visual overlay so it can be a thin, presentation-only sibling of the stage.
	 */
	import ConnectorEndpointOverlay from './ConnectorEndpointOverlay.svelte';
	import InlineTextEditor from './InlineTextEditor.svelte';
	import SelectionOverlay from './SelectionOverlay.svelte';
	import type { EditorLayerProps } from './props';

	const { controller, scale, spellCheck = false }: EditorLayerProps = $props();

	const editingElement = $derived(controller.editingElement);
	const editingBox = $derived(
		editingElement
			? {
					x: editingElement.x,
					y: editingElement.y,
					width: editingElement.width,
					height: editingElement.height,
					rotation: editingElement.rotation ?? 0,
				}
			: null,
	);
</script>

<SelectionOverlay
	box={controller.overlayBox}
	{scale}
	snapLines={controller.snapLines}
	editing={controller.editing}
	selectionCount={controller.selectionCount}
	marquee={controller.marquee}
	interactivity={controller.interactivity}
	onhandlepointerdown={controller.onHandlePointerDown}
	onrotatepointerdown={controller.onRotatePointerDown}
	onadjustpointerdown={controller.onAdjustPointerDown}
/>

<!-- Connector endpoint authoring: drag an end onto a shape's connection point
     to bind it (`a:stCxn` / `a:endCxn`), or off one to detach. -->
{#if controller.selectedConnector}
	<ConnectorEndpointOverlay
		connector={controller.selectedConnector}
		elements={controller.activeElements}
		{scale}
		drag={controller.connectorEndpointDrag}
		onendpointpointerdown={controller.onConnectorEndpointPointerDown}
	/>
{/if}

{#if editingElement && editingBox && controller.editingId}
	<InlineTextEditor
		element={editingElement}
		box={editingBox}
		{scale}
		{spellCheck}
		oninput={(text) => controller.previewInline(controller.editingId ?? '', text)}
		oncommit={(text) => controller.commitInline(controller.editingId ?? '', text)}
		onclose={() => controller.closeInline()}
	/>
{/if}
