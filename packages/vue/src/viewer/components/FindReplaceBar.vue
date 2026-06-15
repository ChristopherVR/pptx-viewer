<script setup lang="ts">
/**
 * FindReplaceBar — compact find-and-replace bar for the Vue editor.
 *
 * Purely presentational: it owns no search state. The parent wires it to a
 * {@link useFindReplace} instance via `v-model:query`, `v-model:replacement`,
 * and `v-model:match-case`, passes the live `matchCount`/`currentIndex`, and
 * listens for the navigation/replace/close intents as emits.
 */
import { computed } from 'vue';

const props = defineProps<{
	matchCount: number;
	currentIndex: number;
}>();

const query = defineModel<string>('query', { default: '' });
const replacement = defineModel<string>('replacement', { default: '' });
const matchCase = defineModel<boolean>('matchCase', { default: false });

const emit = defineEmits<{
	next: [];
	prev: [];
	replace: [];
	'replace-all': [];
	close: [];
}>();

/** Human-readable `n / total` counter; shows `0 / 0` when there are no matches. */
const counter = computed(() => {
	if (props.matchCount === 0) {
		return '0 / 0';
	}
	return `${props.currentIndex + 1} / ${props.matchCount}`;
});

const hasMatches = computed(() => props.matchCount > 0);
</script>

<template>
	<div class="pptx-vue-find-replace" role="search">
		<div class="pptx-vue-fr-row">
			<input
				v-model="query"
				type="text"
				class="pptx-vue-fr-input"
				placeholder="Find"
				aria-label="Find"
				@keydown.enter.prevent="emit('next')"
				@keydown.esc.prevent="emit('close')"
			/>
			<span class="pptx-vue-fr-counter" aria-live="polite">{{ counter }}</span>
			<button
				type="button"
				class="pptx-vue-fr-btn"
				title="Previous match"
				aria-label="Previous match"
				:disabled="!hasMatches"
				@click="emit('prev')"
			>
				‹
			</button>
			<button
				type="button"
				class="pptx-vue-fr-btn"
				title="Next match"
				aria-label="Next match"
				:disabled="!hasMatches"
				@click="emit('next')"
			>
				›
			</button>
			<label class="pptx-vue-fr-case" title="Match case">
				<input v-model="matchCase" type="checkbox" />
				<span>Aa</span>
			</label>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-close"
				title="Close"
				aria-label="Close find and replace"
				@click="emit('close')"
			>
				×
			</button>
		</div>
		<div class="pptx-vue-fr-row">
			<input
				v-model="replacement"
				type="text"
				class="pptx-vue-fr-input"
				placeholder="Replace"
				aria-label="Replace"
				@keydown.enter.prevent="emit('replace')"
				@keydown.esc.prevent="emit('close')"
			/>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-text"
				:disabled="!hasMatches"
				@click="emit('replace')"
			>
				Replace
			</button>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-text"
				:disabled="!hasMatches"
				@click="emit('replace-all')"
			>
				Replace All
			</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-find-replace {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	padding: 0.5rem 0.625rem;
	background: #1f2937;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5rem;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	color: #f9fafb;
	font-size: 0.8125rem;
}

.pptx-vue-fr-row {
	display: flex;
	align-items: center;
	gap: 0.375rem;
}

.pptx-vue-fr-input {
	flex: 1 1 auto;
	min-width: 8rem;
	padding: 0.25rem 0.5rem;
	background: #111827;
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 0.25rem;
	color: inherit;
	font: inherit;
}

.pptx-vue-fr-input:focus {
	outline: none;
	border-color: #3b82f6;
}

.pptx-vue-fr-counter {
	min-width: 3.5rem;
	text-align: center;
	font-variant-numeric: tabular-nums;
	color: #9ca3af;
}

.pptx-vue-fr-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 1.75rem;
	height: 1.75rem;
	padding: 0 0.5rem;
	background: #374151;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.25rem;
	color: inherit;
	font: inherit;
	line-height: 1;
	cursor: pointer;
}

.pptx-vue-fr-btn:hover:not(:disabled) {
	background: #4b5563;
}

.pptx-vue-fr-btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.pptx-vue-fr-text {
	min-width: auto;
}

.pptx-vue-fr-close {
	font-size: 1.1rem;
}

.pptx-vue-fr-case {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	user-select: none;
	cursor: pointer;
}
</style>
