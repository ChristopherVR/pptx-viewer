<script setup lang="ts">
/**
 * AiComposer: the message input row (auto-growing textarea + send / stop
 * button). Enter sends, Shift+Enter inserts a newline. Purely presentational.
 */
import { Send, Square } from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

const props = defineProps<{
	isStreaming: boolean;
	/** One-shot text to prefill the composer with (e.g. a "Fix with AI" directive). */
	prefillText?: string;
	/** Bumps on every ask/fix so the composer refocuses even when text is unchanged. */
	prefillNonce?: number;
}>();
const emit = defineEmits<{ (e: 'send', text: string): void; (e: 'stop'): void }>();
const { t } = useI18n();

const value = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const canSend = computed(() => value.value.trim().length > 0);

// Apply a click-to-ask prefill: set the text (when provided) and focus the
// composer. Keyed on the nonce so an empty "Ask about this" still refocuses.
watch(
	() => props.prefillNonce,
	(nonce) => {
		if (nonce === undefined || nonce === 0) {
			return;
		}
		if (props.prefillText) {
			value.value = props.prefillText;
		}
		void nextTick(() => textareaRef.value?.focus());
	},
);

function submit(): void {
	const trimmed = value.value.trim();
	if (trimmed.length === 0 || props.isStreaming) {
		return;
	}
	emit('send', trimmed);
	value.value = '';
}

function onKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		submit();
	}
}
</script>

<template>
	<div class="border-t border-border p-2">
		<div
			class="flex items-end gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-ring"
		>
			<textarea
				ref="textareaRef"
				v-model="value"
				:rows="1"
				:placeholder="t('pptx.ai.placeholder')"
				:aria-label="t('pptx.ai.placeholder')"
				class="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
				@keydown="onKeydown"
			/>
			<button
				v-if="props.isStreaming"
				type="button"
				:title="t('pptx.ai.stop')"
				:aria-label="t('pptx.ai.stop')"
				class="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent"
				@click="emit('stop')"
			>
				<Square class="w-4 h-4" />
			</button>
			<button
				v-else
				type="button"
				:disabled="!canSend"
				:title="t('pptx.ai.send')"
				:aria-label="t('pptx.ai.send')"
				:class="
					cn(
						'shrink-0 rounded-sm p-1.5 transition-colors',
						canSend
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'text-muted-foreground/50',
					)
				"
				@click="submit"
			>
				<Send class="w-4 h-4" />
			</button>
		</div>
	</div>
</template>
