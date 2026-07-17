<script setup lang="ts">
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';

const props = defineProps<{ snapshot: PresentationSnapshot; audienceOpen: boolean }>();
const emit = defineEmits<{
	(e: 'timer' | 'reset-timer' | 'slides' | 'reset-zoom' | 'audience' | 'subtitles' | 'exit'): void;
	(e: 'zoom', direction: -1 | 1): void;
	(e: 'blackout', value: PresentationSnapshot['blackout']): void;
	(e: 'tool', tool: PresentationPointerTool): void;
}>();
const tools: PresentationPointerTool[] = ['laser', 'pen', 'highlighter', 'eraser'];
</script>
<template>
	<div class="presenter-strip">
		<button @click="emit('timer')">{{ snapshot.paused ? 'Resume' : 'Pause' }}</button>
		<button @click="emit('reset-timer')">Reset</button><i />
		<button @click="emit('slides')">All slides</button>
		<button @click="emit('zoom', -1)">Zoom -</button
		><button @click="emit('zoom', 1)">Zoom +</button>
		<button @click="emit('reset-zoom')">Fit</button><i />
		<button
			v-for="tool in tools"
			:key="tool"
			:class="{ active: snapshot.pointer?.tool === tool }"
			@click="emit('tool', snapshot.pointer?.tool === tool ? 'none' : tool)"
		>
			{{ tool }}
		</button>
		<button
			:class="{ active: snapshot.blackout === 'black' }"
			@click="emit('blackout', snapshot.blackout === 'black' ? 'none' : 'black')"
		>
			B
		</button>
		<button
			:class="{ active: snapshot.blackout === 'white' }"
			@click="emit('blackout', snapshot.blackout === 'white' ? 'none' : 'white')"
		>
			W
		</button>
		<button :class="{ active: snapshot.subtitlesVisible }" @click="emit('subtitles')">
			Captions
		</button>
		<span /><button @click="emit('audience')">{{ audienceOpen ? 'Disconnect' : 'Audience' }}</button
		><button @click="emit('exit')">End</button>
	</div>
</template>
<style scoped>
.presenter-strip {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
	padding: 8px 12px;
	background: #020617;
	border-bottom: 1px solid #ffffff1a;
}
.presenter-strip button {
	border: 0;
	border-radius: 5px;
	padding: 7px 10px;
	background: #ffffff12;
	color: #e2e8f0;
	cursor: pointer;
	text-transform: capitalize;
}
.presenter-strip button:hover,
.presenter-strip .active {
	background: #38bdf8;
	color: #082f49;
}
.presenter-strip i {
	height: 24px;
	width: 1px;
	background: #ffffff26;
}
.presenter-strip span {
	flex: 1;
}
</style>
