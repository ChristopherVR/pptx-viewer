<script setup lang="ts">
import { List, Pipette } from 'lucide-vue-next';

/**
 * ViewSection — the Vue 3 port of React's `toolbar/ViewSection.tsx`. Renders the
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
</script>

<template>
	<!-- Presentation Views group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button :class="pill" title="Normal view">Normal</button>
			<button
				v-if="props.onToggleSlideSorter"
				:class="pill"
				title="Slide Sorter view"
				@click="props.onToggleSlideSorter()"
			>
				Slide Sorter
			</button>
			<button v-else :class="pill" title="Slide Sorter view">Slide Sorter</button>
			<button :class="pill" title="Reading View">Reading View</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Presentation Views</span>
	</div>
	<div :class="SEP" />

	<!-- Master Views group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button
				:disabled="!props.canEdit"
				:class="pill"
				title="Edit slide masters and layouts"
				@click="props.onEnterMasterView()"
			>
				Slide Master
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Master Views</span>
	</div>
	<div :class="SEP" />

	<!-- Zoom group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-0.5">
			<button
				v-if="props.onZoomToFit"
				:class="pill"
				title="Zoom to fit slide in window"
				@click="props.onZoomToFit()"
			>
				Zoom to Fit
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Zoom</span>
	</div>
	<div :class="SEP" />

	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.editTemplateMode ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')"
		title="Toggle template/master element editing"
		@click="props.onSetEditTemplateMode(!props.editTemplateMode)"
	>
		{{ props.editTemplateMode ? 'Templates On' : 'Templates Off' }}
	</button>
	<button
		v-if="props.onToggleSelectionPane"
		type="button"
		:class="cn(pill, props.isSelectionPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Selection Pane"
		@click="props.onToggleSelectionPane()"
	>
		<List :class="ic" />
		Selection
	</button>
	<button
		v-if="props.onToggleEyedropper"
		type="button"
		:disabled="!props.canEdit"
		:class="
			cn(pill, props.eyedropperActive ? 'bg-purple-600 hover:bg-purple-500 text-purple-50' : '')
		"
		title="Eyedropper — sample a colour from the slide"
		@click="props.onToggleEyedropper()"
	>
		<Pipette :class="ic" />
		Eyedropper
	</button>
	<button
		:class="cn(pill, props.showGrid ? 'bg-primary text-white' : '')"
		title="Toggle Grid"
		@click="props.onSetShowGrid(!props.showGrid)"
	>
		Grid
	</button>
	<button
		:class="cn(pill, props.showRulers ? 'bg-primary text-white' : '')"
		title="Toggle Rulers"
		@click="props.onSetShowRulers(!props.showRulers)"
	>
		Rulers
	</button>
	<button
		:class="cn(pill, props.snapToGrid ? 'bg-primary text-white' : '')"
		title="Snap to grid"
		@click="props.onSetSnapToGrid(!props.snapToGrid)"
	>
		Snap to Grid
	</button>
	<button
		:class="cn(pill, props.snapToShape ? 'bg-primary text-white' : '')"
		title="Snap to shape"
		@click="props.onSetSnapToShape(!props.snapToShape)"
	>
		Snap to Shape
	</button>
	<button :class="pill" title="Add horizontal guide" @click="props.onAddGuide('h')">H Guide</button>
	<button :class="pill" title="Add vertical guide" @click="props.onAddGuide('v')">V Guide</button>
	<button
		:class="cn(pill, props.spellCheckEnabled ? 'bg-primary text-white' : '')"
		title="Toggle spell check"
		@click="props.onSetSpellCheckEnabled(!props.spellCheckEnabled)"
	>
		Spell
	</button>
</template>
