<script setup lang="ts">
/**
 * AiChatPanel: the right-hand AI assistant pane. Loaded via
 * `defineAsyncComponent` from `PowerPointViewer.vue`, so its `@ai-sdk/vue` +
 * `pptx-viewer-shared/ai` runtime imports only load when the panel is first
 * opened.
 *
 * The panel is a thin shell: it builds/guards the session via {@link useAiChat}
 * and, once ready, delegates the whole conversation to {@link AiConversation}.
 */
import { LoaderCircle, Sparkles, TriangleAlert, X } from 'lucide-vue-next';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAiChat } from '../../composables/ai/useAiChat';
import type { AiPanelController } from '../../composables/ai/useAiPanelController';
import { useAiPanelController } from '../../composables/ai/useAiPanelController';
import AiConversation from './AiConversation.vue';

const props = defineProps<{
	bridge: PptxAiBridge;
	config: PptxAiConfig;
	panelWidth?: number;
	/**
	 * Focus / pick / live-tool controller owned by `PowerPointViewer` (it reads
	 * the live canvas selection). When the panel is mounted standalone (tests), a
	 * self-contained fallback controller keeps the focus bar functional.
	 */
	aiPanel?: AiPanelController;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();

const { state, session, initError } = useAiChat(props.bridge, props.config);
const panelStyle = computed(() =>
	props.panelWidth ? { width: `${props.panelWidth}px` } : undefined,
);

// Fall back to a standalone controller (empty selection) when the host does not
// supply one, so the panel renders its focus bar in isolation too.
const fallbackPanel = useAiPanelController({
	activeSlideIndex: ref(0),
	selectedElementIds: ref<string[]>([]),
	selectedElement: () => null,
});
const panel = computed<AiPanelController>(() => props.aiPanel ?? fallbackPanel);
</script>

<template>
	<div
		data-pptx-ai-panel=""
		class="absolute right-0 top-0 z-30 flex h-full w-80 flex-col border-l border-border bg-card shadow-xl max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[75dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:shadow-2xl"
		:style="panelStyle"
	>
		<div class="flex items-center gap-2 border-b border-border px-3 py-2">
			<Sparkles class="w-4 h-4 text-primary" />
			<span class="text-sm font-semibold text-foreground">{{ t('pptx.ai.title') }}</span>
			<button
				type="button"
				:title="t('pptx.ai.close')"
				:aria-label="t('pptx.ai.close')"
				class="ml-auto rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent"
				@click="emit('close')"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div
			v-if="state === 'checking'"
			class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
		>
			<LoaderCircle class="w-5 h-5 animate-spin" />
		</div>

		<div
			v-else-if="state === 'unavailable' || state === 'error'"
			class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
		>
			<TriangleAlert class="w-6 h-6 text-muted-foreground" />
			<p class="text-sm font-medium text-foreground">{{ t('pptx.ai.unavailableTitle') }}</p>
			<p class="text-[12px] text-muted-foreground">
				{{ initError?.message ?? t('pptx.ai.unavailableHint') }}
			</p>
		</div>

		<AiConversation
			v-else-if="state === 'ready' && session"
			:session="session"
			:config="props.config"
			:bridge="props.bridge"
			:ai-panel="panel"
		/>
	</div>
</template>
