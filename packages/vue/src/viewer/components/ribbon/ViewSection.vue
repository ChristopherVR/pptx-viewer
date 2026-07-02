<script setup lang="ts">
import { List, Pipette } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

/**
 * ViewSection: the Vue 3 port of React's `toolbar/ViewSection.tsx`. Renders the
 * View ribbon tab's Presentation Views, Master Views and Zoom groups plus the
 * standalone toggles for template editing, selection pane, eyedropper, grid,
 * rulers, snap-to-grid/shape, horizontal/vertical guides and spell check. A
 * faithful, mechanical port for visual + behavioral parity: class strings are
 * copied verbatim, `cn` drives the active-state classes, and i18n `t('…')` calls
 * are replaced with their plain-English strings.
 */
import { cn } from '../../../utils';
import { ic, pill, SEP } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	onZoomToFit?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<!-- Presentation Views group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button :class="pill" :title="t('pptx.statusBar.normalView')">
				{{ t('pptx.view.normal') }}
			</button>
			<button
				v-if="props.onToggleSlideSorter"
				:class="pill"
				:title="t('pptx.view.slideSorterTooltip')"
				@click="props.onToggleSlideSorter()"
			>
				{{ t('pptx.slideSorter.title') }}
			</button>
			<button v-else :class="pill" :title="t('pptx.view.slideSorterTooltip')">
				{{ t('pptx.slideSorter.title') }}
			</button>
			<button :class="pill" :title="t('pptx.view.readingView')">
				{{ t('pptx.view.readingView') }}
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.view.presentationViews')
		}}</span>
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
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.view.masterViews')
		}}</span>
	</div>
	<div :class="SEP" />

	<!-- Zoom group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button
				v-if="props.onZoomToFit"
				:class="pill"
				:title="t('pptx.view.zoomToFitTooltip')"
				@click="props.onZoomToFit()"
			>
				{{ t('pptx.view.zoomToFit') }}
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.slideSorter.zoom')
		}}</span>
	</div>
	<div :class="SEP" />

	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.editTemplateMode ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')"
		:title="t('pptx.view.templateEditingTooltip')"
		@click="props.onSetEditTemplateMode(!props.editTemplateMode)"
	>
		{{ props.editTemplateMode ? t('pptx.view.templatesOn') : t('pptx.view.templatesOff') }}
	</button>
	<button
		v-if="props.onToggleSelectionPane"
		type="button"
		:class="cn(pill, props.isSelectionPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
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
		{{ t('pptx.view.eyedropper') }}
	</button>
	<button
		:class="cn(pill, props.showGrid ? 'bg-primary text-white' : '')"
		:title="t('pptx.grid.toggleGrid')"
		@click="props.onSetShowGrid(!props.showGrid)"
	>
		{{ t('pptx.grid.grid') }}
	</button>
	<button
		:class="cn(pill, props.showRulers ? 'bg-primary text-white' : '')"
		:title="t('pptx.ruler.toggleRulers')"
		@click="props.onSetShowRulers(!props.showRulers)"
	>
		{{ t('pptx.ruler.rulers') }}
	</button>
	<button
		:class="cn(pill, props.snapToGrid ? 'bg-primary text-white' : '')"
		:title="t('pptx.grid.snapToGrid')"
		@click="props.onSetSnapToGrid(!props.snapToGrid)"
	>
		{{ t('pptx.grid.snapToGrid') }}
	</button>
	<button
		:class="cn(pill, props.snapToShape ? 'bg-primary text-white' : '')"
		:title="t('pptx.grid.snapToShape')"
		@click="props.onSetSnapToShape(!props.snapToShape)"
	>
		{{ t('pptx.grid.snapToShape') }}
	</button>
	<button :class="pill" :title="t('pptx.view.addHorizontalGuide')" @click="props.onAddGuide('h')">
		{{ t('pptx.view.hGuide') }}
	</button>
	<button :class="pill" :title="t('pptx.view.addVerticalGuide')" @click="props.onAddGuide('v')">
		{{ t('pptx.view.vGuide') }}
	</button>
	<button
		:class="cn(pill, props.spellCheckEnabled ? 'bg-primary text-white' : '')"
		:title="t('pptx.view.toggleSpellCheck')"
		@click="props.onSetSpellCheckEnabled(!props.spellCheckEnabled)"
	>
		{{ t('pptx.view.spell') }}
	</button>
</template>
