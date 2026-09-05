/**
 * deckDataFieldChanged: structural-equality check used by every binding's AI
 * bridge `applyDeckData()` to decide whether a top-level `PptxData` field
 * changed before committing it back through the binding's own history/write
 * path.
 *
 * Before this module existed, React, Vue, Angular, Svelte and Vanilla each
 * declared the identical `const differs = (a, b) => JSON.stringify(a) !==
 * JSON.stringify(b)` locally inside their `useAiBridge` / `ai-bridge`
 * modules: a pure helper with no framework imports, duplicated five times
 * (the exact Rule 2 extraction trigger in CLAUDE.md). Bindings should import
 * this instead of re-declaring their own copy.
 *
 * @module ai/deck-data-diff
 */

/** True when `a` and `b` are not structurally (deep-value) equal. */
export function deckDataFieldChanged(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) !== JSON.stringify(b);
}
