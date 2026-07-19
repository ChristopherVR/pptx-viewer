/**
 * `pptx-viewer-shared/ai` - framework-agnostic AI assistant core.
 *
 * This barrel is the public surface of the AI subpath. Bindings import the
 * bridge contract, session builder, config types, and (for the Vanilla binding
 * / tests) the {@link VanillaChat} adapter from here. Hosts building a backend
 * route import the schema-only tool set and system prompt from `./server`.
 *
 * The `ai` SDK is an OPTIONAL peer: nothing here imports it at runtime except
 * through the guarded {@link loadAiSdk}, so bundling this module never forces
 * the SDK to be installed.
 */

export { isAiAvailable, loadAiSdk, resetAiSdkCache } from './loader';
export type { AiSdkModule } from './loader';

export { resolveChatTransport } from './config';
export type {
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiHistoryHooks,
	PptxAiToolName,
	PptxAiUIMessage,
	PptxAiWritePolicy,
	ResolveTransportOptions,
} from './config';

export type {
	PptxAiBridge,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiFocusedTarget,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from './bridge';

export { buildDeckContext, buildFocusedTargetsContext } from './focused-context';
export type { FocusedContextOptions } from './focused-context';

export { ProposalStore } from './proposals';
export type { ProposalView, StagedProposal } from './proposals';
export { diffSlides } from './proposals-diff';

export {
	buildDeckOutline,
	buildSlideMarkdown,
	clampToTokenBudget,
	estimateTokens,
	slideTitle,
} from './context';

export { BASE_SYSTEM_PROMPT, buildSystemPrompt } from './system-prompt';

export {
	buildToolExecutors,
	buildToolSet,
	enabledToolNames,
	requireElement,
	requireSlide,
	routeWrite,
	TOOL_DEFINITIONS,
} from './tools';
export type {
	AiToolContext,
	AiToolExecutor,
	BoundExecutor,
	JsonSchema,
	ThemeApplyResult,
	ToolDefinition,
	WriteRouteResult,
} from './tools';

export { createAiChatSession } from './session';
export type { PptxAiChatSession } from './session';

export { createChatHistoryStore } from './chat-history-store';
export type { PptxAiChatStore, PptxAiChatSummary, PptxAiStoredChat } from './chat-history-store';

export { createVanillaChat } from './vanilla-chat';
export type { VanillaChatController, VanillaChatSnapshot } from './vanilla-chat';

export { buildPptxAiSystemPrompt, buildPptxAiTools } from './server';

export { applyElementUpdate, applyShapeStyleUpdate, applyTextUpdate } from './tools/mutations';

export { mergeTableElements } from './table-merge';
export type { MergeTableOptions, TableMergeDirection } from './table-merge';

export { toRenderableParts } from './ui-parts';
export type {
	AiUiMessage,
	RenderablePart,
	RenderableTextPart,
	RenderableToolPart,
} from './ui-parts';

export { summarizeToolArgs, toolLabel } from './tool-summary';
