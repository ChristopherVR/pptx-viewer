/**
 * Pure gating predicate for the AI assistant UI. The ribbon Sparkles toggle and
 * the chat pane are shown only when the host supplies an `ai` config; keeping
 * this a standalone function makes the rule unit-testable without mounting the
 * component (the Angular test setup is TestBed-free).
 */
import type { PptxAiConfig } from '../../internal/shared-ai';

/** Whether the AI assistant toggle should be shown for the given config. */
export function aiToggleVisible(config: PptxAiConfig | undefined): boolean {
	return Boolean(config);
}
