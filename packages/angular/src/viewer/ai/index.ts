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
export { AiFocusBarComponent } from './ai-focus-bar.component';
export { AiHistoryMenuComponent } from './ai-history-menu.component';
export { AiHistoryService } from './ai-history.service';
export type { AiHistoryInitDeps } from './ai-history.service';
export {
	buildChatLogExport,
	buildChatLogMarkdown,
	collectStoredChats,
	exportAiChatLogs,
} from './ai-log-export';
export type { AiLogChat, AiLogExport, AiLogFormat, AiLogMessage } from './ai-log-export';
export { AiSettingsSectionComponent } from './ai-settings-section.component';
export { AiChangeOverlayComponent } from './ai-change-overlay.component';
export { AiFocusHighlightOverlayComponent } from './ai-focus-highlight-overlay.component';
export { AiMessageListComponent } from './ai-message-list.component';
export { AiPanelStore } from './ai-panel-store';
export type { AiPanelSelectionAccessors } from './ai-panel-store';
export { AiProposalCardComponent } from './ai-proposal-card.component';
export { AiToolCallCardComponent } from './ai-tool-call-card.component';
export { computeFocusTargets, focusTargetChips, isTwoTableFocus } from './focus-targets';
export type { AiCanvasHighlight, FocusChip, FocusSelectionInput } from './focus-targets';
