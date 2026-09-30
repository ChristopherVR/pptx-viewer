<script setup lang="ts">
import { SLIDE_SHOW_COMMAND_GROUPS, SLIDE_SHOW_OPTIONS } from 'pptx-viewer-shared';
import type {
	RibbonCommandRequestEvent,
	RibbonControlId,
	SlideShowOptionsChangeEvent,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import { vAnchoredPopup } from './anchored-popup';
import CustomShowsControls from './CustomShowsControls.vue';
import type { SlideShowSectionProps } from './slide-show-section-props';
import SubtitleSettingsControl from './SubtitleSettingsControl.vue';
import { useDropdown } from './use-dropdown';

const props = defineProps<SlideShowSectionProps>();
const { t } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);
const showsMenu = useDropdown();
function setShowsRoot(element: unknown): void {
	showsMenu.root.value = element instanceof HTMLElement ? element : null;
}
const optionLabels = () =>
	Object.fromEntries(SLIDE_SHOW_OPTIONS.map((option) => [option.id, t(option.labelKey)]));
function commitOptions(event: Event): void {
	props.onPresentationPropertiesChange?.((event as SlideShowOptionsChangeEvent).detail);
}
function requestCommand(event: Event): void {
	const actions: Partial<Record<RibbonControlId, () => void>> = {
		'slideShow.startSlideShow.fromBeginning': props.onPresentFromBeginning,
		'slideShow.startSlideShow.fromCurrent': props.onPresent,
		'slideShow.present.presenterView': props.onEnterPresenterView,
		'slideShow.startSlideShow.customShow': showsMenu.toggle,
		'slideShow.present.broadcast': props.onOpenBroadcastDialog,
		'slideShow.setUp.setUpSlideShow': props.onOpenSetUpSlideShow,
		'slideShow.setUp.hideSlide': props.onToggleHideSlide,
		'slideShow.setUp.rehearseTimings': props.onEnterRehearsalMode,
		'slideShow.setUp.record': props.onEnterRehearsalMode,
	};
	actions[(event as RibbonCommandRequestEvent).detail.id]?.();
}
</script>

<template>
	<pptx-ui-ribbon-group
		v-for="group in SLIDE_SHOW_COMMAND_GROUPS"
		:key="group.id"
		:label="t(group.labelKey)"
		:data-ribbon-group="group.id"
	>
		<template v-for="command in group.commands" :key="command.id">
			<div
				v-if="command.id === 'slideShow.startSlideShow.customShow'"
				:ref="setShowsRoot"
				class="relative"
			>
				<pptx-ui-ribbon-command
					:data-ribbon-control="command.id"
					:label="t(command.labelKey)"
					:icon="command.icon"
					:title="t(command.tooltipKey ?? command.labelKey)"
					:expanded="String(showsMenu.open.value)"
					:active="showsMenu.open.value ? '' : undefined"
					@command-request="requestCommand"
				/>
				<div
					v-if="showsMenu.open.value"
					class="z-50 flex flex-col pt-1"
					v-anchored-popup="{ anchor: showsMenu.root.value }"
				>
					<div
						class="flex items-center gap-1 rounded-lg border border-border bg-popover p-2 shadow-2xl"
					>
						<CustomShowsControls v-bind="props.customShowControls" />
					</div>
				</div>
			</div>
			<pptx-ui-ribbon-command
				v-else-if="command.id !== 'slideShow.present.broadcast' || !isHidden('broadcast')"
				:data-ribbon-control="command.id"
				:label="t(command.labelKey)"
				:icon="command.icon"
				:title="t(command.tooltipKey ?? command.labelKey)"
				:disabled="command.unsupported ? '' : undefined"
				:active="
					command.id === 'slideShow.setUp.hideSlide' && props.activeSlideHidden ? '' : undefined
				"
				:pressed="
					command.id === 'slideShow.setUp.hideSlide' ? String(props.activeSlideHidden) : undefined
				"
				@command-request="requestCommand"
			/>
		</template>
	</pptx-ui-ribbon-group>
	<pptx-ui-ribbon-group :label="t('pptx.slideShow.options')">
		<pptx-ui-slide-show-options
			:presentationProperties.prop="props.presentationProperties"
			:labels.prop="optionLabels()"
			@show-options-change="commitOptions"
		>
			<div class="contents" data-ribbon-group="slideShow.captions">
				<pptx-ui-ribbon-toggle
					data-ribbon-control="slideShow.captions.subtitles"
					:label="t('pptx.slideShow.subtitles')"
					:title="t('pptx.slideShow.subtitlesTooltip')"
					:checked="props.showSubtitles ? '' : undefined"
					@toggle-request="props.onToggleSubtitles()"
				/>
				<SubtitleSettingsControl />
			</div>
		</pptx-ui-slide-show-options>
	</pptx-ui-ribbon-group>
</template>
