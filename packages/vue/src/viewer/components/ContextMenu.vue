<script lang="ts">
/**
 * ContextMenu: generic right-click menu for the Vue editor.
 *
 * A thin adapter around the shared `pptx-ui-context-menu` element, which owns the
 * rows, keyboard navigation, positioning, dismissal and focus restore. The caller
 * supplies the item list and maps `select(id)` back to editor operations.
 */
export interface ContextMenuItem {
	onSelect?: () => void;
	/** Stable id emitted via `select`. Ignored for separators. */
	id: string;
	/** Visible label. */
	label: string;
	/** When true the item is shown greyed-out and is non-interactive. */
	disabled?: boolean;
	/** When true the entry renders as a divider instead of a button. */
	separator?: boolean;
	/** Destructive command (Delete): tinted. */
	danger?: boolean;
	/** Group heading shown before this entry (slide-show menu sections). */
	heading?: string;
	/**
	 * A checkbox-style toggle (Grid and Guides, Ruler) in this state, rather
	 * than a one-shot command. Omitted for ordinary commands, which keep
	 * `role="menuitem"`.
	 */
	checked?: boolean;
}
</script>

<script setup lang="ts">
import { CONTEXT_MENU_PRESENTATION_LAYER } from 'pptx-viewer-shared';
import type { ContextMenuViewItem, ContextMenuViewState } from 'pptx-viewer-shared';
import { computed } from 'vue';

const props = defineProps<{
	open: boolean;
	x: number;
	y: number;
	items: ContextMenuItem[];
	/**
	 * Accessible name for the menu. Without one a screen reader announces an
	 * unnamed menu, which is what three of the five bindings used to do.
	 */
	ariaLabel?: string;
	/** Adds `data-pptx-canvas-context-menu="true"` alongside the usual marker. */
	isCanvasMenu?: boolean;
	/** Extra `data-pptx-*` test hooks for this menu (for example the slide-pane marker). */
	markers?: string[];
	/**
	 * The slide-show menu: stacks above the presentation overlay with its own marker and
	 * renders in place, because a fullscreen overlay hides everything outside its subtree.
	 */
	presentation?: boolean;
}>();

const emit = defineEmits<{
	select: [id: string];
	close: [];
}>();

/** Separator entries fold into the next row's `separatorBefore`. */
const rows = computed<ContextMenuViewItem[]>(() => {
	const out: ContextMenuViewItem[] = [];
	let rule = false;
	for (const item of props.items) {
		if (item.separator) {
			rule = true;
			continue;
		}
		out.push({
			id: item.id,
			label: item.label,
			separatorBefore: rule && out.length > 0,
			heading: item.heading,
			danger: item.danger,
			disabled: item.disabled,
			checked: item.checked,
		});
		rule = false;
	}
	return out;
});

const state = computed<ContextMenuViewState>(() => ({
	x: props.x,
	y: props.y,
	label: props.ariaLabel ?? '',
	items: rows.value,
	markers: [
		...(props.presentation ? ['data-pptx-presentation-menu'] : ['data-pptx-context-menu']),
		...(props.isCanvasMenu ? ['data-pptx-canvas-context-menu'] : []),
		...(props.markers ?? []),
	],
	zIndex: props.presentation ? CONTEXT_MENU_PRESENTATION_LAYER : undefined,
}));

function onRequest(event: Event): void {
	const id = (event as CustomEvent<{ id: string }>).detail.id;
	const item = props.items.find((candidate) => !candidate.separator && candidate.id === id);
	if (!item || item.disabled) {
		return;
	}
	if (item.onSelect) {
		emit('close');
		item.onSelect();
	} else {
		emit('select', item.id);
		emit('close');
	}
}
</script>

<template>
	<Teleport to="body" :disabled="presentation">
		<pptx-ui-context-menu
			v-if="open && rows.length > 0"
			:state.prop="state"
			@menu-request="onRequest"
			@menu-close="emit('close')"
		/>
	</Teleport>
</template>
