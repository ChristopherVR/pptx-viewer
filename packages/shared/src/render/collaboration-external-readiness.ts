import type { PptxSlide } from 'pptx-viewer-core';

import type { CollaborationRole, CollaborationSessionIntent } from '../types';
import type { ExternalCollaborationSession } from './collaboration-external-session';
import { observeExternalCollaborationSession } from './collaboration-external-session';
import type { CollaborationLivePatcher } from './collaboration-live-patch';
import type { CollabLoadOrigin } from './collaboration-load-origin';
import type { ConnectionStatus } from './collaboration-presence';
import { LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import type { YjsFactories, YTransactionLike } from './collaboration-sync';
import { observeYDocSlides, readSlidesFromYDoc } from './collaboration-sync';
import type { SyncGate } from './collaboration-sync-gate';

export interface ExternalCollaborationReadinessOptions {
	gate: Pick<SyncGate, 'isOpen' | 'open' | 'reset'>;
	livePatcher?: CollaborationLivePatcher;
	factories: YjsFactories;
	role?: CollaborationRole;
	sessionIntent?: CollaborationSessionIntent;
	onStatus: (status: ConnectionStatus) => void;
	/** Apply the authoritative slides and update the binding's echo baseline. */
	adoptSlides: (slides: PptxSlide[]) => void;
	/** Publish the latest local deck; discard a startup echo baseline when seeding. */
	onReady?: (state: { seedEmptyRoom: boolean }) => void;
	/** Revoke pending asynchronous writes before the host can become ready again. */
	onSuspend?: () => void;
	onReadOnlyChange?: (readOnly: boolean) => void;
}

export interface ExternalCollaborationReadiness {
	/** Remove only viewer listeners, without destroying host resources. */
	(): void;
	/** Re-evaluate after a local load or a binding's initial setup. */
	refresh: () => void;
	/** Explicit File > Open may initialize an empty join room. */
	allowLocalLoad: () => void;
	/** Returns true when an authoritative room replaced a bootstrap load. */
	handleLoad: (origin: CollabLoadOrigin) => boolean;
	canWrite: () => boolean;
}

/** One readiness/adoption policy for both full-deck and interim writes. */
export function observeExternalCollaborationReadiness(
	session: ExternalCollaborationSession,
	options: ExternalCollaborationReadinessOptions,
): ExternalCollaborationReadiness {
	let active = true;
	let established = false;
	let awaitingJoin = options.sessionIntent === 'join';
	let lastAdopted: string | undefined;
	let lastReadOnly: boolean | undefined;
	let unsubscribe: (() => void) | undefined;
	const canWrite = (): boolean =>
		active && options.gate.isOpen() && session.getSnapshot().synced && options.role !== 'viewer';
	const notifyReadOnly = (): void => {
		const readOnly = !canWrite();
		if (lastReadOnly !== readOnly) {
			lastReadOnly = readOnly;
			options.onReadOnlyChange?.(readOnly);
		}
	};
	const suspend = (): void => {
		const preserveAcceptedEdits = active && established && options.gate.isOpen();
		options.gate.reset();
		options.livePatcher?.configure(null, null);
		if (preserveAcceptedEdits) {
			// Interim local edits already reached the document, not the framework
			// model. Paint them before cancelling the editor; never adopt a partial
			// initial join or an old room during teardown.
			lastAdopted = undefined;
			adopt(readSlidesFromYDoc(session.doc));
		}
		options.onSuspend?.();
		notifyReadOnly();
	};
	const adopt = (slides: PptxSlide[]): void => {
		const serialized = JSON.stringify(slides);
		if (serialized !== lastAdopted) {
			lastAdopted = serialized;
			options.adoptSlides(slides);
		}
	};
	const refresh = (): void => {
		if (!active) {
			return;
		}
		const snapshot = session.getSnapshot();
		options.onStatus(snapshot.status);
		if (!snapshot.synced) {
			suspend();
			return;
		}
		if (options.gate.isOpen()) {
			return;
		}
		// Local UI state may have changed while suspended even when room bytes
		// did not. Re-adopt before reopening instead of trusting the old echo.
		lastAdopted = undefined;
		const slides = readSlidesFromYDoc(session.doc);
		if (slides.length > 0) {
			established = true;
			awaitingJoin = false;
			adopt(slides);
		} else if (established) {
			adopt(slides);
		} else if (awaitingJoin) {
			suspend();
			return;
		}
		options.livePatcher?.configure(
			options.role === 'viewer' ? null : session.doc,
			options.role === 'viewer' ? null : options.factories,
			// The host owns readiness, so accepted edits cannot wait in our timer.
			true,
		);
		options.gate.open();
		notifyReadOnly();
		options.onReady?.({ seedEmptyRoom: slides.length === 0 && !established });
	};
	const unobserve = observeYDocSlides(session.doc, (_events, transaction?: YTransactionLike) => {
		if (!active || !session.getSnapshot().synced) {
			return;
		}
		const slides = readSlidesFromYDoc(session.doc);
		if (slides.length > 0) {
			established = true;
			awaitingJoin = false;
		}
		if (transaction?.origin === LOCAL_SYNC_ORIGIN) {
			// A no-op reconciliation of [] must not establish room ownership.
			lastAdopted = JSON.stringify(slides);
			return;
		}
		if (!options.gate.isOpen()) {
			refresh();
		} else if (slides.length > 0 || established) {
			adopt(slides);
		}
	});
	const dispose = (): void => {
		if (!active) {
			return;
		}
		active = false;
		unsubscribe?.();
		unobserve();
		suspend();
	};
	try {
		unsubscribe = observeExternalCollaborationSession(session, refresh);
	} catch (error) {
		dispose();
		throw error;
	}
	return Object.assign(dispose, {
		refresh,
		canWrite,
		handleLoad: (origin: CollabLoadOrigin): boolean => {
			if (!active) {
				return false;
			}
			if (origin === 'user') {
				awaitingJoin = false;
				refresh();
			} else if (session.getSnapshot().synced) {
				const slides = readSlidesFromYDoc(session.doc);
				if (slides.length > 0) {
					lastAdopted = undefined;
					adopt(slides);
					return true;
				}
			}
			return false;
		},
		allowLocalLoad: () => {
			awaitingJoin = false;
			refresh();
		},
	});
}
