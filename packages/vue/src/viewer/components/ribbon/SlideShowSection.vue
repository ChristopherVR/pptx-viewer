<script setup lang="ts">
import { Captions, Cast, Clock, Monitor, Play, Settings } from 'lucide-vue-next';

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
</script>

<template>
	<button :class="pill" title="Start slide show from beginning" @click="props.onSetMode('present')">
		<Play :class="ic" />
		From Beginning
	</button>
	<button :class="pill" title="Start slide show from current slide" @click="props.onPresent()">
		<Play :class="ic" />
		From Current Slide
	</button>
	<div :class="SEP" />
	<button :class="pill" title="Presenter view" @click="props.onEnterPresenterView()">
		<Monitor :class="ic" />
		Presenter View
	</button>
	<button :class="pill" title="Rehearse timings" @click="props.onEnterRehearsalMode()">
		<Clock :class="ic" />
		Rehearse Timings
	</button>
	<div :class="SEP" />
	<button :class="pill" title="Set up slide show" @click="props.onOpenSetUpSlideShow()">
		<Settings :class="ic" />
		Set Up Slide Show
	</button>
	<button :class="pill" title="Broadcast slide show" @click="props.onOpenBroadcastDialog()">
		<Cast :class="ic" />
		Broadcast
	</button>
	<div :class="SEP" />
	<button
		:class="cn(pill, props.showSubtitles ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Toggle subtitles"
		@click="props.onToggleSubtitles()"
	>
		<Captions :class="ic" />
		Subtitles
	</button>
</template>
