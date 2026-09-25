<script setup lang="ts">
/**
 * ViewShowGroup: the View tab's Show group (rulers, gridlines, guides, snap
 * toggles, Selection Pane, Eyedropper, add-guide buttons). Split out of
 * `ViewSection.vue` to keep that file short; the props are the subset of the
 * section's own.
 */
import { Grid3X3, List, Pipette } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { GROUP_LABEL, ic, pill } from './ribbon-constants';

interface Props {
	canEdit: boolean;
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
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const toggleRow = 'flex h-[19px] items-center gap-1 whitespace-nowrap rounded-sm px-1 text-[10px]';
</script>

<template>
	<div
		class="flex flex-col items-center justify-between self-stretch gap-0.5"
		data-ribbon-group="view.show"
	>
		<div class="flex items-start gap-2">
			<div class="flex flex-col justify-start gap-0.5">
				<label
					data-ribbon-control="view.show.ruler"
					:class="cn(toggleRow, props.showRulers ? 'bg-primary/15 text-primary' : '')"
				>
					<input
						type="checkbox"
						class="h-3 w-3 accent-primary"
						:checked="props.showRulers"
						@change="props.onSetShowRulers(($event.target as HTMLInputElement).checked)"
					/>
					{{ t('pptx.ruler.rulers') }}
				</label>
				<label
					data-ribbon-control="view.show.gridlines"
					:class="cn(toggleRow, props.showGrid ? 'bg-primary/15 text-primary' : '')"
				>
					<input
						type="checkbox"
						class="h-3 w-3 accent-primary"
						:checked="props.showGrid"
						:title="t('pptx.grid.toggleGrid')"
						@change="props.onSetShowGrid(($event.target as HTMLInputElement).checked)"
					/>
					{{ t('pptx.grid.grid') }}
				</label>
				<label
					data-ribbon-control="view.show.guides"
					:class="cn(toggleRow, props.showGuides ? 'bg-primary/15 text-primary' : '')"
				>
					<input
						type="checkbox"
						class="h-3 w-3 accent-primary"
						:checked="props.showGuides"
						:title="t('pptx.ribbon.toggleGuides')"
						@change="props.onSetShowGuides(($event.target as HTMLInputElement).checked)"
					/>
					{{ t('pptx.view.guides') }}
				</label>
				<label
					data-ribbon-control="view.show.snapToGrid"
					:class="cn(toggleRow, props.snapToGrid ? 'bg-primary/15 text-primary' : '')"
				>
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
					data-ribbon-control="view.show.selectionPane"
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
					data-ribbon-control="view.show.eyedropper"
					:disabled="!props.canEdit"
					:class="
						cn(
							pill,
							props.eyedropperActive ? 'bg-purple-600 hover:bg-purple-500 text-purple-50' : '',
						)
					"
					:title="t('pptx.view.eyedropperTooltip')"
					@click="props.onToggleEyedropper()"
				>
					<Pipette :class="ic" />
					{{ t('pptx.ribbon.eyedropper') }}
				</button>
				<button
					type="button"
					data-ribbon-control="view.show.snapToShape"
					:class="cn(pill, props.snapToShape ? 'bg-primary hover:bg-primary/80 text-white' : '')"
					:aria-pressed="props.snapToShape"
					:title="t('pptx.view.snapToShape')"
					@click="props.onSetSnapToShape(!props.snapToShape)"
				>
					<Grid3X3 :class="ic" />
					{{ t('pptx.view.snapToShape') }}
				</button>
				<button
					data-ribbon-control="view.show.addGuide"
					:class="pill"
					:title="t('pptx.view.addHorizontalGuide')"
					@click="props.onAddGuide('h')"
				>
					{{ t('pptx.view.hGuide') }}
				</button>
				<button
					data-ribbon-control="view.show.addGuide"
					:class="pill"
					:title="t('pptx.view.addVerticalGuide')"
					@click="props.onAddGuide('v')"
				>
					{{ t('pptx.view.vGuide') }}
				</button>
			</div>
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.view.show') }}</span>
	</div>
</template>
