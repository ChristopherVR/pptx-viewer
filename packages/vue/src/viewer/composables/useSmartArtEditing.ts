import {
	addSmartArtNode,
	addSmartArtNodeAsChild,
	demoteSmartArtNode,
	promoteSmartArtNode,
	removeSmartArtNode,
	reorderSmartArtNode,
	switchSmartArtLayout,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNode,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';

/**
 * useSmartArtEditing: framework-agnostic-ish editing logic for the Vue SmartArt
 * inspector panel, extracted out of the SFC so the component stays thin.
 *
 * Every mutation defers to a real `pptx-viewer-core` op (no re-implementation)
 * and emits a SHALLOW `Partial<PptxElement>` patch (`{ smartArtData }`) through
 * the supplied `apply` callback, matching the uniform inspector-panel contract
 * (`emit('update', patch)` -> `useEditorOperations.updateElement`). Going
 * through that single history-tracked path keeps undo/redo working.
 */

export const SMARTART_COLOR_SCHEMES: readonly SmartArtColorScheme[] = [
	'colorful1',
	'colorful2',
	'colorful3',
	'monochromatic1',
	'monochromatic2',
];

export const SMARTART_STYLE_OPTIONS: readonly SmartArtStyle[] = ['flat', 'moderate', 'intense'];

/** Human labels for switchable layout categories. Falls back to the raw key. */
const SMARTART_LAYOUT_LABEL_MAP: Partial<Record<SmartArtLayoutType, string>> = {
	list: 'List',
	process: 'Process',
	cycle: 'Cycle',
	hierarchy: 'Hierarchy',
	matrix: 'Matrix',
	pyramid: 'Pyramid',
	relationship: 'Relationship',
	venn: 'Venn',
	funnel: 'Funnel',
	target: 'Target',
	gear: 'Gear',
	timeline: 'Timeline',
	chevron: 'Chevron',
	bending: 'Bending',
};

/** Title-case fallback for any layout type without an explicit label. */
export function smartArtLayoutLabel(layout: SmartArtLayoutType): string {
	return SMARTART_LAYOUT_LABEL_MAP[layout] ?? layout.charAt(0).toUpperCase() + layout.slice(1);
}

/** A node enriched with display metadata for the text-pane list. */
export interface SmartArtNodeRow {
	node: PptxSmartArtNode;
	index: number;
	isChild: boolean;
}

export interface UseSmartArtEditingInput {
	/** Current SmartArt data for the selected element. */
	smartArtData: ComputedRef<PptxSmartArtData>;
	/** Apply a shallow element patch (typically `ops.updateElement`-backed). */
	apply: (patch: Partial<PptxElement>) => void;
}

export interface SmartArtEditingApi {
	nodes: ComputedRef<readonly PptxSmartArtNode[]>;
	rows: ComputedRef<readonly SmartArtNodeRow[]>;
	colorScheme: ComputedRef<SmartArtColorScheme>;
	style: ComputedRef<SmartArtStyle>;
	currentLayout: ComputedRef<SmartArtLayoutType>;

	updateNodeText: (nodeId: string, text: string) => void;
	addItem: () => void;
	addSubItem: (parentId: string) => void;
	removeNode: (nodeId: string) => void;
	promote: (nodeId: string) => void;
	demote: (nodeId: string) => void;
	moveUp: (nodeId: string) => void;
	moveDown: (nodeId: string) => void;
	setColorScheme: (scheme: SmartArtColorScheme) => void;
	setStyle: (style: SmartArtStyle) => void;
	switchLayout: (layout: SmartArtLayoutType) => void;
}

export function useSmartArtEditing(input: UseSmartArtEditingInput): SmartArtEditingApi {
	const { smartArtData, apply } = input;

	const nodes = computed<readonly PptxSmartArtNode[]>(() => smartArtData.value.nodes ?? []);

	const rows = computed<readonly SmartArtNodeRow[]>(() =>
		nodes.value.map((node, index) => ({
			node,
			index,
			isChild: Boolean(node.parentId),
		})),
	);

	const colorScheme = computed<SmartArtColorScheme>(
		() => smartArtData.value.colorScheme ?? 'colorful1',
	);
	const style = computed<SmartArtStyle>(() => smartArtData.value.style ?? 'flat');
	const currentLayout = computed<SmartArtLayoutType>(
		() => smartArtData.value.resolvedLayoutType ?? 'list',
	);

	/** Emit a whole new SmartArt-data object as the element patch. */
	function applyData(next: PptxSmartArtData): void {
		apply({ smartArtData: next } as Partial<PptxElement>);
	}

	/** Emit a partial merge into the current SmartArt data. */
	function patchData(patch: Partial<PptxSmartArtData>): void {
		applyData({ ...smartArtData.value, ...patch });
	}

	function updateNodeText(nodeId: string, text: string): void {
		applyData(updateSmartArtNodeText(smartArtData.value, nodeId, text));
	}

	function addItem(): void {
		applyData(addSmartArtNode(smartArtData.value, `Item ${nodes.value.length + 1}`));
	}

	function addSubItem(parentId: string): void {
		applyData(addSmartArtNodeAsChild(smartArtData.value, parentId, 'Sub-item'));
	}

	function removeNode(nodeId: string): void {
		if (nodes.value.length <= 1) {
			return;
		}
		applyData(removeSmartArtNode(smartArtData.value, nodeId));
	}

	function promote(nodeId: string): void {
		applyData(promoteSmartArtNode(smartArtData.value, nodeId));
	}

	function demote(nodeId: string): void {
		applyData(demoteSmartArtNode(smartArtData.value, nodeId));
	}

	function moveUp(nodeId: string): void {
		applyData(reorderSmartArtNode(smartArtData.value, nodeId, -1));
	}

	function moveDown(nodeId: string): void {
		applyData(reorderSmartArtNode(smartArtData.value, nodeId, 1));
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
		patchData({
			layoutType: updated.layoutType,
			resolvedLayoutType: updated.resolvedLayoutType,
			layout: updated.layout,
		});
	}

	return {
		nodes,
		rows,
		colorScheme,
		style,
		currentLayout,
		updateNodeText,
		addItem,
		addSubItem,
		removeNode,
		promote,
		demote,
		moveUp,
		moveDown,
		setColorScheme,
		setStyle,
		switchLayout,
	};
}
