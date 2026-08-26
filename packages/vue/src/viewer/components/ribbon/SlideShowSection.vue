<script setup lang="ts">
import {
	Captions,
	Cast,
	Clock,
	EyeOff,
	ListVideo,
	Monitor,
	Play,
	Settings,
	Video,
} from 'lucide-vue-next';
import type { PptxPresentationProperties } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import { SLIDE_SHOW_OPTIONS, readSlideShowOption, slideShowOptionChange } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import { vAnchoredPopup } from './anchored-popup';
import CustomShowsControls from './CustomShowsControls.vue';
import { ic, pill, SEP } from './ribbon-constants';
/**
 * SlideShowSection: the Vue 3 port of React's `toolbar/SlideShowSection.tsx`.
 *
 * Start (From Beginning / From Current Slide), Present (Presenter View, Custom
 * show, Broadcast), Set Up (Rehearse with Coach, Set Up Slide Show, Hide Slide,
 * Rehearse Timings, Record) and Options (Keep Updated, Use Timings, Play
 * Narrations, Media Controls, Subtitles, Subtitle Settings).
 *
 * The reference renders several of these inert pending a backing feature; they
 * are rendered inert here rather than omitted, so a user comparing bindings
 * finds the same tab either way. Custom show is NOT one of them any more: the
 * picker (`CustomShowsControls.vue`) has always existed, it simply was never
 * reachable from this tab. It opens in a popover so the tab's control inventory
 * is unchanged while the menu is closed.
 */
import type { CustomShowsControlsProps, ViewerMode } from './ribbon-types';
import { useDropdown } from './use-dropdown';

interface Props {
	onPresent: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	/**
	 * PowerPoint's Hide Slide toggle: marks the ACTIVE slide to be skipped during
	 * the show while leaving it in the deck, the thumbnail rail and the sorter.
	 */
	onToggleHideSlide: () => void;
	/** Whether the active slide is hidden, for the toggle's pressed state. */
	activeSlideHidden: boolean;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	onSetMode: (mode: ViewerMode) => void;
	/** Everything the custom-show picker needs; see `CustomShowsControls.vue`. */
	customShowControls: CustomShowsControlsProps;
	/** Toolbar buttons the host has asked to hide (gates the Broadcast button below). */
	hiddenActions?: ToolbarActionId[];
	/** Deck presentation properties backing the Options checkboxes. */
	presentationProperties?: PptxPresentationProperties;
	/** Commit an Options checkbox onto the deck's presentation properties. */
	onPresentationPropertiesChange?: (updates: Partial<PptxPresentationProperties>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);
const showsMenu = useDropdown();

/** A checkbox pill: matches the reference's `RibbonToggle`, which is a labelled input. */
const toggleRow = 'flex h-[19px] items-center gap-1 whitespace-nowrap rounded-sm px-1 text-[10px]';

// The Options cluster used to be four hard-coded `checked` boxes with no change
// handler, so "Use Timings" claimed to be on whether or not the deck said so.
// Both supported entries now read and write the deck's presentation properties;
// the two nothing backs render disabled.
const optionsColumnOne = SLIDE_SHOW_OPTIONS.slice(0, 3);
const mediaControlsOption = SLIDE_SHOW_OPTIONS[3];

function optionChecked(id: (typeof SLIDE_SHOW_OPTIONS)[number]['id']): boolean {
	return readSlideShowOption(props.presentationProperties, id);
}

function commitOption(id: (typeof SLIDE_SHOW_OPTIONS)[number]['id'], checked: boolean): void {
	const change = slideShowOptionChange(id, checked);
	if (change) {
		props.onPresentationPropertiesChange?.(change);
	}
}
</script>

<template>
	<button
		:class="pill"
		:title="t('pptx.slideShow.fromBeginningTooltip')"
		@click="props.onSetMode('present')"
	>
		<Play :class="ic" />
		{{ t('pptx.slideShow.fromBeginning') }}
	</button>
	<button :class="pill" :title="t('pptx.slideShow.fromCurrentTooltip')" @click="props.onPresent()">
		<Play :class="ic" />
		{{ t('pptx.slideShow.fromCurrent') }}
	</button>
	<div :class="SEP" />
	<button
		:class="pill"
		:title="t('pptx.slideShow.presenterViewTooltip')"
		@click="props.onEnterPresenterView()"
	>
		<Monitor :class="ic" />
		{{ t('pptx.slideShow.presenterView') }}
	</button>
	<div :ref="showsMenu.root" class="relative">
		<button
			type="button"
			:class="cn(pill, showsMenu.open.value ? 'bg-primary hover:bg-primary/80 text-white' : '')"
			:aria-expanded="showsMenu.open.value"
			:title="t('pptx.customShows.customShowTooltip')"
			@click="showsMenu.toggle()"
		>
			<ListVideo :class="ic" />
			{{ t('pptx.slideShow.customShow') }}
		</button>
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
	<button
		v-if="!isHidden('broadcast')"
		:class="pill"
		:title="t('pptx.slideShow.broadcastTooltip')"
		@click="props.onOpenBroadcastDialog()"
	>
		<Cast :class="ic" />
		{{ t('pptx.slideShow.broadcast') }}
	</button>
	<div :class="SEP" />
	<button disabled :class="pill">
		<Video :class="ic" />
		{{ t('pptx.slideShow.rehearseCoach') }}
	</button>
	<button
		:class="pill"
		:title="t('pptx.slideShow.setUpTooltip')"
		@click="props.onOpenSetUpSlideShow()"
	>
		<Settings :class="ic" />
		{{ t('pptx.slideShow.setUp') }}
	</button>
	<button :class="pill" :aria-pressed="props.activeSlideHidden" @click="props.onToggleHideSlide()">
		<EyeOff :class="ic" />
		{{ t('pptx.slideShow.hideSlide') }}
	</button>
	<button
		:class="pill"
		:title="t('pptx.slideShow.rehearseTimingsTooltip')"
		@click="props.onEnterRehearsalMode()"
	>
		<Clock :class="ic" />
		{{ t('pptx.slideShow.rehearseTimings') }}
	</button>
	<button :class="pill" @click="props.onEnterRehearsalMode()">
		<Video :class="ic" />
		{{ t('pptx.titleBar.record') }}
	</button>
	<div :class="SEP" />
	<div class="flex flex-col justify-start gap-0.5">
		<label v-for="option in optionsColumnOne" :key="option.id" :class="toggleRow">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary disabled:opacity-35"
				:disabled="option.unsupported"
				:checked="optionChecked(option.id)"
				@change="commitOption(option.id, ($event.target as HTMLInputElement).checked)"
			/>
			{{ t(option.labelKey) }}
		</label>
	</div>
	<div class="flex flex-col justify-start gap-0.5">
		<label :class="toggleRow">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary disabled:opacity-35"
				:disabled="mediaControlsOption.unsupported"
				:checked="optionChecked(mediaControlsOption.id)"
			/>
			{{ t(mediaControlsOption.labelKey) }}
		</label>
		<label :class="cn(toggleRow, props.showSubtitles ? 'bg-primary/15 text-primary' : '')">
			<input
				type="checkbox"
				class="h-3 w-3 accent-primary"
				:checked="props.showSubtitles"
				:title="t('pptx.slideShow.subtitlesTooltip')"
				@change="props.onToggleSubtitles()"
			/>
			{{ t('pptx.slideShow.subtitles') }}
		</label>
		<button :class="pill" @click="props.onToggleSubtitles()">
			<Captions :class="ic" />
			{{ t('pptx.slideShow.subtitleSettings') }}
		</button>
	</div>
</template>
