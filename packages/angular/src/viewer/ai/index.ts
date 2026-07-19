/**
 * Barrel for the Angular AI assistant panel and its supporting service /
 * bridge. `PowerPointViewerComponent` mounts {@link AiChatPanelComponent} behind
 * a `@defer` block, gated on the host's `ai` config input.
 */
export { AiChatPanelComponent } from './ai-chat-panel.component';
export { AiChatService } from './ai-chat.service';
export type { AiChatInitState } from './ai-chat.service';
export { createAngularAiBridge } from './ai-bridge';
export type { BridgeDeps } from './ai-bridge';
export { aiToggleVisible } from './ai-gating';
export { AiComposerComponent } from './ai-composer.component';
export { AiMessageListComponent } from './ai-message-list.component';
export { AiProposalCardComponent } from './ai-proposal-card.component';
export { AiToolCallCardComponent } from './ai-tool-call-card.component';
