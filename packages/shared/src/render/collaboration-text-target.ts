import type { PptxElement, TextSegment } from 'pptx-viewer-core';

import { findElementYMap } from './collaboration-live-patch-target';
import { LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import type { YDocLike, YjsFactories } from './collaboration-sync';
import { YDOC_SLIDES_KEY } from './collaboration-sync';
import { decodeDelta } from './collaboration-text-codec';
import { registerCollaborationTextLease } from './collaboration-text-lease';
import { initializeCollaborationText } from './collaboration-text-legacy';
import { isYTextEditable } from './collaboration-text-merge';
import { createCollaborationTextSession } from './collaboration-text-session';
import type {
	CollaborationTextSession,
	CollaborationTextSnapshot,
} from './collaboration-text-session';
import { inlineListBodyText } from './inline-list-body';
import type { InlineTextEditSnapshot } from './inline-list-types';

export interface CollaborationInlineSnapshot extends CollaborationTextSnapshot {
	readonly inline: InlineTextEditSnapshot;
}

/** A mounted editor owns this handle, never the document or its provider. */
export interface CollaborationTextTarget extends CollaborationTextSession {
	readMerged: () => CollaborationInlineSnapshot | undefined;
	/** A bookmark follows character identity rather than a mutable numeric offset. */
	bookmark: (index: number, association: number) => () => number | null;
}

/**
 * Bind a native text session to an exact live element. Replacing the element,
 * text, document, or write permission retires it, including reentrant changes
 * made by a host's beforeTransaction listener.
 */
export function createCollaborationTextTarget({
	doc,
	factories,
	slideId,
	elementId,
	isWritable,
	onChange,
	ownsModel,
}: {
	doc: YDocLike;
	factories: YjsFactories;
	slideId: string | undefined;
	elementId: string;
	isWritable: () => boolean;
	/** The caller reads and acknowledges a snapshot only after painting it. */
	onChange?: () => void;
	/** Native controller retires synchronously before explicit model changes reconcile. */
	ownsModel?: (element: PptxElement) => boolean;
}): CollaborationTextTarget | undefined {
	const element = findElementYMap(doc, slideId, elementId);
	if (element && factories.createTextPositions) {
		initializeCollaborationText(
			doc,
			element,
			factories,
			() => isWritable() && findElementYMap(doc, slideId, elementId) === element,
		);
	}
	const text = element?.get('textBody');
	if (!element || !isYTextEditable(text) || !factories.createTextPositions || !isWritable()) {
		return undefined;
	}
	const positions = factories.createTextPositions(text);
	let disposed = false;
	let applying = false;
	const isCurrent = (): boolean =>
		!disposed &&
		isWritable() &&
		findElementYMap(doc, slideId, elementId) === element &&
		element.get('textBody') === text;
	const session = createCollaborationTextSession({
		text,
		positions,
		isCurrent,
		transact: (callback) =>
			doc.transact(() => {
				callback();
				if (isCurrent()) {
					const segments = decodeDelta(text.toDelta()) as unknown as TextSegment[];
					const value = inlineListBodyText(segments);
					if (element.get('text') !== value) {
						element.set('text', value);
					}
				}
			}, LOCAL_SYNC_ORIGIN),
	});
	if (!session) {
		return undefined;
	}
	const slides = doc.getArray(YDOC_SLIDES_KEY);
	let previous = JSON.stringify(text.toDelta());
	const changed = (): void => {
		if (disposed || applying) {
			return;
		}
		const next = isCurrent() ? JSON.stringify(text.toDelta()) : undefined;
		if (next !== previous) {
			previous = next ?? '';
			onChange?.();
		}
	};
	slides.observeDeep(changed);
	const releaseLease = ownsModel ? registerCollaborationTextLease(element, ownsModel) : () => {};
	const readMerged = (): CollaborationInlineSnapshot | undefined => {
		const snapshot = session.readMerged();
		if (!snapshot) {
			return undefined;
		}
		const segments = decodeDelta([...snapshot.delta]) as unknown as TextSegment[];
		// Keep the exact snapshot identity used by the session's acknowledgement guard.
		return Object.assign(snapshot, {
			inline: { elementId, text: inlineListBodyText(segments), textSegments: segments },
		});
	};
	return {
		readMerged,
		adoptMerged: session.adoptMerged,
		applyLocalDelta(delta, edit) {
			if (!isCurrent()) {
				return false;
			}
			applying = true;
			try {
				return session.applyLocalDelta(delta, edit);
			} finally {
				applying = false;
				changed();
			}
		},
		bookmark: session.bookmark,
		dispose() {
			if (!disposed) {
				disposed = true;
				releaseLease();
				slides.unobserveDeep(changed);
				session.dispose();
				onChange?.();
			}
		},
	};
}
