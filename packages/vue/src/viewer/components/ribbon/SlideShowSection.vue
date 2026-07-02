<script setup lang="ts">
import { Captions, Cast, Clock, Monitor, Play, Settings } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, pill, SEP } from './ribbon-constants';
/**
 * SlideShowSection: the Vue 3 port of React's `toolbar/SlideShowSection.tsx`.
 * Renders the Slide Show ribbon tab's Start (From Beginning / From Current
 * Slide), Presenter (Presenter View / Rehearse Timings), Set Up (Set Up Slide
 * Show / Broadcast) and Captions (Subtitles) groups. A faithful, mechanical port
 * for visual + behavioral parity: class strings are copied verbatim and `cn`
 * drives the active-state class on the Subtitles toggle.
 */
import type { ViewerMode } from './ribbon-types';

interface Props {
	onPresent: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	onSetMode: (mode: ViewerMode) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
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
	<button
		:class="pill"
		:title="t('pptx.slideShow.rehearseTimingsTooltip')"
		@click="props.onEnterRehearsalMode()"
	>
		<Clock :class="ic" />
		{{ t('pptx.slideShow.rehearseTimings') }}
	</button>
	<div :class="SEP" />
	<button
		:class="pill"
		:title="t('pptx.slideShow.setUpTooltip')"
		@click="props.onOpenSetUpSlideShow()"
	>
		<Settings :class="ic" />
		{{ t('pptx.slideShow.setUp') }}
	</button>
	<button
		:class="pill"
		:title="t('pptx.slideShow.broadcastTooltip')"
		@click="props.onOpenBroadcastDialog()"
	>
		<Cast :class="ic" />
		{{ t('pptx.slideShow.broadcast') }}
	</button>
	<div :class="SEP" />
	<button
		:class="cn(pill, props.showSubtitles ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.slideShow.subtitlesTooltip')"
		@click="props.onToggleSubtitles()"
	>
		<Captions :class="ic" />
		{{ t('pptx.slideShow.subtitles') }}
	</button>
</template>
