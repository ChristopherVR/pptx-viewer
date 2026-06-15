<script setup lang="ts">
import { ref } from 'vue';

/**
 * ExportMenu — a small dropdown offering PNG (current slide) and PDF exports.
 * Emits intent; the host runs the actual export via `useExport`.
 */
defineProps<{ exporting: boolean }>();
const emit = defineEmits<{ 'export-png': []; 'export-pdf': [] }>();

const open = ref(false);

function toggle(): void {
	open.value = !open.value;
}
function choose(kind: 'png' | 'pdf'): void {
	open.value = false;
	if (kind === 'png') {
		emit('export-png');
	} else {
		emit('export-pdf');
	}
}
</script>

<template>
	<div class="pptx-vue-export" @focusout="open = false">
		<button
			type="button"
			class="pptx-vue-export-trigger"
			:disabled="exporting"
			aria-haspopup="menu"
			:aria-expanded="open"
			:title="exporting ? 'Exporting…' : 'Export'"
			@click="toggle"
		>
			{{ exporting ? '…' : '⬇' }}
		</button>
		<div v-if="open" class="pptx-vue-export-menu" role="menu">
			<button type="button" role="menuitem" @click="choose('png')">PNG (current slide)</button>
			<button type="button" role="menuitem" @click="choose('pdf')">PDF (all slides)</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-export {
	position: relative;
	display: inline-flex;
}
.pptx-vue-export-trigger {
	cursor: pointer;
}
.pptx-vue-export-menu {
	position: absolute;
	top: 100%;
	right: 0;
	z-index: 50;
	min-width: 160px;
	margin-top: 4px;
	padding: 4px;
	border: 1px solid var(--pptx-border, #d0d0d0);
	border-radius: 6px;
	background: var(--pptx-panel-bg, #ffffff);
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
	display: flex;
	flex-direction: column;
}
.pptx-vue-export-menu button {
	display: block;
	width: 100%;
	padding: 6px 10px;
	border: none;
	background: transparent;
	text-align: left;
	font-size: 13px;
	cursor: pointer;
	border-radius: 4px;
}
.pptx-vue-export-menu button:hover {
	background: var(--pptx-hover, #f0f0f0);
}
</style>
