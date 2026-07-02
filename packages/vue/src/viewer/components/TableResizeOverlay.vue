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

function onPointerMove(event: PointerEvent): void {
	if (!drag) {
		return;
	}
	event.preventDefault();
	const delta = drag.type === 'col' ? event.clientX - drag.startPos : event.clientY - drag.startPos;
	drag.handleEl.style.transform =
		drag.type === 'col' ? `translateX(${delta}px)` : `translateY(${delta}px)`;
}

function onPointerUp(event: PointerEvent): void {
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
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	drag = null;
}

function startColDrag(event: PointerEvent, index: number): void {
	event.preventDefault();
	event.stopPropagation();
	document.body.style.cursor = 'col-resize';
	document.body.style.userSelect = 'none';
	drag = {
		type: 'col',
		index,
		startPos: event.clientX,
		handleEl: event.currentTarget as HTMLElement,
		initialWidths: [...props.columnWidths],
	};
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
}

function startRowDrag(event: PointerEvent, index: number): void {
	event.preventDefault();
	event.stopPropagation();
	const table = containerRef.value?.querySelector('table');
	const tr = table?.querySelectorAll('tbody > tr')[index] as HTMLElement | undefined;
	document.body.style.cursor = 'row-resize';
	document.body.style.userSelect = 'none';
	drag = {
		type: 'row',
		index,
		startPos: event.clientY,
		handleEl: event.currentTarget as HTMLElement,
		initialRowHeight: tr?.offsetHeight ?? DEFAULT_ROW_HEIGHT,
	};
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
}

onBeforeUnmount(() => {
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
});
</script>

<template>
	<div ref="containerRef" class="pptx-vue-table-resize relative h-full w-full">
		<slot />
		<template v-if="editable">
			<div
				v-for="(leftPct, i) in colBoundaries"
				:key="`col-h-${i}`"
				class="pptx-vue-table-resize__col group absolute bottom-0 top-0 z-10 w-[6px] cursor-col-resize"
				:style="{ left: `calc(${leftPct}% - 3px)` }"
				@pointerdown="startColDrag($event, i)"
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
				@pointerdown="startRowDrag($event, i)"
			>
				<div
					class="my-auto h-px w-full bg-transparent transition-colors group-hover:bg-blue-400/60"
				/>
			</div>
		</template>
	</div>
</template>
