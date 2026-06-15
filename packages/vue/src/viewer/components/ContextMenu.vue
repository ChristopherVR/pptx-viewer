<script lang="ts">
/**
 * ContextMenu — generic right-click menu for the Vue editor.
 *
 * Vue port of the React `ContextMenu` component (see
 * `packages/react/src/viewer/components/ContextMenu.tsx`), generalised into a
 * data-driven menu: the caller supplies the item list and maps `select(id)`
 * back to editor operations.
 */
export interface ContextMenuItem {
	/** Stable id emitted via `select`. Ignored for separators. */
	id: string;
	/** Visible label. */
	label: string;
	/** When true the item is shown greyed-out and is non-interactive. */
	disabled?: boolean;
	/** When true the entry renders as a divider instead of a button. */
	separator?: boolean;
}
</script>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{
	open: boolean;
	x: number;
	y: number;
	items: ContextMenuItem[];
}>();

const emit = defineEmits<{
	select: [id: string];
	close: [];
}>();

const menuRef = ref<HTMLElement | null>(null);

/** Measured size of the menu, used to clamp it inside the viewport. */
const menuSize = ref<{ width: number; height: number }>({ width: 0, height: 0 });

const MARGIN = 8;

const position = computed<{ left: number; top: number }>(() => {
	const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
	const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

	let left = props.x;
	let top = props.y;

	if (vw > 0) {
		const maxLeft = Math.max(MARGIN, vw - menuSize.value.width - MARGIN);
		left = Math.min(Math.max(left, MARGIN), maxLeft);
	} else {
		left = Math.max(left, MARGIN);
	}

	if (vh > 0) {
		const maxTop = Math.max(MARGIN, vh - menuSize.value.height - MARGIN);
		top = Math.min(Math.max(top, MARGIN), maxTop);
	} else {
		top = Math.max(top, MARGIN);
	}

	return { left, top };
});

const menuStyle = computed<CSSProperties>(() => ({
	left: `${position.value.left}px`,
	top: `${position.value.top}px`,
}));

function onItemClick(item: ContextMenuItem): void {
	if (item.separator || item.disabled) {
		return;
	}
	emit('select', item.id);
	emit('close');
}

function close(): void {
	emit('close');
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.preventDefault();
		close();
	}
}

function onOutsidePointer(event: MouseEvent): void {
	const target = event.target as Node | null;
	if (menuRef.value && target && menuRef.value.contains(target)) {
		return;
	}
	close();
}

function onOutsideContextMenu(event: MouseEvent): void {
	event.preventDefault();
	const target = event.target as Node | null;
	if (menuRef.value && target && menuRef.value.contains(target)) {
		return;
	}
	close();
}

function addListeners(): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.addEventListener('keydown', onKeydown, true);
	window.addEventListener('mousedown', onOutsidePointer, true);
	window.addEventListener('contextmenu', onOutsideContextMenu, true);
}

function removeListeners(): void {
	if (typeof window === 'undefined') {
		return;
	}
	window.removeEventListener('keydown', onKeydown, true);
	window.removeEventListener('mousedown', onOutsidePointer, true);
	window.removeEventListener('contextmenu', onOutsideContextMenu, true);
}

watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			addListeners();
			void nextTick(() => {
				const el = menuRef.value;
				if (el) {
					menuSize.value = { width: el.offsetWidth, height: el.offsetHeight };
				}
			});
		} else {
			removeListeners();
			menuSize.value = { width: 0, height: 0 };
		}
	},
	{ immediate: true },
);

onBeforeUnmount(removeListeners);
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			ref="menuRef"
			class="pptx-vue-context-menu"
			role="menu"
			:style="menuStyle"
			data-pptx-context-menu="true"
			@contextmenu.prevent
		>
			<template v-for="(item, index) in items" :key="item.separator ? `sep-${index}` : item.id">
				<div v-if="item.separator" class="pptx-vue-context-menu__separator" role="separator" />
				<button
					v-else
					type="button"
					role="menuitem"
					class="pptx-vue-context-menu__item"
					:class="{ 'pptx-vue-context-menu__item--disabled': item.disabled }"
					:disabled="item.disabled"
					:aria-disabled="item.disabled ? 'true' : undefined"
					:data-item-id="item.id"
					@click="onItemClick(item)"
				>
					{{ item.label }}
				</button>
			</template>
		</div>
	</Teleport>
</template>

<style scoped>
.pptx-vue-context-menu {
	position: fixed;
	z-index: 120;
	min-width: 180px;
	padding: 0.375rem 0;
	border: 1px solid var(--pptx-vue-border, rgba(0, 0, 0, 0.15));
	border-radius: 6px;
	background: var(--pptx-vue-popover, #ffffff);
	color: var(--pptx-vue-foreground, #1a1a1a);
	box-shadow:
		0 10px 15px -3px rgba(0, 0, 0, 0.3),
		0 4px 6px -4px rgba(0, 0, 0, 0.3);
	font-size: 0.75rem;
	line-height: 1rem;
	user-select: none;
}

.pptx-vue-context-menu__item {
	display: block;
	width: 100%;
	padding: 0.375rem 0.75rem;
	border: 0;
	background: transparent;
	color: inherit;
	text-align: left;
	font: inherit;
	cursor: pointer;
}

.pptx-vue-context-menu__item:hover:not(.pptx-vue-context-menu__item--disabled),
.pptx-vue-context-menu__item:focus-visible {
	background: var(--pptx-vue-muted, rgba(0, 0, 0, 0.06));
	outline: none;
}

.pptx-vue-context-menu__item--disabled {
	opacity: 0.45;
	cursor: default;
	pointer-events: none;
}

.pptx-vue-context-menu__separator {
	height: 0;
	margin: 0.25rem 0;
	border-top: 1px solid var(--pptx-vue-border, rgba(0, 0, 0, 0.15));
}
</style>
