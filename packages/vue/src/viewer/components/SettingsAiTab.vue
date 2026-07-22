<script setup lang="ts">
/**
 * File > Options > AI: a technical section that exports the full chat history,
 * including every tool call's input/output, as a downloadable JSON or Markdown
 * log for debugging. Rendered only when the host enables the `ai` prop.
 */
import { Bug, Download } from 'lucide-vue-next';
import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import { createChatHistoryStore } from 'pptx-viewer-shared/ai';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AiLogFormat } from '../composables/ai/ai-log-export';
import { exportAiChatLogs } from '../composables/ai/ai-log-export';

const props = defineProps<{
	/** Chat store to read from. Defaults to the shared `createChatHistoryStore()`. */
	store?: PptxAiChatStore;
}>();

const { t } = useI18n();
const activeStore = computed<PptxAiChatStore>(() => props.store ?? createChatHistoryStore());

const chatCount = ref<number | null>(null);
const detailed = ref(true);
const status = ref<'idle' | 'busy' | 'done'>('idle');
const doneCount = ref(0);

onMounted(async () => {
	try {
		const chats = await activeStore.value.listChats();
		chatCount.value = chats.length;
	} catch {
		chatCount.value = 0;
	}
});

async function handleExport(format: AiLogFormat): Promise<void> {
	status.value = 'busy';
	try {
		doneCount.value = await exportAiChatLogs({
			store: activeStore.value,
			format,
			detailed: detailed.value,
		});
	} catch {
		doneCount.value = 0;
	}
	status.value = 'done';
}
</script>

<template>
	<div class="space-y-4">
		<div class="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
			<Bug class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
			<div>
				<p class="text-sm font-medium text-foreground">{{ t('pptx.ai.settingsSectionTitle') }}</p>
				<p class="mt-1 text-xs text-muted-foreground">{{ t('pptx.ai.exportLogsHint') }}</p>
			</div>
		</div>

		<p class="text-xs text-muted-foreground">
			{{
				chatCount === null
					? t('pptx.ai.exportLogsCounting')
					: t('pptx.ai.exportLogsStoredCount', { count: chatCount })
			}}
		</p>

		<label class="flex items-center gap-2 text-xs text-foreground">
			<input v-model="detailed" type="checkbox" class="h-3.5 w-3.5 rounded border-border" />
			{{ t('pptx.ai.exportLogsDetailed') }}
		</label>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				:disabled="status === 'busy'"
				class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
				@click="handleExport('json')"
			>
				<Download class="h-3.5 w-3.5" />
				{{ t('pptx.ai.exportLogsJson') }}
			</button>
			<button
				type="button"
				:disabled="status === 'busy'"
				class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
				@click="handleExport('markdown')"
			>
				<Download class="h-3.5 w-3.5" />
				{{ t('pptx.ai.exportLogsMarkdown') }}
			</button>
		</div>

		<p v-if="status === 'done'" class="text-xs text-muted-foreground" role="status">
			{{
				doneCount > 0
					? t('pptx.ai.exportLogsDone', { count: doneCount })
					: t('pptx.ai.noChatsToExport')
			}}
		</p>
	</div>
</template>
