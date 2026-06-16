<script setup lang="ts">
/**
 * EditorToolbar — Vue port of a viewer-first subset of React's `Toolbar.tsx`.
 *
 * A compact, self-contained editing ribbon. It contains no business logic:
 * every button maps to a typed emit that the parent (`PowerPointViewer.vue`)
 * wires into history / editor-operation handlers. The component only reflects
 * enablement state via its props (`canUndo`, `canRedo`, `hasSelection`) and
 * displays the current zoom level (`zoomPercent`).
 *
 * Icons are minimal inline SVG / unicode glyphs — no external icon dependency
 * (React uses lucide; the Vue port stays dependency-free here).
 */

/** Shape presets offered by the Insert group. Mirrors React's `newShapeType`. */
export type ShapePreset = 'rect' | 'ellipse' | 'roundRect' | 'triangle';

interface Props {
	/** Whether an undo step is available (disables the Undo button when false). */
	canUndo: boolean;
	/** Whether a redo step is available (disables the Redo button when false). */
	canRedo: boolean;
	/** Current zoom level, as a whole percentage (e.g. `100`). */
	zoomPercent: number;
	/** Whether one or more elements are selected (gates the selection actions). */
	hasSelection: boolean;
	/** Whether the format painter is currently armed. */
	formatPainterActive?: boolean;
	/** Whether the current selection exposes a copyable format (arms the painter). */
	canActivateFormatPainter?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	undo: [];
	redo: [];
	'zoom-in': [];
	'zoom-out': [];
	'zoom-reset': [];
	'add-text': [];
	'add-shape': [preset: ShapePreset];
	'delete-selected': [];
	'duplicate-selected': [];
	'bring-forward': [];
	'send-backward': [];
	'toggle-format-painter': [];
}>();

/** Shape presets rendered as a small button cluster in the Insert group. */
const SHAPE_PRESETS: ReadonlyArray<{ preset: ShapePreset; label: string }> = [
	{ preset: 'rect', label: 'Rectangle' },
	{ preset: 'ellipse', label: 'Ellipse' },
	{ preset: 'roundRect', label: 'Rounded rectangle' },
	{ preset: 'triangle', label: 'Triangle' },
];

/**
 * Shared toolbar-button utility classes — mirrors React's bordered icon button
 * (semantic tokens: border, foreground, primary hover) so the Vue chrome reads
 * identically. Applied alongside the `pptx-vue-tb-btn` test hook.
 */
const TB_BTN =
	'inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-md border border-border bg-transparent text-foreground text-base leading-none cursor-pointer hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed';
</script>

<template>
	<div
		class="pptx-vue-editor-toolbar flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card"
		role="toolbar"
		aria-label="Editing toolbar"
	>
		<!-- History -->
		<div class="pptx-vue-tb-group flex items-center gap-1" role="group" aria-label="History">
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Undo"
				title="Undo"
				:disabled="!props.canUndo"
				@click="emit('undo')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						d="M9 7L4 12l5 5M4 12h11a4 4 0 0 1 0 8h-1"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Redo"
				title="Redo"
				:disabled="!props.canRedo"
				@click="emit('redo')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						d="M15 7l5 5-5 5M20 12H9a4 4 0 0 0 0 8h1"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>

		<span class="pptx-vue-tb-sep w-px h-6 bg-border" aria-hidden="true" />

		<!-- Zoom -->
		<div class="pptx-vue-tb-group flex items-center gap-1" role="group" aria-label="Zoom">
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Zoom out"
				title="Zoom out"
				@click="emit('zoom-out')"
			>
				<span aria-hidden="true">−</span>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-zoom tabular-nums text-[0.85rem]"
				:class="TB_BTN"
				aria-label="Reset zoom to 100%"
				title="Reset zoom"
				@click="emit('zoom-reset')"
			>
				{{ props.zoomPercent }}%
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Zoom in"
				title="Zoom in"
				@click="emit('zoom-in')"
			>
				<span aria-hidden="true">+</span>
			</button>
		</div>

		<span class="pptx-vue-tb-sep w-px h-6 bg-border" aria-hidden="true" />

		<!-- Insert -->
		<div class="pptx-vue-tb-group flex items-center gap-1" role="group" aria-label="Insert">
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-text font-bold font-serif"
				:class="TB_BTN"
				aria-label="Add text box"
				title="Add text box"
				@click="emit('add-text')"
			>
				<span aria-hidden="true">T</span>
			</button>
			<button
				v-for="s in SHAPE_PRESETS"
				:key="s.preset"
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				:aria-label="`Add ${s.label}`"
				:title="`Add ${s.label}`"
				@click="emit('add-shape', s.preset)"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<rect
						v-if="s.preset === 'rect'"
						x="4"
						y="6"
						width="16"
						height="12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<ellipse
						v-else-if="s.preset === 'ellipse'"
						cx="12"
						cy="12"
						rx="8"
						ry="6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<rect
						v-else-if="s.preset === 'roundRect'"
						x="4"
						y="6"
						width="16"
						height="12"
						rx="4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<path
						v-else
						d="M12 5l8 14H4z"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>

		<span class="pptx-vue-tb-sep w-px h-6 bg-border" aria-hidden="true" />

		<!-- Arrange (selection-gated) -->
		<div class="pptx-vue-tb-group flex items-center gap-1" role="group" aria-label="Arrange">
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-painter"
				:class="[
					TB_BTN,
					props.formatPainterActive
						? 'is-active !bg-amber-600 !border-amber-600 !text-amber-50 hover:!bg-amber-500 hover:!border-amber-500'
						: '',
				]"
				data-testid="format-painter-toggle"
				:data-active="props.formatPainterActive ? 'true' : 'false'"
				aria-label="Format painter"
				title="Format painter"
				:disabled="!props.canActivateFormatPainter && !props.formatPainterActive"
				@click="emit('toggle-format-painter')"
			>
				<span aria-hidden="true">🖌</span>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Duplicate selection"
				title="Duplicate"
				:disabled="!props.hasSelection"
				@click="emit('duplicate-selected')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<rect
						x="8"
						y="8"
						width="11"
						height="11"
						rx="1.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<path
						d="M5 15V6a1 1 0 0 1 1-1h9"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Bring forward"
				title="Bring forward"
				:disabled="!props.hasSelection"
				@click="emit('bring-forward')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<rect x="9" y="3" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.85" />
					<rect
						x="3"
						y="9"
						width="12"
						height="12"
						rx="1.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				aria-label="Send backward"
				title="Send backward"
				:disabled="!props.hasSelection"
				@click="emit('send-backward')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<rect x="3" y="9" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.85" />
					<rect
						x="9"
						y="3"
						width="12"
						height="12"
						rx="1.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-danger hover:!border-destructive hover:!text-destructive"
				:class="TB_BTN"
				aria-label="Delete selection"
				title="Delete"
				:disabled="!props.hasSelection"
				@click="emit('delete-selected')"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
</template>
