<script setup lang="ts">
import { Code, Grid3X3, StickyNote, ZoomIn } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

/**
 * ViewSection: the Vue 3 port of React's `toolbar/ViewSection.tsx`. Renders the
 * View ribbon tab's Presentation Views, Master Views, Show, Zoom and Window
 * groups.
 *
 * Reading View is live: it opens the windowed reading overlay (see
 * `ReadingViewOverlay.vue`). It shipped `disabled` in every binding for a year,
 * which is why the test below asserts it is enabled rather than asserting the
 * placeholder.
 *
 * "Guides" and "Snap to shape" are one control each, for the one thing each of
 * them names. They used to be crossed: Guides drove shape snapping and Snap to
 * shape was a permanently disabled placeholder, i.e. a label describing a
 * feature that lives on a differently-named control. Guide visibility and shape
 * snapping are genuinely separate settings (you can want the guides drawn
 * without every drag magnetising to a neighbour), and the editor already
 * carries both flags.
 */
import { cn } from '../../../utils';
import { GROUP_LABEL, ic, pill, SEP } from './ribbon-constants';
import ViewShowGroup from './ViewShowGroup.vue';

interface Props {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	/** Guide-overlay visibility only; the guides themselves stay in the model. */
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetShowGuides: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	onGoToNormalView?: () => void;
	onOpenReadingView?: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView?: () => void;
	onZoomToFit?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<!--
		Every group below is a direct child of the ribbon content row
		(`RibbonToolbar.vue`'s `items-center` row), so a group that keeps its
		own intrinsic height sits vertically centered at that height rather than
		reaching the row's true bottom edge whenever a taller sibling group sets
		the row's height (View's five-row "Show" group next to its two-row
		"Zoom" group is the clearest case: without `self-stretch` + `justify-
		between`, "Show"'s caption lands well below the other four groups'
		captions, and their border-right dividers stop short of the row's own
		bottom edge). `self-stretch` claims the row's full height per group;
		`justify-between` then pins each group's caption to that stretched
		box's own bottom, independent of its neighbours' heights, matching
		every other binding's `RibbonGroup`.
	-->
	<!-- Presentation Views group -->
	<div
		class="flex flex-col items-center justify-between self-stretch gap-0.5"
		data-ribbon-group="view.presentationViews"
	>
		<div class="flex items-center gap-0.5">
			<button
				data-ribbon-control="view.presentationViews.normal"
				:class="pill"
				:title="t('pptx.statusBar.normalView')"
				@click="props.onGoToNormalView?.()"
			>
				{{ t('pptx.view.normal') }}
			</button>
			<button
				data-ribbon-control="view.presentationViews.slideSorter"
				:class="pill"
				:title="t('pptx.view.slideSorterTooltip')"
				@click="props.onToggleSlideSorter?.()"
			>
				{{ t('pptx.slideSorter.title') }}
			</button>
			<button
				data-ribbon-control="view.presentationViews.outline"
				:class="pill"
				:title="t('pptx.view.outlineViewTooltip')"
				@click="props.onOpenOutlineView?.()"
			>
				{{ t('pptx.view.outlineView') }}
			</button>
			<button
				data-ribbon-control="view.presentationViews.readingView"
				:class="pill"
				:title="t('pptx.view.readingView')"
				@click="props.onOpenReadingView?.()"
			>
				{{ t('pptx.view.readingView') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.view.presentationViews') }}</span>
	</div>
	<div :class="SEP" />

	<!-- Master Views group -->
	<div
		class="flex flex-col items-center justify-between self-stretch gap-0.5"
		data-ribbon-group="view.masterViews"
	>
		<div class="flex items-center gap-0.5">
			<button
				data-ribbon-control="view.masterViews.slideMaster"
				:disabled="!props.canEdit"
				:class="pill"
				:title="t('pptx.view.slideMasterTooltip')"
				@click="props.onEnterMasterView()"
			>
				{{ t('pptx.master.title') }}
			</button>
			<button disabled :class="pill" data-ribbon-control="view.masterViews.handoutMaster">
				<Grid3X3 :class="ic" />
				{{ t('pptx.master.handoutMasterTitle') }}
			</button>
			<button disabled :class="pill" data-ribbon-control="view.masterViews.notesMaster">
				<StickyNote :class="ic" />
				{{ t('pptx.master.notesMasterTitle') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.view.masterViews') }}</span>
	</div>
	<div :class="SEP" />

	<!-- Show group -->
	<ViewShowGroup
		:can-edit="props.canEdit"
		:show-grid="props.showGrid"
		:show-rulers="props.showRulers"
		:show-guides="props.showGuides"
		:snap-to-grid="props.snapToGrid"
		:snap-to-shape="props.snapToShape"
		:on-set-show-grid="props.onSetShowGrid"
		:on-set-show-rulers="props.onSetShowRulers"
		:on-set-show-guides="props.onSetShowGuides"
		:on-set-snap-to-grid="props.onSetSnapToGrid"
		:on-set-snap-to-shape="props.onSetSnapToShape"
		:on-add-guide="props.onAddGuide"
		:is-selection-pane-open="props.isSelectionPaneOpen"
		:on-toggle-selection-pane="props.onToggleSelectionPane"
		:eyedropper-active="props.eyedropperActive"
		:on-toggle-eyedropper="props.onToggleEyedropper"
	/>
	<div :class="SEP" />

	<!-- Zoom group -->
	<div
		class="flex flex-col items-center justify-between self-stretch gap-0.5"
		data-ribbon-group="view.zoom"
	>
		<div class="flex items-center gap-0.5">
			<button disabled :class="pill" data-ribbon-control="view.zoom.zoom">
				<ZoomIn :class="ic" />
				{{ t('pptx.slideSorter.zoom') }}
			</button>
			<button
				data-ribbon-control="view.zoom.fitToWindow"
				:class="pill"
				:title="t('pptx.view.zoomToFitTooltip')"
				@click="props.onZoomToFit?.()"
			>
				{{ t('pptx.view.zoomToFit') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.slideSorter.zoom') }}</span>
	</div>
	<div :class="SEP" />

	<!-- Window group -->
	<div
		class="flex flex-col items-center justify-between self-stretch gap-0.5"
		data-ribbon-group="view.window"
	>
		<div class="flex items-center gap-0.5">
			<button
				data-ribbon-control="view.window.templateEditing"
				:disabled="!props.canEdit"
				:class="
					cn(pill, props.editTemplateMode ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')
				"
				:title="t('pptx.view.templateEditingTooltip')"
				@click="props.onSetEditTemplateMode(!props.editTemplateMode)"
			>
				{{ props.editTemplateMode ? t('pptx.ribbon.templatesOn') : t('pptx.ribbon.templatesOff') }}
			</button>
			<button disabled :class="pill" data-ribbon-control="view.window.macros">
				<Code :class="ic" />
				{{ t('pptx.view.macros') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.view.window') }}</span>
	</div>
</template>
