<script setup lang="ts">
/**
 * EditorToolbar: Vue port of a viewer-first subset of React's `Toolbar.tsx`.
 *
 * A compact, self-contained editing ribbon. It contains no business logic:
 * every button maps to a typed emit that the parent (`PowerPointViewer.vue`)
 * wires into history / editor-operation handlers. The component only reflects
 * enablement state via its props (`canUndo`, `canRedo`, `hasSelection`) and
 * displays the current zoom level (`zoomPercent`).
 *
 * Icons come from `lucide-vue-next`, matching the `react-icons/lu` glyph React
 * picks for the same control so both bindings read identically. The shape
 * presets keep their literal inline SVG outlines: they preview the shape that
 * is about to be inserted rather than naming a command.
 *
 * The Arrange group is extracted into ArrangeButtonGroup.vue to keep this
 * file under the 300-LOC limit.
 */
import { Minus, Plus, Redo, Type, Undo } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import ArrangeButtonGroup from './ArrangeButtonGroup.vue';

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

const { t } = useI18n();

/** Shape presets rendered as a small button cluster in the Insert group. */
const SHAPE_PRESETS: ReadonlyArray<{ preset: ShapePreset; labelKey: string }> = [
	{ preset: 'rect', labelKey: 'pptx.editorToolbar.shapeRectangle' },
	{ preset: 'ellipse', labelKey: 'pptx.editorToolbar.shapeEllipse' },
	{ preset: 'roundRect', labelKey: 'pptx.editorToolbar.shapeRoundedRectangle' },
	{ preset: 'triangle', labelKey: 'pptx.editorToolbar.shapeTriangle' },
];

/**
 * Shared toolbar-button utility classes: mirrors React's `pill`-style icon
 * button (bg-muted fill, hover:bg-accent, py-1.5 px-2.5 sizing,
 * active:scale-95) so the Vue chrome reads identically to React's ribbon
 * section buttons. Applied alongside the `pptx-vue-tb-btn` test hook.
 */
const TB_BTN =
	'inline-flex items-center justify-center px-2.5 py-1.5 rounded bg-muted text-xs hover:bg-accent transition-colors active:scale-95 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';

/** Icon sizing, matching React's shared `ic` toolbar-icon class. */
const IC = 'w-4 h-4';
</script>

<template>
	<!-- overflow-x-auto + flex-nowrap: scrolls horizontally on narrow viewports
	     instead of wrapping onto a second line. Mirrors the max-md:overflow-x-auto
	     behaviour on React's RibbonToolbar tab bar. -->
	<div
		class="pptx-vue-editor-toolbar flex flex-nowrap items-center gap-1.5 px-2 py-1 border-b border-border bg-secondary/50 overflow-x-auto scrollbar-none"
		role="toolbar"
		:aria-label="t('pptx.editorToolbar.ariaLabel')"
	>
		<!-- History: always visible (core undo / redo). -->
		<div
			class="pptx-vue-tb-group flex shrink-0 items-center gap-1"
			role="group"
			:aria-label="t('pptx.editorToolbar.history')"
		>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				:aria-label="t('pptx.toolbar.undo')"
				:title="t('pptx.toolbar.undo')"
				:disabled="!props.canUndo"
				@click="emit('undo')"
			>
				<Undo :class="IC" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				:aria-label="t('pptx.toolbar.redo')"
				:title="t('pptx.toolbar.redo')"
				:disabled="!props.canRedo"
				@click="emit('redo')"
			>
				<Redo :class="IC" aria-hidden="true" />
			</button>
		</div>

		<span class="pptx-vue-tb-sep w-px shrink-0 self-stretch bg-border/40 mx-1" aria-hidden="true" />

		<!-- Zoom: always visible. -->
		<div
			class="pptx-vue-tb-group flex shrink-0 items-center gap-1"
			role="group"
			:aria-label="t('pptx.slideSorter.zoom')"
		>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				:aria-label="t('pptx.statusBar.zoomOut')"
				:title="t('pptx.statusBar.zoomOut')"
				@click="emit('zoom-out')"
			>
				<Minus :class="IC" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-zoom tabular-nums text-[0.85rem]"
				:class="TB_BTN"
				:aria-label="t('pptx.editorToolbar.resetZoomTo100')"
				:title="t('pptx.editorToolbar.resetZoom')"
				@click="emit('zoom-reset')"
			>
				{{ props.zoomPercent }}%
			</button>
			<button
				type="button"
				class="pptx-vue-tb-btn"
				:class="TB_BTN"
				:aria-label="t('pptx.statusBar.zoomIn')"
				:title="t('pptx.statusBar.zoomIn')"
				@click="emit('zoom-in')"
			>
				<Plus :class="IC" aria-hidden="true" />
			</button>
		</div>

		<span class="pptx-vue-tb-sep w-px shrink-0 self-stretch bg-border/40 mx-1" aria-hidden="true" />

		<!-- Insert: text button always visible; shape presets hidden on very
		     narrow viewports (< sm / 640px) to keep the primary actions
		     reachable without scrolling. -->
		<div
			class="pptx-vue-tb-group flex shrink-0 items-center gap-1"
			role="group"
			:aria-label="t('pptx.editorToolbar.insert')"
		>
			<button
				type="button"
				class="pptx-vue-tb-btn pptx-vue-tb-text"
				:class="TB_BTN"
				:aria-label="t('pptx.editorToolbar.addTextBox')"
				:title="t('pptx.editorToolbar.addTextBox')"
				@click="emit('add-text')"
			>
				<Type :class="IC" aria-hidden="true" />
			</button>
			<button
				v-for="s in SHAPE_PRESETS"
				:key="s.preset"
				type="button"
				class="pptx-vue-tb-btn max-sm:hidden"
				:class="TB_BTN"
				:aria-label="t('pptx.editorToolbar.addShape', { shape: t(s.labelKey) })"
				:title="t('pptx.editorToolbar.addShape', { shape: t(s.labelKey) })"
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

		<span class="pptx-vue-tb-sep w-px shrink-0 self-stretch bg-border/40 mx-1" aria-hidden="true" />

		<!-- Arrange (selection-gated): extracted to ArrangeButtonGroup.
		     shrink-0 keeps the group from collapsing when the toolbar is
		     narrower than its natural width. -->
		<ArrangeButtonGroup
			class="shrink-0"
			:has-selection="props.hasSelection"
			:format-painter-active="props.formatPainterActive"
			:can-activate-format-painter="props.canActivateFormatPainter"
			@toggle-format-painter="emit('toggle-format-painter')"
			@duplicate-selected="emit('duplicate-selected')"
			@bring-forward="emit('bring-forward')"
			@send-backward="emit('send-backward')"
			@delete-selected="emit('delete-selected')"
		/>
	</div>
</template>
