import type { LocalTextReplacement } from './collaboration-text-session-delta';
import { readInlineListRange, readInlineListSelection } from './inline-list-selection';
import type { InlineListSeed } from './inline-list-types';

export interface CollaborationNativeInput extends LocalTextReplacement {
	/** Direction is authoritative even where beforeinput omits target ranges. */
	deleteDirection?: 'backward' | 'forward';
}

/** Native DOM length, not text matching, determines a collapsed deletion span. */
export function resolveCollaborationNativeRange(
	range: CollaborationNativeInput | undefined,
	previous: string,
	current: string,
): LocalTextReplacement | undefined {
	if (!range?.deleteDirection) {
		return range;
	}
	const removed = previous.length - current.length;
	if (removed <= 0) {
		return undefined;
	}
	const from = range.deleteDirection === 'backward' ? range.from - removed : range.from;
	const to = range.deleteDirection === 'forward' ? range.to + removed : range.to;
	return from >= 0 && to <= previous.length ? { from, to } : undefined;
}

/** Capture native intent before another input listener mutates the DOM. */
export function observeCollaborationInlineInput(
	root: HTMLElement,
	getSeed: () => InlineListSeed,
	apply: (range: CollaborationNativeInput | undefined) => void,
	settled: () => void,
) {
	let disposed = false;
	let composing = false;
	let pending = false;
	let range: CollaborationNativeInput | undefined;
	const capture = (event?: InputEvent): void => {
		const target = event?.getTargetRanges?.()[0];
		const read = target
			? readInlineListRange(getSeed(), root, target)
			: readInlineListSelection(getSeed(), root);
		range =
			read.kind === 'supported' && read.bodyRange
				? { from: read.bodyRange.start, to: read.bodyRange.end }
				: undefined;
		if (!target && range && range.from === range.to && event?.inputType?.startsWith('delete')) {
			if (event.inputType.endsWith('Backward')) {
				range.deleteDirection = 'backward';
			} else if (event.inputType.endsWith('Forward')) {
				range.deleteDirection = 'forward';
			}
		}
	};
	const before = (event: Event): void => {
		if (!composing) {
			capture(event as InputEvent);
		}
		pending = true;
		queueMicrotask(() => {
			if (!disposed && !composing && pending) {
				pending = false;
				settled();
			}
		});
	};
	const input = (): void => {
		if (composing || disposed) {
			return;
		}
		pending = false;
		const replacement = range;
		range = undefined;
		apply(replacement);
	};
	const start = (): void => {
		// A restarted composition still includes the unaccepted first draft.
		// Keep its original boundary until compositionend settles the draft.
		if (!composing) {
			capture();
		}
		composing = true;
	};
	const end = (): void => {
		// Browsers may emit the final input after compositionend in the same turn.
		queueMicrotask(() => {
			if (disposed) {
				return;
			}
			composing = false;
			input();
		});
	};
	root.addEventListener('beforeinput', before, true);
	root.addEventListener('paste', before, true);
	root.addEventListener('input', input, true);
	root.addEventListener('compositionstart', start, true);
	root.addEventListener('compositionend', end, true);
	return {
		blocked: () => composing || pending,
		reason: () => (composing ? 'composition-active' : pending ? 'input-active' : undefined),
		dispose(): void {
			disposed = true;
			root.removeEventListener('beforeinput', before, true);
			root.removeEventListener('paste', before, true);
			root.removeEventListener('input', input, true);
			root.removeEventListener('compositionstart', start, true);
			root.removeEventListener('compositionend', end, true);
		},
	};
}
