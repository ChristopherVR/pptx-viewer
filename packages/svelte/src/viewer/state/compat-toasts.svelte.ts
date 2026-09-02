import type { PptxCompatibilityWarning } from 'pptx-viewer-core';
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { compatibilityWarningToasts } from 'pptx-viewer-shared';

/** Cap the visible toast stack; the rest collapse into a "+N" count. */
const VISIBLE_TOAST_LIMIT = 5;

/**
 * CompatToastsState: the fidelity-loss toast stack shown after a load whose
 * parse reported `PptxCompatibilityWarning`s (unmodelled markup, external
 * image references, a chart workbook that could not be written back, and so
 * on). Svelte port of Vue's `useCompatibilityToasts` composable.
 *
 * Toasts do not auto-hide (they are load diagnostics, not transient
 * notices): they persist until dismissed, and `reset()` clears them for a
 * newly loaded document, called from the same load-commit hook that resets
 * the read-only recommendation.
 */
export class CompatToastsState {
	#dismissedIds = $state<Set<string>>(new Set());
	#allDismissed = $state(false);
	#getWarnings: () => readonly PptxCompatibilityWarning[];

	constructor(deps: { getWarnings(): readonly PptxCompatibilityWarning[] }) {
		this.#getWarnings = deps.getWarnings;
	}

	#allToasts(): CompatibilityWarningToast[] {
		return compatibilityWarningToasts(this.#getWarnings());
	}

	#activeToasts(): CompatibilityWarningToast[] {
		return this.#allDismissed
			? []
			: this.#allToasts().filter((toast) => !this.#dismissedIds.has(toast.id));
	}

	/** Every toast this load produced, dismissed ones excluded, capped at the visible limit. */
	get visibleToasts(): CompatibilityWarningToast[] {
		return this.#activeToasts().slice(0, VISIBLE_TOAST_LIMIT);
	}

	/** How many more toasts exist beyond the visible limit. */
	get overflowCount(): number {
		return Math.max(0, this.#activeToasts().length - VISIBLE_TOAST_LIMIT);
	}

	dismiss(id: string): void {
		this.#dismissedIds = new Set(this.#dismissedIds).add(id);
	}

	dismissAll(): void {
		this.#allDismissed = true;
	}

	/** Clear the dismissal state for a newly loaded document. */
	reset(): void {
		this.#dismissedIds = new Set();
		this.#allDismissed = false;
	}
}
