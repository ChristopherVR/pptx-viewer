import type { PptxSlide } from 'pptx-viewer-core';
import type { ExternalCollaborationReadiness } from 'pptx-viewer-shared';
import {
	createSyncGate,
	observeExternalCollaborationReadiness,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';

import type { UseYjsDocumentSyncInput } from './useYjsDocumentSync';

/** React state/commit wiring over the shared host readiness policy. */
export function useExternalDocumentSync(
	input: UseYjsDocumentSyncInput,
	scheduleWriteBack: () => void,
): void {
	const latest = useRef(input);
	latest.current = input;
	const controller = useRef<ExternalCollaborationReadiness | null>(null);
	const publish = useRef<(slides?: PptxSlide[]) => void>(() => {});
	const lastLoad = useRef(input.loadVersion ?? 0);
	const session = input.config?.externalSession;
	const role = input.config?.role;
	const intent = input.config?.sessionIntent;
	const { doc, isConnected, livePatcher } = input;
	useEffect(() => {
		if (!session || !doc || !isConnected) {
			return;
		}
		latest.current.onReadOnlyChange?.(true);
		let active = true;
		let revision = 0;
		let lastSynced = '';
		let superseded: PptxSlide[] | null = null;
		const initialLoad = latest.current.loadVersion ?? 0;
		const gate = createSyncGate(() => {});
		const adopt = (slides: PptxSlide[]): void => {
			revision++;
			lastSynced = JSON.stringify(slides);
			superseded = latest.current.slides;
			latest.current.setSlides(slides);
			scheduleWriteBack();
		};
		void (async () => {
			const Y = await import('yjs');
			if (!active) {
				return;
			}
			const factories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};
			publish.current = (nextSlides) => {
				const slides = nextSlides ?? latest.current.slides;
				const { loadVersion = 0 } = latest.current;
				const serialized = JSON.stringify(slides);
				const token = revision;
				queueMicrotask(() => {
					if (
						!active ||
						!controller.current?.canWrite() ||
						token !== revision ||
						slides === superseded ||
						loadVersion !== lastLoad.current ||
						serialized === lastSynced
					) {
						return;
					}
					reconcileSlidesInYDoc(slides, doc, factories);
					lastSynced = serialized;
					scheduleWriteBack();
				});
			};
			controller.current = observeExternalCollaborationReadiness(session, {
				gate,
				factories,
				livePatcher,
				role,
				sessionIntent: intent,
				onStatus: () => {},
				adoptSlides: adopt,
				onSuspend: () => {
					revision++;
				},
				onReadOnlyChange: (readOnly) => latest.current.onReadOnlyChange?.(readOnly),
				onReady: ({ seedEmptyRoom }) => {
					if (seedEmptyRoom) {
						lastSynced = '';
					}
					publish.current();
				},
			});
			if ((latest.current.loadVersion ?? 0) !== initialLoad) {
				controller.current.handleLoad(latest.current.loadOrigin ?? 'user');
			}
		})();
		return () => {
			active = false;
			revision++;
			controller.current?.();
			controller.current = null;
			publish.current = () => {};
		};
	}, [session, doc, isConnected, role, intent, livePatcher, scheduleWriteBack]);

	useEffect(() => {
		if (typeof input.isSynced === 'boolean') {
			controller.current?.refresh();
		}
	}, [input.isSynced]);

	useEffect(() => {
		const version = input.loadVersion ?? 0;
		if (version !== lastLoad.current) {
			lastLoad.current = version;
			controller.current?.handleLoad(input.loadOrigin ?? 'user');
		}
		publish.current(input.slides);
	}, [input.slides, input.loadVersion, input.loadOrigin]);
}
