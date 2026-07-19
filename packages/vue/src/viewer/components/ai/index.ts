/**
 * Barrel for the AI chat panel. Only the async boundary is exported for eager
 * import; the panel body and its `@ai-sdk/vue` + `pptx-viewer-shared/ai`
 * dependencies stay behind `defineAsyncComponent` and load only when the
 * assistant is first opened.
 */
import { defineAsyncComponent } from 'vue';

export const AiChatPanelLazy = defineAsyncComponent(() => import('./AiChatPanel.vue'));
