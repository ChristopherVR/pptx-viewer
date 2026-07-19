/**
 * AI assistant barrel. Only the light, `ai`-SDK-free surface is re-exported
 * here (the bridge builder + its dep type). The chat runes controller
 * (`chat.svelte.ts`) and the panel components are intentionally NOT re-exported
 * so importing this barrel never statically pulls in `@ai-sdk/svelte` / `ai`;
 * the panel is reached through the dynamic `import('./components/ai/...')`
 * inside `PowerPointViewer.svelte`.
 */

export type { SvelteAiBridgeDeps } from './ai-bridge';
export { createSvelteAiBridge } from './ai-bridge';
