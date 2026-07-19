<script setup lang="ts">
/**
 * AiMessageList: scrollable transcript of user / assistant turns. Assistant
 * tool calls render as {@link AiToolCallCard}s inline between prose. Purely
 * presentational; auto-scrolls to the newest message.
 */
import type { UIMessage } from 'ai';
import { Bot, Sparkles, User } from 'lucide-vue-next';
import { toRenderableParts } from 'pptx-viewer-shared/ai';
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import AiToolCallCard from './AiToolCallCard.vue';

const props = defineProps<{ messages: UIMessage[]; isStreaming: boolean }>();
const { t } = useI18n();

const endRef = ref<HTMLDivElement | null>(null);

watch(
	() => [props.messages, props.isStreaming] as const,
	() => {
		void nextTick(() => endRef.value?.scrollIntoView({ block: 'end' }));
	},
	{ deep: true },
);
</script>

<template>
	<div
		v-if="props.messages.length === 0"
		class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
	>
		<Sparkles class="w-7 h-7 text-primary/70" />
		<p class="text-sm font-medium text-foreground">{{ t('pptx.ai.emptyTitle') }}</p>
		<p class="text-[12px] text-muted-foreground">{{ t('pptx.ai.emptyHint') }}</p>
	</div>

	<div v-else class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
		<template v-for="message in props.messages" :key="message.id">
			<div
				v-if="message.role === 'user' || toRenderableParts(message).length > 0"
				class="flex gap-2"
			>
				<div
					:class="
						cn(
							'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
							message.role === 'user'
								? 'bg-secondary text-muted-foreground'
								: 'bg-primary/15 text-primary',
						)
					"
					:aria-label="message.role === 'user' ? t('pptx.ai.you') : t('pptx.ai.assistant')"
				>
					<User v-if="message.role === 'user'" class="w-3.5 h-3.5" />
					<Bot v-else class="w-3.5 h-3.5" />
				</div>
				<div class="min-w-0 flex-1 space-y-1.5">
					<template
						v-for="(part, i) in toRenderableParts(message)"
						:key="part.kind === 'tool' ? part.toolCallId || i : i"
					>
						<p
							v-if="part.kind === 'text'"
							class="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground"
						>
							{{ part.text }}
						</p>
						<AiToolCallCard v-else :part="part" />
					</template>
				</div>
			</div>
		</template>
		<div
			v-if="props.isStreaming"
			class="flex items-center gap-2 pl-8 text-[12px] text-muted-foreground"
		>
			<span class="inline-flex gap-1">
				<span
					class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]"
				/>
				<span
					class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]"
				/>
				<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
			</span>
			{{ t('pptx.ai.thinking') }}
		</div>
		<div ref="endRef" />
	</div>
</template>
