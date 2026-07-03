import {
	addSmartArtNode,
	addSmartArtNodeAsChild,
	promoteSmartArtNode,
	removeSmartArtNode,
	setSmartArtNodeStyle,
	switchSmartArtLayout,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNode,
	PptxSmartArtNodeStyle,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { rebuildDrawingShapesIfCleared, resolvePalette } from 'pptx-viewer-shared';
import type { BoundingBox } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
} from './smartart-node-limits';
import {
	addSiblingAfter,
	countTopLevel,
	demoteNode,
	extraConnectionCount,
	removeEmptyNode,
	reorderNode,
	siblingCount,
	siblingIndex,
} from './smartart-node-pane-handlers';
import { useSmartArtFocus } from './useSmartArtFocus';

/**
 * useSmartArtEditing: editing logic for the Vue SmartArt inspector panel,
 * extracted out of the SFC so the component stays thin. Every mutation defers
 * to a real `pptx-viewer-core` op (no re-implementation) and emits a SHALLOW
 * `Partial<PptxElement>` patch (`{ smartArtData }`) through the supplied `apply`
 * callback, matching the inspector-panel contract (`emit('update', patch)` ->
 * `useEditorOperations.updateElement`), so undo/redo keeps working.
 */

// Re-export the static option lists + layout-label helper from their dedicated
// module so existing callers can keep importing them from this barrel.
export {
	SMARTART_COLOR_SCHEMES,
	SMARTART_STYLE_OPTIONS,
	smartArtLayoutLabel,
} from './smartart-editing-constants';

/** A node enriched with display metadata for the text-pane list. */
export interface SmartArtNodeRow {
	node: PptxSmartArtNode;
	/** Zero-based position in the flat node list. */
	index: number;
	/** 1-based display number among top-level nodes (0 for child rows). */
	displayIndex: number;
	isChild: boolean;
	/** Disable the move-up control (already first among siblings). */
	moveUpDisabled: boolean;
	/** Disable the move-down control (already last among siblings). */
	moveDownDisabled: boolean;
	/** Disable the remove control (last node, or layout minimum reached). */
	removeDisabled: boolean;
}

export interface UseSmartArtEditingInput {
	/** Current SmartArt data for the selected element. */
	smartArtData: ComputedRef<PptxSmartArtData>;
	/** Apply a shallow element patch (typically `ops.updateElement`-backed). */
	apply: (patch: Partial<PptxElement>) => void;
	/**
	 * Owning element id + pixel box, used to reflow `drawingShapes` back from the
	 * layout engine whenever an edit clears them (see `rebuildDrawingShapesIfCleared`).
	 * Omit only in tests that don't care about post-edit rendering.
	 */
	elementId?: string;
	box?: ComputedRef<BoundingBox | undefined>;
}

export interface SmartArtEditingApi {
	nodes: ComputedRef<readonly PptxSmartArtNode[]>;
	rows: ComputedRef<readonly SmartArtNodeRow[]>;
	colorScheme: ComputedRef<SmartArtColorScheme>;
	style: ComputedRef<SmartArtStyle>;
	currentLayout: ComputedRef<SmartArtLayoutType>;
	/** Number of top-level (parent-less) nodes. */
	topLevelCount: ComputedRef<number>;
	/** Whether the layout's max allows another top-level node. */
	canAdd: ComputedRef<boolean>;
	/** Human bounds hint for the active layout, or `undefined`. */
	boundsHint: ComputedRef<string | undefined>;
	/** Count of non-tree connections (read-only awareness note). */
	extraConnections: ComputedRef<number>;
	/** Id of the node input to focus after a structural edit (via input ref + nextTick). */
	pendingFocusId: Ref<string | null>;
	/** Register / unregister a node's `<input>` element for focus management. */
	setInputEl: (nodeId: string, el: HTMLInputElement | null) => void;

	updateNodeText: (nodeId: string, text: string) => void;
	setNodeStyle: (nodeId: string, style: Partial<PptxSmartArtNodeStyle>) => void;
	addItem: () => void;
	addSubItem: (parentId: string) => void;
	removeNode: (nodeId: string) => void;
	promote: (nodeId: string) => void;
	demote: (nodeId: string) => void;
	moveUp: (nodeId: string) => void;
	moveDown: (nodeId: string) => void;
	/** Keyboard handler for a node input (Enter/Backspace/Delete/Tab). */
	onNodeKeyDown: (event: KeyboardEvent, nodeId: string) => void;
	setColorScheme: (scheme: SmartArtColorScheme) => void;
	setStyle: (style: SmartArtStyle) => void;
	switchLayout: (layout: SmartArtLayoutType) => void;
}

export function useSmartArtEditing(input: UseSmartArtEditingInput): SmartArtEditingApi {
	const { smartArtData, apply } = input;

	const nodes = computed<readonly PptxSmartArtNode[]>(() => smartArtData.value.nodes ?? []);

	const colorScheme = computed<SmartArtColorScheme>(
		() => smartArtData.value.colorScheme ?? 'colorful1',
	);
	const style = computed<SmartArtStyle>(() => smartArtData.value.style ?? 'flat');
	const currentLayout = computed<SmartArtLayoutType>(
		() => smartArtData.value.resolvedLayoutType ?? 'list',
	);
	const topLevelCount = computed(() => countTopLevel(smartArtData.value));
	const canAdd = computed(() => canAddTopLevelNode(currentLayout.value, topLevelCount.value));
	const boundsHint = computed(() => describeSmartArtBounds(currentLayout.value));
	const extraConnections = computed(() => extraConnectionCount(smartArtData.value));

	const rows = computed<readonly SmartArtNodeRow[]>(() => {
		const data = smartArtData.value;
		const canRemoveTop = canRemoveTopLevelNode(currentLayout.value, topLevelCount.value);
		let topDisplay = 0;
		return nodes.value.map((node, index) => {
			const isChild = Boolean(node.parentId);
			if (!isChild) {
				topDisplay += 1;
			}
			const sIdx = siblingIndex(data, node.id);
			const sCount = siblingCount(data, node.id);
			return {
				node,
				index,
				displayIndex: isChild ? 0 : topDisplay,
				isChild,
				moveUpDisabled: sIdx <= 0,
				moveDownDisabled: sIdx < 0 || sIdx >= sCount - 1,
				removeDisabled: nodes.value.length <= 1 || (!isChild && !canRemoveTop),
			};
		});
	});

	// Refocus the node input after a structural edit (React `pendingFocusId`).
	const { pendingFocusId, setInputEl, focusNode } = useSmartArtFocus();

	/**
	 * Emit a whole new SmartArt-data object as the element patch, reflowing
	 * `drawingShapes` back from the layout engine first if the edit cleared them
	 * (every structural/text/style op does) -- otherwise the renderer falls back
	 * to the generic SVG layout for every node, not just the edited one.
	 */
	function applyData(next: PptxSmartArtData, focusId?: string): void {
		const box = input.box?.value;
		const reflowed = box
			? rebuildDrawingShapesIfCleared(
					next,
					next.layout,
					resolvePalette(next),
					next.style ?? 'flat',
					input.elementId ?? 'smartart',
					box,
				)
			: next;
		apply({ smartArtData: reflowed } as Partial<PptxElement>);
		focusNode(focusId);
	}

	/** Emit a partial merge into the current SmartArt data. */
	function patchData(patch: Partial<PptxSmartArtData>): void {
		applyData({ ...smartArtData.value, ...patch });
	}

	function updateNodeText(nodeId: string, text: string): void {
		applyData(updateSmartArtNodeText(smartArtData.value, nodeId, text));
	}

	function setNodeStyle(nodeId: string, nodeStyle: Partial<PptxSmartArtNodeStyle>): void {
		const next = setSmartArtNodeStyle(smartArtData.value, nodeId, nodeStyle);
		if (next === smartArtData.value) {
			return;
		}
		applyData(next);
	}

	function addItem(): void {
		if (!canAdd.value) {
			return;
		}
		applyData(addSmartArtNode(smartArtData.value, `Item ${nodes.value.length + 1}`));
	}

	function addSubItem(parentId: string): void {
		applyData(addSmartArtNodeAsChild(smartArtData.value, parentId, 'Sub-item'));
	}

	/** Whether removing `nodeId` is currently permitted by count + bounds. */
	function canRemove(nodeId: string): boolean {
		if (nodes.value.length <= 1) {
			return false;
		}
		const isTop = !nodes.value.find((n) => n.id === nodeId)?.parentId;
		return !isTop || canRemoveTopLevelNode(currentLayout.value, topLevelCount.value);
	}

	function removeNode(nodeId: string): void {
		if (!canRemove(nodeId)) {
			return;
		}
		applyData(removeSmartArtNode(smartArtData.value, nodeId));
	}

	function promote(nodeId: string): void {
		const next = promoteSmartArtNode(smartArtData.value, nodeId);
		if (next !== smartArtData.value) {
			applyData(next, nodeId);
		}
	}

	function demote(nodeId: string): void {
		const next = demoteNode(smartArtData.value, nodeId);
		if (next) {
			applyData(next, nodeId);
		}
	}

	function move(nodeId: string, direction: 1 | -1): void {
		const next = reorderNode(smartArtData.value, nodeId, direction);
		if (next) {
			applyData(next, nodeId);
		}
	}

	const moveUp = (nodeId: string): void => move(nodeId, -1);
	const moveDown = (nodeId: string): void => move(nodeId, 1);

	function onNodeKeyDown(event: KeyboardEvent, nodeId: string): void {
		const node = nodes.value.find((n) => n.id === nodeId);
		const isEmpty = !node?.text;
		if (event.key === 'Enter') {
			event.preventDefault();
			const result = addSiblingAfter(smartArtData.value, nodeId);
			if (result) {
				applyData(result.data, result.focusNodeId);
			}
		} else if ((event.key === 'Backspace' || event.key === 'Delete') && isEmpty) {
			if (!canRemove(nodeId)) {
				return;
			}
			event.preventDefault();
			const result = removeEmptyNode(smartArtData.value, nodeId);
			if (result) {
				applyData(result.data, result.focusNodeId);
			}
		} else if (event.key === 'Tab' && !event.shiftKey) {
			event.preventDefault();
			demote(nodeId);
		} else if (event.key === 'Tab' && event.shiftKey) {
			event.preventDefault();
			promote(nodeId);
		}
	}

	function setColorScheme(scheme: SmartArtColorScheme): void {
		if (scheme === colorScheme.value) {
			return;
		}
		patchData({ colorScheme: scheme });
	}

	function setStyle(next: SmartArtStyle): void {
		if (next === style.value) {
			return;
		}
		patchData({ style: next });
	}

	function switchLayout(layout: SmartArtLayoutType): void {
		if (layout === currentLayout.value) {
			return;
		}
		const updated = switchSmartArtLayout(smartArtData.value, layout);
		// drawingShapes must be forwarded (cleared to undefined) so the reflow
		// pipeline regenerates shapes for the new layout instead of keeping the
		// old layout's stale shapes.
		patchData({
			layoutType: updated.layoutType,
			resolvedLayoutType: updated.resolvedLayoutType,
			layout: updated.layout,
			drawingShapes: updated.drawingShapes,
		});
	}

	return {
		nodes,
		rows,
		colorScheme,
		style,
		currentLayout,
		topLevelCount,
		canAdd,
		boundsHint,
		extraConnections,
		pendingFocusId,
		setInputEl,
		updateNodeText,
		setNodeStyle,
		addItem,
		addSubItem,
		removeNode,
		promote,
		demote,
		moveUp,
		moveDown,
		onNodeKeyDown,
		setColorScheme,
		setStyle,
		switchLayout,
	};
}
