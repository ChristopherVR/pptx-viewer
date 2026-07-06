<script setup lang="ts">
import {
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
	DEFAULT_ROW_HEIGHT,
} from 'pptx-viewer-shared';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

/**
 * TableResizeOverlay: Vue port of React's `utils/table-render-resize.tsx`.
 *
 * Wraps a rendered table (default slot) and, when `editable`, draws draggable
 * column-boundary and row-boundary handles on top. Column boundaries are placed
 * from the proportional widths; row boundaries are measured from the mounted
 * `<tr>` heights. The pure drag math (redistribute two adjacent column
 * proportions, clamp a dragged row height) lives in `pptx-viewer-shared`
 * (`render/table-resize.ts`), so this component only owns the DOM interaction.
 */
const props = defineProps<{
	/** Column widths as proportions summing to ~1. */
	columnWidths: number[];
	/** When false the overlay renders only the slotted table (no handles). */
	editable: boolean;
}>();

const emit = defineEmits<{
	/** New column widths (proportions summing to 1) after a column drag. */
	resizeColumns: [widths: number[]];
	/** New pixel height for `rowIndex` after a row drag. */
	resizeRow: [rowIndex: number, height: number];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
/** Cumulative bottom-edge pixel positions of the internal row boundaries. */
const rowBounds = ref<number[]>([]);

interface DragState {
	type: 'col' | 'row';
	index: number;
	startPos: number;
	handleEl: HTMLElement;
	initialWidths?: number[];
	initialRowHeight?: number;
}
let drag: DragState | null = null;

/** Cumulative left-edge percentages of the internal column boundaries. */
const colBoundaries = computed<number[]>(() => computeColumnBoundaries(props.columnWidths));

/** Measure row boundaries from the mounted table rows (skip the last edge). */
function measureRows(): void {
	const container = containerRef.value;
	const table = container?.querySelector('table');
	if (!table) {
		return;
	}
	const trs = table.querySelectorAll('tbody > tr');
	const bounds: number[] = [];
	let cumulative = 0;
	trs.forEach((tr, i) => {
		cumulative += (tr as HTMLElement).offsetHeight;
		if (i < trs.length - 1) {
			bounds.push(cumulative);
		}
	});
	const prev = rowBounds.value;
	const same = prev.length === bounds.length && prev.every((v, i) => v === bounds[i]);
	if (!same) {
		rowBounds.value = bounds;
	}
}

// Re-measure whenever the widths change (a proxy for content/layout changes).
watch(
	() => [props.columnWidths, props.editable] as const,
	() => {
		void nextTick(measureRows);
	},
	{ immediate: true, deep: true },
);

function onMouseMove(event: MouseEvent): void {
	if (!drag) {
		return;
	}
	event.preventDefault();
	const delta = drag.type === 'col' ? event.clientX - drag.startPos : event.clientY - drag.startPos;
	drag.handleEl.style.transform =
		drag.type === 'col' ? `translateX(${delta}px)` : `translateY(${delta}px)`;
}

function onMouseUp(event: MouseEvent): void {
	const container = containerRef.value;
	if (!drag || !container) {
		return;
	}
	const rect = container.getBoundingClientRect();
	if (drag.type === 'col' && drag.initialWidths) {
		const deltaProp = (event.clientX - drag.startPos) / rect.width;
		emit('resizeColumns', computeResizedColumnWidths(drag.initialWidths, drag.index, deltaProp));
	} else if (drag.type === 'row') {
		const deltaY = event.clientY - drag.startPos;
		emit(
			'resizeRow',
			drag.index,
			computeResizedRowHeight(drag.initialRowHeight ?? DEFAULT_ROW_HEIGHT, deltaY),
		);
	}
	drag.handleEl.style.transform = '';
	document.body.style.cursor = '';
	document.body.style.userSelect = '';
	window.removeEventListener('mousemove', onMouseMove);
	window.removeEventListener('mouseup', onMouseUp);
	drag = null;
}

/** Proximity-based drag initiation: detect clicks near column/row boundaries. */
const HANDLE_ZONE = 3; // px tolerance for boundary hit detection
function onContainerMouseDown(event: MouseEvent): void {
	if (!props.editable) {
		return;
	}
	const container = containerRef.value;
	if (!container) {
		return;
	}
	const rect = container.getBoundingClientRect();
	const localX = event.clientX - rect.left;
	const localY = event.clientY - rect.top;

	// Check column boundaries
	for (let i = 0; i < colBoundaries.value.length; i++) {
		const boundaryX = (colBoundaries.value[i] / 100) * rect.width;
		if (Math.abs(localX - boundaryX) <= HANDLE_ZONE) {
			event.preventDefault();
			event.stopPropagation();
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
			drag = {
				type: 'col',
				index: i,
				startPos: event.clientX,
				handleEl: container,
				initialWidths: [...props.columnWidths],
			};
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onMouseUp);
			return;
		}
	}

	// Check row boundaries
	for (let i = 0; i < rowBounds.value.length; i++) {
		if (Math.abs(localY - rowBounds.value[i]) <= HANDLE_ZONE) {
			event.preventDefault();
			event.stopPropagation();
			const table = container.querySelector('table');
			const tr = table?.querySelectorAll('tbody > tr')[i] as HTMLElement | undefined;
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
			drag = {
				type: 'row',
				index: i,
				startPos: event.clientY,
				handleEl: container,
				initialRowHeight: tr?.offsetHeight ?? DEFAULT_ROW_HEIGHT,
			};
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onMouseUp);
			return;
		}
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('mousemove', onMouseMove);
	window.removeEventListener('mouseup', onMouseUp);
});
</script>

<template>
	<div
		ref="containerRef"
		class="pptx-vue-table-resize relative h-full w-full"
		@mousedown="onContainerMouseDown"
	>
		<slot />
		<template v-if="editable">
			<div
				v-for="(leftPct, i) in colBoundaries"
				:key="`col-h-${i}`"
				class="pptx-vue-table-resize__col group absolute bottom-0 top-0 z-10 w-[6px] cursor-col-resize"
				:style="{ left: `calc(${leftPct}% - 3px)` }"
			>
				<div
					class="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-blue-400/60"
				/>
			</div>
			<div
				v-for="(topPx, i) in rowBounds"
				:key="`row-h-${i}`"
				class="pptx-vue-table-resize__row group absolute left-0 right-0 z-10 h-[6px] cursor-row-resize"
				:style="{ top: `${topPx - 3}px` }"
			>
				<div
					class="my-auto h-px w-full bg-transparent transition-colors group-hover:bg-blue-400/60"
				/>
			</div>
		</template>
	</div>
</template>

<style scoped>
/*
 * Resize handles must be transparent to pointer events. They sit above the
 * table cells (z-10) purely for visual stacking (hover indicator), but mouse
 * drag initiation is handled by the container's proximity-based mousedown
 * delegation below. This ensures touch taps always pass through to the
 * underlying table cells (enabling double-tap-to-edit on mobile) while
 * keeping the desktop mouse drag-to-resize functional.
 */
.pptx-vue-table-resize__col,
.pptx-vue-table-resize__row {
	pointer-events: none;
}
</style>
