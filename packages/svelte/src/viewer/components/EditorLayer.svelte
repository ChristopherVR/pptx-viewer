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
	/** The group the selection has drilled into (shared `group-drill`), framed dashed. */
	const enteredGroup = $derived(controller.enteredGroup);
</script>

{#if enteredGroup}
	<div
		class="pptx-svelte-entered-group"
		data-pptx-entered-group
		aria-hidden="true"
		style={`left:${enteredGroup.x * scale}px;top:${enteredGroup.y * scale}px;width:${enteredGroup.width * scale}px;height:${enteredGroup.height * scale}px`}
	></div>
{/if}

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
	{#key controller.editingId}
	<InlineTextEditor
		element={editingElement}
		box={editingBox}
		{scale}
		{spellCheck}
		collaboration={controller.inlineCollaboration}
		oninput={(text) => controller.previewInline(controller.editingId ?? '', text)}
		oncommit={(text, snapshot) => controller.commitInline(controller.editingId ?? '', text, snapshot)}
		onregister={(reader, cancel) => controller.registerInlineReader(editingElement.id, reader, cancel)}
		onretire={() => controller.retainAcceptedInlineText(true)}
		onclose={() => controller.closeInline()}
		onformat={(patch) => controller.patchSelected(patch)}
		oncopyformat={() => controller.copyFormat()}
		onpasteformat={() => controller.pasteFormat()}
		onhyperlink={() => controller.openHyperlink()}
		onfind={() => controller.toggleFind()}
		onfindreplace={() => controller.toggleFindReplace()}
	/>
	{/key}
{/if}

<style>
	/* The entered group's frame: under the member's selection chrome, never
	   in the way of a click (the layer is unscaled, so the box is in px). */
	.pptx-svelte-entered-group {
		position: absolute;
		box-sizing: border-box;
		border: 1px dashed var(--pptx-ring, #6366f1);
		opacity: 0.7;
		pointer-events: none;
		z-index: 57;
	}
</style>
