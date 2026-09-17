import {
	borrowExternalCollaborationAwareness,
	observeExternalCollaborationSession,
	registerCollaborationTeardown,
} from 'pptx-viewer-shared';
import type { ExternalCollaborationSession } from 'pptx-viewer-shared';
import { useEffect, useState } from 'react';

import type { UseYjsProviderResult } from './useYjsProvider';

const inactive: UseYjsProviderResult = {
	status: 'disconnected',
	awareness: null,
	doc: null,
	clientId: null,
	synced: false,
	// An external transport can only be retried by its owner.
	retry: () => {},
};

/** Attach to host resources without owning their network or lifetime. */
export function useExternalYjsSession(
	session: ExternalCollaborationSession | undefined,
): UseYjsProviderResult {
	const [binding, setBinding] = useState<{
		session: ExternalCollaborationSession;
		value: UseYjsProviderResult;
	} | null>(null);

	useEffect(() => {
		if (!session) {
			return;
		}
		let detach: (() => void) | undefined;
		const leave = (): void => {
			detach?.();
			detach = undefined;
			setBinding(null);
		};
		const attach = (): void => {
			leave();
			const borrowed = borrowExternalCollaborationAwareness(session.awareness);
			try {
				const unsubscribe = observeExternalCollaborationSession(session, (snapshot) => {
					setBinding({
						session,
						value: {
							...snapshot,
							doc: session.doc,
							awareness: borrowed.awareness,
							clientId: session.awareness.clientID,
							retry: inactive.retry,
						},
					});
				});
				detach = () => {
					unsubscribe();
					borrowed.dispose();
				};
			} catch {
				borrowed.dispose();
				setBinding({ session, value: { ...inactive, status: 'error' } });
			}
		};
		attach();
		const unregister = registerCollaborationTeardown({ leave, rejoin: attach });
		return () => {
			unregister();
			leave();
		};
	}, [session]);

	return binding && binding.session === session ? binding.value : inactive;
}
