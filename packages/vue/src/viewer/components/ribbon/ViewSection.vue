<script setup lang="ts">
import { Code, Grid3X3, List, Pipette, StickyNote, ZoomIn } from 'lucide-vue-next';
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
	onOpenReadingView?: () => void;
	onZoomToFit?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const toggleRow = 'flex h-[19px] items-center gap-1 whitespace-nowrap rounded-sm px-1 text-[10px]';
</script>

<template>
	<!-- Presentation Views group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button :class="pill" :title="t('pptx.statusBar.normalView')">
				{{ t('pptx.view.normal') }}
			</button>
			<button
				:class="pill"
				:title="t('pptx.view.slideSorterTooltip')"
				@click="props.onToggleSlideSorter?.()"
			>
				{{ t('pptx.slideSorter.title') }}
			</button>
			<button
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
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button
				:disabled="!props.canEdit"
				:class="pill"
				:title="t('pptx.view.slideMasterTooltip')"
				@click="props.onEnterMasterView()"
			>
				{{ t('pptx.master.title') }}
			</button>
			<button disabled :class="pill">
				<Grid3X3 :class="ic" />
				{{ t('pptx.master.handoutMasterTitle') }}
			</button>
			<button disabled :class="pill">
				<StickyNote :class="ic" />
				{{ t('pptx.master.notesMasterTitle') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.view.masterViews') }}</span>
	</div>
	<div :class="SEP" />

	<!-- Show group -->
	<div class="flex flex-col justify-start gap-0.5">
		<label :class="cn(toggleRow, props.showRulers ? 'bg-primary/15 text-primary' : '')">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary"
				:checked="props.showRulers"
				@change="props.onSetShowRulers(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.ruler.rulers') }}
		</label>
		<label :class="cn(toggleRow, props.showGrid ? 'bg-primary/15 text-primary' : '')">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary"
				:checked="props.showGrid"
				:title="t('pptx.grid.toggleGrid')"
				@change="props.onSetShowGrid(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.grid.grid') }}
		</label>
		<label :class="cn(toggleRow, props.showGuides ? 'bg-primary/15 text-primary' : '')">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary"
				:checked="props.showGuides"
				:title="t('pptx.ribbon.toggleGuides')"
				@change="props.onSetShowGuides(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.view.guides') }}
		</label>
		<label :class="cn(toggleRow, props.snapToGrid ? 'bg-primary/15 text-primary' : '')">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary"
				:checked="props.snapToGrid"
				@change="props.onSetSnapToGrid(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.grid.snapToGrid') }}
		</label>
	</div>
	<div class="flex flex-col justify-start gap-0.5">
		<button
			v-if="props.onToggleSelectionPane"
			type="button"
			:class="
				cn(pill, props.isSelectionPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')
			"
			:title="t('pptx.selectionPane.title')"
			@click="props.onToggleSelectionPane()"
		>
			<List :class="ic" />
			{{ t('pptx.view.selection') }}
		</button>
		<button
			v-if="props.onToggleEyedropper"
			type="button"
			:disabled="!props.canEdit"
			:class="
				cn(pill, props.eyedropperActive ? 'bg-purple-600 hover:bg-purple-500 text-purple-50' : '')
			"
			:title="t('pptx.view.eyedropperTooltip')"
			@click="props.onToggleEyedropper()"
		>
			<Pipette :class="ic" />
			{{ t('pptx.ribbon.eyedropper') }}
		</button>
		<button
			type="button"
			:class="cn(pill, props.snapToShape ? 'bg-primary hover:bg-primary/80 text-white' : '')"
			:aria-pressed="props.snapToShape"
			:title="t('pptx.view.snapToShape')"
			@click="props.onSetSnapToShape(!props.snapToShape)"
		>
			<Grid3X3 :class="ic" />
			{{ t('pptx.view.snapToShape') }}
		</button>
		<button :class="pill" :title="t('pptx.view.addHorizontalGuide')" @click="props.onAddGuide('h')">
			{{ t('pptx.view.hGuide') }}
		</button>
		<button :class="pill" :title="t('pptx.view.addVerticalGuide')" @click="props.onAddGuide('v')">
			{{ t('pptx.view.vGuide') }}
		</button>
	</div>
	<div :class="SEP" />

	<!-- Zoom group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button disabled :class="pill">
				<ZoomIn :class="ic" />
				{{ t('pptx.slideSorter.zoom') }}
			</button>
			<button :class="pill" :title="t('pptx.view.zoomToFitTooltip')" @click="props.onZoomToFit?.()">
				{{ t('pptx.view.zoomToFit') }}
			</button>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.slideSorter.zoom') }}</span>
	</div>
	<div :class="SEP" />

	<!-- Window group -->
	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.editTemplateMode ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')"
		:title="t('pptx.view.templateEditingTooltip')"
		@click="props.onSetEditTemplateMode(!props.editTemplateMode)"
	>
		{{ props.editTemplateMode ? t('pptx.ribbon.templatesOn') : t('pptx.ribbon.templatesOff') }}
	</button>
	<button disabled :class="pill">
		<Code :class="ic" />
		{{ t('pptx.view.macros') }}
	</button>
</template>
