import type { PptxSlide } from 'pptx-viewer-core';

import type { CollaborationRole } from '../types';
import type { ExternalCollaborationSession } from './collaboration-external-session';
import { observeExternalCollaborationSession } from './collaboration-external-session';
import type { CollaborationLivePatcher } from './collaboration-live-patch';
import type { ConnectionStatus } from './collaboration-presence';
import type { YjsFactories } from './collaboration-sync';
import { readSlidesFromYDoc } from './collaboration-sync';
import type { SyncGate } from './collaboration-sync-gate';

export interface ExternalCollaborationReadinessOptions {
	gate: Pick<SyncGate, 'isOpen' | 'open' | 'reset'>;
	livePatcher: CollaborationLivePatcher;
	factories: YjsFactories;
	role?: CollaborationRole;
	onStatus: (status: ConnectionStatus) => void;
	/** Apply the authoritative slides and update the binding's echo baseline. */
	adoptSlides: (slides: PptxSlide[]) => void;
	/** An initial empty join must keep waiting until room content or an explicit load. */
	canAdoptEmptySlides?: () => boolean;
}

/** Adopt preloaded room content before enabling either full or interim writes. */
export function observeExternalCollaborationReadiness(
	session: ExternalCollaborationSession,
	options: ExternalCollaborationReadinessOptions,
): () => void {
	let previouslySynced = false;
	return observeExternalCollaborationSession(session, (snapshot) => {
		options.onStatus(snapshot.status);
		if (!snapshot.synced) {
			options.gate.reset();
			options.livePatcher.configure(null, null);
			return;
		}
		if (!options.gate.isOpen()) {
			const slides = readSlidesFromYDoc(session.doc);
			if (slides.length > 0 || (previouslySynced && (options.canAdoptEmptySlides?.() ?? true))) {
				options.adoptSlides(slides);
			}
		}
		previouslySynced = true;
		options.livePatcher.configure(
			options.role === 'viewer' ? null : session.doc,
			options.role === 'viewer' ? null : options.factories,
		);
		options.gate.open();
	});
}
