<script setup lang="ts">
/**
 * AiHistoryMenu: the dropdown opened from the AI toolbar's "Chats" button. It
 * lists saved chats (newest first), offers "New chat", and a caption making
 * clear that history lives in this browser. All persistence lives in
 * `useAiChatHistory`; this component only emits. Mirrors React's AiHistoryMenu.
 */
import { MessageSquare, Plus, Trash2 } from 'lucide-vue-next';
import type { PptxAiChatSummary } from 'pptx-viewer-shared/ai';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	chats: PptxAiChatSummary[];
	activeChatId: string;
}>();
const emit = defineEmits<{
	(e: 'resume' | 'delete', id: string): void;
	(e: 'new-chat' | 'close'): void;
}>();
const { t } = useI18n();
const root = ref<HTMLElement | null>(null);

// Close on outside click.
function onDocMouseDown(event: MouseEvent): void {
	if (root.value && !root.value.contains(event.target as Node)) {
		emit('close');
	}
}
onMounted(() => document.addEventListener('mousedown', onDocMouseDown));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown));
</script>

<template>
	<div
		ref="root"
		class="absolute right-2 top-10 z-40 w-64 rounded-md border border-border bg-popover shadow-xl"
	>
		<div class="flex items-center justify-between border-b border-border px-2.5 py-1.5">
			<span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.ai.historyTitle') }}
			</span>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary"
				@click="
					emit('new-chat');
					emit('close');
				"
			>
				<Plus class="w-3 h-3" />
				{{ t('pptx.ai.newChat') }}
			</button>
		</div>

		<p
			v-if="props.chats.length === 0"
			class="px-3 py-4 text-center text-[12px] text-muted-foreground"
		>
			{{ t('pptx.ai.historyEmpty') }}
		</p>
		<ul v-else class="max-h-64 overflow-y-auto py-1">
			<li v-for="chat in props.chats" :key="chat.id" class="group flex items-center gap-1 px-1">
				<button
					type="button"
					class="flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
					:class="chat.id === props.activeChatId ? 'bg-accent/60' : ''"
					@click="
						emit('resume', chat.id);
						emit('close');
					"
				>
					<MessageSquare class="mt-0.5 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[12px] font-medium text-foreground">
							{{ chat.title || t('pptx.ai.untitledChat') }}
						</span>
						<span class="block text-[10px] text-muted-foreground">
							{{ t('pptx.ai.messageCount', { count: chat.messageCount }) }}
						</span>
					</span>
				</button>
				<button
					type="button"
					:title="t('pptx.ai.deleteChat')"
					:aria-label="t('pptx.ai.deleteChat')"
					class="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					@click="emit('delete', chat.id)"
				>
					<Trash2 class="w-3.5 h-3.5" />
				</button>
			</li>
		</ul>

		<p class="border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
			{{ t('pptx.ai.historyHint') }}
		</p>
	</div>
</template>
