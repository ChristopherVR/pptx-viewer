/**
 * AI assistant barrel. Only the light, `ai`-SDK-free surface is re-exported
 * here (the bridge builder and the chrome mount). The panel builder
 * (`ai-panel.ts`) is intentionally NOT re-exported so that importing this
 * barrel never statically pulls in the optional `ai` SDK; the panel is reached
 * through the dynamic `import('./ai-panel')` inside `mountAiChat`.
 */

export type { VanillaAiBridgeDeps } from './ai-bridge';
export { createVanillaAiBridge } from './ai-bridge';
export type { AiFocusController } from './ai-panel-controller';
export { createAiFocusController } from './ai-panel-controller';
export type { AiChatMount, MountAiChatDeps } from './ai-toggle';
export { mountAiChat } from './ai-toggle';
