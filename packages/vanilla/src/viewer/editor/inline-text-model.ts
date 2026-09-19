import type { PptxElement } from 'pptx-viewer-core';
import {
	createInlineListModelObserver,
	overlayInlineTextSnapshot,
	readEditableText,
} from 'pptx-viewer-shared';
import type {
	InlineListReadResult,
	CollaborationLivePatcher,
	InlineTextEditSnapshot,
	PendingInlineTextEdit,
} from 'pptx-viewer-shared';

import type { ViewerState } from '../state';
import type { InlineEditorSession } from './inline-text-editor';

/** Capture the owning document part once when its native editor opens. */
export function inlineTextEditTarget(
	state: ViewerState,
): PendingInlineTextEdit['target'] | undefined {
	return state.masterViewTarget
		? { masterView: { tab: state.masterViewTab, ...state.masterViewTarget } }
		: state.slides[state.currentSlide]
			? { slideId: state.slides[state.currentSlide].id }
			: undefined;
}

/** Inherited template and master elements are not targets in the shared slide document. */
export function inlineTextCollaboration(
	state: ViewerState,
	id: string,
	patcher?: CollaborationLivePatcher,
) {
	const slide = state.slides[state.currentSlide];
	return patcher && !state.masterViewTarget && slide?.elements.some((element) => element.id === id)
		? { patcher, slideId: slide.id }
		: undefined;
}

/** Keep accepted connected text visible on host veto without creating a commit. */
export function retainAcceptedInlineTextModel(
	state: ViewerState,
	target: PendingInlineTextEdit['target'] | undefined,
	session: InlineEditorSession | null,
): ViewerState['slides'] | undefined {
	const slide = state.slides[state.currentSlide];
	if (
		!session?.readAccepted ||
		!target ||
		!('slideId' in target) ||
		state.loading ||
		state.masterViewTarget ||
		slide?.id !== target.slideId
	)
		return undefined;
	const snapshot = session.readAccepted();
	if (
		!snapshot ||
		!session.checkModel?.(slide.elements.find((element) => element.id === snapshot.elementId))
	)
		return undefined;
	const elements = overlayInlineTextSnapshot(slide.elements, snapshot);
	return elements === slide.elements
		? undefined
		: state.slides.map((candidate) =>
				candidate === slide ? { ...slide, elements: [...elements] } : candidate,
			);
}

/** Only overlay the document part still owned by this edit session. */
export function pendingInlineTextModel(
	state: ViewerState,
	target: PendingInlineTextEdit['target'] | undefined,
	read: InlineListReadResult | undefined,
): PendingInlineTextEdit | undefined {
	if (!target || !inlineTextTargetIsCurrent(state, target)) {
		return undefined;
	}
	if (
		read?.kind === 'unsupported' &&
		(read.reason === 'composition-active' || read.reason === 'input-active')
	) {
		throw new Error('Finish the current text input before saving.');
	}
	if (read?.kind !== 'supported') {
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
			if (session?.checkModel) {
				if (!isCurrent() || !session.checkModel(getModel())) {
					retire();
					return undefined;
				}
				return session.readList();
			}
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
