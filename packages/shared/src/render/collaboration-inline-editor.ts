import type { PptxElement } from 'pptx-viewer-core';

import {
	bookmarkCollaborationInlineSelection,
	collaborationInlineModelKey,
	prepareCollaborationInlineDom,
} from './collaboration-inline-dom';
import {
	observeCollaborationInlineInput,
	resolveCollaborationNativeRange,
} from './collaboration-inline-input';
import type { CollaborationNativeInput } from './collaboration-inline-input';
import type { CollaborationLivePatcher } from './collaboration-live-patch';
import { encodeSegmentsToDelta } from './collaboration-text-codec';
import { createNativeCollaborationTextEdit } from './collaboration-text-native-edit';
import { createCollaborationTextProjection } from './collaboration-text-projection';
import type { CollaborationInlineSnapshot } from './collaboration-text-target';
import { attachInlineListController } from './inline-list-controller';
import type { InlineListController } from './inline-list-controller';
import { readInlineListRange } from './inline-list-selection';
import { readInlineListNativeSnapshot } from './inline-list-snapshot';
import type { InlineListReadResult, InlineTextEditSnapshot } from './inline-list-types';
import { buildParagraphs } from './text-paragraphs';

export interface CollaborationInlineEditor extends InlineListController {
	/** Current authoritative text for retirement only; pending Save must use read(). */
	readAccepted(): InlineTextEditSnapshot | undefined;
	/** An explicit model replacement retires ownership before full-deck sync. */
	checkModel(model: PptxElement | undefined): boolean;
	/** Capture a known programmatic DOM mutation, such as trimming before Enter. */
	mutate(range: AbstractRange, apply: () => void): boolean;
}

export interface CollaborationInlineEditorOptions {
	patcher: CollaborationLivePatcher;
	slideId?: string;
	onSnapshot?: (snapshot: InlineTextEditSnapshot) => void;
	onCancel?: () => void;
}

/** Opt-in mounted native editing over the host's exact live text target. */
export function attachCollaborationInlineEditor(
	root: HTMLElement,
	element: PptxElement,
	options: CollaborationInlineEditorOptions,
): CollaborationInlineEditor | undefined {
	let disposed = false;
	let busy = false;
	let model = element;
	let modelKey = collaborationInlineModelKey(element);
	let previous: InlineTextEditSnapshot | undefined;
	let painted: ReturnType<typeof prepareCollaborationInlineDom>;
	let controller: InlineListController | undefined;
	let events: ReturnType<typeof observeCollaborationInlineInput> | undefined = undefined;
	let target: ReturnType<NonNullable<CollaborationLivePatcher['beginTextEdit']>> = undefined;
	target = options.patcher.beginTextEdit?.(options.slideId, element.id, synchronize, checkModel);
	if (!target) {
		return undefined;
	}
	const initial = target.readMerged();
	if (!initial || !paint(initial)) {
		controller?.dispose();
		target.dispose();
		return undefined;
	}
	events = observeCollaborationInlineInput(root, () => painted!.seed, applyInput, synchronize);
	return {
		read,
		readAccepted: () => (!disposed ? target?.readMerged()?.inline : undefined),
		checkModel,
		mutate(range, apply) {
			if (disposed || busy || events?.blocked() || !painted) {
				return false;
			}
			const selected = readInlineListRange(painted.seed, root, range);
			if (selected.kind !== 'supported' || !selected.bodyRange) {
				return false;
			}
			try {
				apply();
			} catch {
				cancel();
				return false;
			}
			applyInput({ from: selected.bodyRange.start, to: selected.bodyRange.end });
			return !disposed;
		},
		format(snapshot) {
			if (disposed || events?.blocked()) {
				return read();
			}
			const result = controller?.format(snapshot);
			return result?.kind === 'unsupported' ? result : read();
		},
		readSelection: (selection) =>
			controller?.readSelection(selection) ?? { kind: 'unsupported', reason: 'inactive-session' },
		refresh() {
			synchronize();
			return read();
		},
		dispose,
	};

	function dispose(): void {
		if (disposed) {
			return;
		}
		disposed = true;
		events?.dispose();
		controller?.dispose();
		target!.dispose();
	}
	function cancel(): void {
		if (!disposed) {
			dispose();
			options.onCancel?.();
		}
	}
	function read(): InlineListReadResult {
		const reason = events?.reason();
		if (reason && !disposed) {
			return { kind: 'unsupported', reason, text: previous?.text ?? '' };
		}
		const merged = !disposed && target!.readMerged();
		return merged
			? {
					kind: 'supported',
					snapshot: merged.inline,
					paragraphs: buildParagraphs(model, undefined, merged.inline.textSegments, {
						preserveTrailingEmpty: true,
					}),
				}
			: { kind: 'unsupported', reason: 'inactive-session', text: '' };
	}
	function checkModel(candidate: PptxElement | undefined): boolean {
		if (disposed || !candidate || candidate.id !== element.id) {
			cancel();
			return false;
		}
		const key = collaborationInlineModelKey(candidate);
		if (key === modelKey) {
			return true;
		}
		const merged = target!.readMerged();
		if (
			merged &&
			collaborationInlineModelKey({ ...model, ...merged.inline } as PptxElement) === key
		) {
			model = candidate;
			modelKey = key;
			return true;
		}
		cancel();
		return false;
	}
	function paint(merged: CollaborationInlineSnapshot): boolean {
		if (
			!createCollaborationTextProjection(
				merged.inline.textSegments ?? [],
				merged.delta,
				merged.inline.text,
			)
		) {
			return false;
		}
		const prepared = prepareCollaborationInlineDom(root, model, merged.inline);
		if (!prepared) {
			return false;
		}
		const restore =
			painted && previous
				? bookmarkCollaborationInlineSelection(root, painted.seed, previous, target!)
				: undefined;
		controller?.dispose();
		root.replaceChildren(...prepared.children);
		painted = prepared;
		controller = attachInlineListController(root, prepared.seed, {
			isCurrent: () => !disposed,
			onFormat: () => applyInput({ from: 0, to: 0 }),
		});
		const captured = readInlineListNativeSnapshot(prepared.seed, root);
		if (
			captured.kind !== 'supported' ||
			!createCollaborationTextProjection(
				captured.snapshot.textSegments ?? [],
				merged.delta,
				captured.snapshot.text,
			) ||
			!target!.adoptMerged(merged)
		) {
			return false;
		}
		previous = captured.snapshot;
		restore?.(prepared.seed, previous);
		return true;
	}
	function synchronize(): void {
		if (!target || disposed || busy) {
			return;
		}
		const merged = target!.readMerged();
		if (!merged || !previous || !painted) {
			cancel();
			return;
		}
		if (events?.blocked()) {
			return;
		}
		const matching = createCollaborationTextProjection(
			previous.textSegments ?? [],
			merged.delta,
			previous.text,
		);
		if (matching ? !target!.adoptMerged(merged) : !paint(merged)) {
			cancel();
			return;
		}
		options.onSnapshot?.(merged.inline);
	}
	function applyInput(range: CollaborationNativeInput | undefined): void {
		if (disposed || busy || !previous || !painted) {
			return;
		}
		const next = readInlineListNativeSnapshot(painted.seed, root, previous);
		if (next.kind !== 'supported') {
			cancel();
			return;
		}
		const beforeDelta = encodeSegmentsToDelta(previous.textSegments ?? []);
		if (
			JSON.stringify(beforeDelta) ===
			JSON.stringify(encodeSegmentsToDelta(next.snapshot.textSegments ?? []))
		) {
			synchronize();
			return;
		}
		const replacement = resolveCollaborationNativeRange(range, previous.text, next.snapshot.text);
		const edit =
			replacement &&
			createNativeCollaborationTextEdit(
				{ segments: previous.textSegments ?? [], body: previous.text, delta: beforeDelta },
				{
					segments: next.snapshot.textSegments ?? [],
					body: next.snapshot.text,
					paragraphSources: next.paragraphSources,
					hiddenSources: next.hiddenSources,
				},
				replacement,
			);
		if (!edit) {
			cancel();
			return;
		}
		busy = true;
		let applied = false;
		try {
			applied = target!.applyLocalDelta(edit.delta, edit.correspondence);
		} finally {
			busy = false;
		}
		if (!applied) {
			cancel();
			return;
		}
		previous = next.snapshot;
		synchronize();
	}
}
