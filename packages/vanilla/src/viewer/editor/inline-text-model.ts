import type { PptxElement } from 'pptx-viewer-core';
import { createInlineListModelObserver, readEditableText } from 'pptx-viewer-shared';
import type {
	InlineListReadResult,
	InlineTextEditSnapshot,
	PendingInlineTextEdit,
} from 'pptx-viewer-shared';

import type { ViewerState } from '../state';
import type { InlineEditorSession } from './inline-text-editor';

/** Only overlay the document part still owned by this edit session. */
export function pendingInlineTextModel(
	state: ViewerState,
	target: PendingInlineTextEdit['target'] | undefined,
	read: InlineListReadResult | undefined,
): PendingInlineTextEdit | undefined {
	if (read?.kind !== 'supported' || !target || !inlineTextTargetIsCurrent(state, target)) {
		return undefined;
	}
	return { snapshot: read.snapshot, target };
}

export function inlineTextTargetIsCurrent(
	state: ViewerState,
	target: PendingInlineTextEdit['target'] | undefined,
): boolean {
	if (!target || !state.editable || state.presenting || state.loading || state.error) {
		return false;
	}
	if (
		'slideId' in target &&
		(state.masterViewTarget || state.slides[state.currentSlide]?.id !== target.slideId)
	) {
		return false;
	}
	if (
		'masterView' in target &&
		JSON.stringify({ tab: state.masterViewTab, ...state.masterViewTarget }) !==
			JSON.stringify(target.masterView)
	) {
		return false;
	}
	return true;
}

/** Reconcile existing model transactions without adding a native-editor history stack. */
export function observeInlineTextModel(
	element: PptxElement,
	getSession: () => InlineEditorSession | null,
	getModel: () => PptxElement | undefined,
	retire: () => void,
	isCurrent: () => boolean = () => true,
) {
	const observer = createInlineListModelObserver(element);
	return {
		read(): InlineListReadResult | undefined {
			const session = getSession();
			if (session?.readList() && !isCurrent()) {
				retire();
				return undefined;
			}
			const model = getModel();
			if (model && !session?.readList() && session?.activateList(model) === false) {
				const text = readEditableText(session.el);
				retire();
				return { kind: 'unsupported', reason: 'model-replaced', text };
			}
			const read = session?.readList();
			if (!read) {
				return read;
			}
			const change = observer.check(model, read);
			if (change.kind === 'retire') {
				retire();
				return {
					kind: 'unsupported',
					reason: 'model-replaced',
					text: read.kind === 'supported' ? read.snapshot.text : read.text,
				};
			}
			if (change.kind === 'format') {
				if (!session?.formatSnapshot(change.snapshot)) {
					retire();
					return undefined;
				}
				return session.readList();
			}
			return read;
		},
		format(snapshot: InlineTextEditSnapshot): boolean {
			const supported = getSession()?.formatSnapshot(snapshot) ?? false;
			if (supported) {
				observer.expect(snapshot);
			}
			return supported;
		},
	};
}
