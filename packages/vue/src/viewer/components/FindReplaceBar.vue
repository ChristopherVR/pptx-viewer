<script setup lang="ts">
/**
 * FindReplaceBar: compact find-and-replace bar for the Vue editor.
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

/** Shared input classes: mirrors React's find/replace inputs. */
const FR_INPUT =
	'flex-1 min-w-32 rounded border border-border bg-muted px-2 py-1 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
/** Shared icon-button classes: ghost buttons matching React's nav controls. */
const FR_BTN =
	'inline-flex items-center justify-center min-w-7 h-7 rounded border border-border bg-muted px-2 leading-none text-foreground cursor-pointer hover:bg-accent disabled:opacity-45 disabled:cursor-not-allowed';
</script>

<template>
	<div
		class="pptx-vue-find-replace flex flex-col gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-2 text-[0.8125rem] text-popover-foreground shadow-lg"
		role="search"
	>
		<div class="pptx-vue-fr-row flex items-center gap-1.5">
			<input
				v-model="query"
				type="text"
				class="pptx-vue-fr-input"
				:class="FR_INPUT"
				placeholder="Find"
				aria-label="Find"
				@keydown.enter.prevent="emit('next')"
				@keydown.esc.prevent="emit('close')"
			/>
			<span
				class="pptx-vue-fr-counter min-w-14 text-center tabular-nums text-muted-foreground"
				aria-live="polite"
				>{{ counter }}</span
			>
			<button
				type="button"
				class="pptx-vue-fr-btn"
				:class="FR_BTN"
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
				:class="FR_BTN"
				title="Next match"
				aria-label="Next match"
				:disabled="!hasMatches"
				@click="emit('next')"
			>
				›
			</button>
			<label
				class="pptx-vue-fr-case inline-flex items-center gap-1 select-none cursor-pointer"
				title="Match case"
			>
				<input v-model="matchCase" type="checkbox" />
				<span>Aa</span>
			</label>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-close text-[1.1rem]"
				:class="FR_BTN"
				title="Close"
				aria-label="Close find and replace"
				@click="emit('close')"
			>
				×
			</button>
		</div>
		<div class="pptx-vue-fr-row flex items-center gap-1.5">
			<input
				v-model="replacement"
				type="text"
				class="pptx-vue-fr-input"
				:class="FR_INPUT"
				placeholder="Replace"
				aria-label="Replace"
				@keydown.enter.prevent="emit('replace')"
				@keydown.esc.prevent="emit('close')"
			/>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-text !min-w-0"
				:class="FR_BTN"
				:disabled="!hasMatches"
				@click="emit('replace')"
			>
				Replace
			</button>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-text !min-w-0"
				:class="FR_BTN"
				:disabled="!hasMatches"
				@click="emit('replace-all')"
			>
				Replace All
			</button>
		</div>
	</div>
</template>
