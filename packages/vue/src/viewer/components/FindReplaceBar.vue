<script setup lang="ts">
/**
 * FindReplaceBar: compact find-and-replace bar for the Vue editor.
 *
 * Purely presentational: it owns no search state. The parent wires it to a
 * {@link useFindReplace} instance via `v-model:query`, `v-model:replacement`,
 * and `v-model:match-case`, passes the live `matchCount`/`currentIndex`, and
 * listens for the navigation/replace/close intents as emits.
 */
import { CaseSensitive, ChevronDown, ChevronUp, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	matchCount: number;
	currentIndex: number;
}>();

const { t } = useI18n();

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
				:placeholder="t('pptx.findReplace.findPlaceholder')"
				:aria-label="t('pptx.findReplace.searchText')"
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
				:title="t('pptx.findReplace.previousMatch')"
				:aria-label="t('pptx.findReplace.previousMatch')"
				:disabled="!hasMatches"
				@click="emit('prev')"
			>
				<ChevronUp class="w-4 h-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="pptx-vue-fr-btn"
				:class="FR_BTN"
				:title="t('pptx.findReplace.nextMatch')"
				:aria-label="t('pptx.findReplace.nextMatch')"
				:disabled="!hasMatches"
				@click="emit('next')"
			>
				<ChevronDown class="w-4 h-4" aria-hidden="true" />
			</button>
			<label
				class="pptx-vue-fr-case inline-flex items-center gap-1 select-none cursor-pointer"
				:title="t('pptx.findReplace.matchCase')"
			>
				<input v-model="matchCase" type="checkbox" :aria-label="t('pptx.findReplace.matchCase')" />
				<CaseSensitive class="w-4 h-4" aria-hidden="true" />
			</label>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-close"
				:class="FR_BTN"
				:title="t('pptx.findReplace.closeEscape')"
				:aria-label="t('pptx.findReplace.closeAriaLabel')"
				@click="emit('close')"
			>
				<X class="w-4 h-4" aria-hidden="true" />
			</button>
		</div>
		<div class="pptx-vue-fr-row flex items-center gap-1.5">
			<input
				v-model="replacement"
				type="text"
				class="pptx-vue-fr-input"
				:class="FR_INPUT"
				:placeholder="t('pptx.findReplace.replacePlaceholder')"
				:aria-label="t('pptx.findReplace.replacementText')"
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
				{{ t('pptx.findReplace.replace') }}
			</button>
			<button
				type="button"
				class="pptx-vue-fr-btn pptx-vue-fr-text !min-w-0"
				:class="FR_BTN"
				:disabled="!hasMatches"
				@click="emit('replace-all')"
			>
				{{ t('pptx.findReplace.replaceAll') }}
			</button>
		</div>
	</div>
</template>
