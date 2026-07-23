<script setup lang="ts">
import { ref, watch } from 'vue';

import { COLLAB_LEAVE_MESSAGE } from './useLiveDemo';

/**
 * One embedded demo app: a browser-chrome style bar (caption + "open full
 * app" link) above an iframe, with a shimmer state until the app loads.
 */
const props = defineProps<{
	src: string;
	title: string;
	caption: string;
	openLabel: string;
	loadingLabel: string;
}>();

const loaded = ref(false);
const frame = ref<HTMLIFrameElement | null>(null);
watch(
	() => props.src,
	() => {
		loaded.value = false;
	},
);

/**
 * Ask the embedded viewer to leave its collaboration room before this pane is
 * torn down, so the host pane drops it from the collaborator list immediately.
 * The viewer also leaves from `pagehide`; this is the earlier, cleaner signal.
 */
function signalLeave(): void {
	frame.value?.contentWindow?.postMessage({ type: COLLAB_LEAVE_MESSAGE }, '*');
}

defineExpose({ signalLeave });
</script>

<template>
	<div class="pv-livepane">
		<span class="pv-livepane__bar">
			<span class="pv-livepane__dots" aria-hidden="true"><i></i><i></i><i></i></span>
			<span class="pv-livepane__caption">{{ caption }}</span>
			<a class="pv-livepane__open" :href="src" target="_blank" rel="noreferrer">
				{{ openLabel }} &nearr;
			</a>
		</span>
		<span class="pv-livepane__body">
			<span v-if="!loaded" class="pv-livepane__loading">
				<i class="pv-livepane__spinner" aria-hidden="true"></i>
				<span>{{ loadingLabel }}</span>
			</span>
			<iframe
				ref="frame"
				:src="src"
				:title="title"
				loading="lazy"
				allow="clipboard-read; clipboard-write; fullscreen"
				@load="loaded = true"
			></iframe>
		</span>
	</div>
</template>

<style scoped>
.pv-livepane {
	display: flex;
	flex-direction: column;
	background: var(--pv-surface);
	border: 1px solid var(--pv-line);
	border-radius: 8px;
	overflow: hidden;
	box-shadow: var(--pv-shadow);
	min-width: 0;
}

.pv-livepane__bar {
	display: flex;
	align-items: center;
	gap: 0.9rem;
	padding: 0.6rem 0.9rem;
	border-bottom: 1px solid var(--pv-line);
	font-family: var(--pv-mono);
	font-size: 0.68rem;
	color: var(--pv-ink-soft);
	letter-spacing: 0.05em;
}

.pv-livepane__dots {
	display: inline-flex;
	gap: 0.3rem;
	flex-shrink: 0;
}

.pv-livepane__dots i {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--pv-line);
}

.pv-livepane__caption {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pv-livepane__open {
	margin-left: auto;
	color: var(--pv-accent);
	letter-spacing: 0.16em;
	text-transform: uppercase;
	white-space: nowrap;
}

.pv-livepane__body {
	position: relative;
	display: block;
	flex: 1;
	min-height: 0;
}

.pv-livepane__body iframe {
	display: block;
	width: 100%;
	height: 100%;
	border: 0;
	background: transparent;
}

.pv-livepane__loading {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.9rem;
	font-family: var(--pv-mono);
	font-size: 0.72rem;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--pv-ink-soft);
	background: var(--pv-surface);
	pointer-events: none;
}

.pv-livepane__spinner {
	width: 26px;
	height: 26px;
	border-radius: 50%;
	border: 2px solid var(--pv-line);
	border-top-color: var(--pv-accent);
	animation: pv-livepane-spin 0.9s linear infinite;
}

@keyframes pv-livepane-spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.pv-livepane__spinner {
		animation-duration: 2.5s;
	}
}
</style>
