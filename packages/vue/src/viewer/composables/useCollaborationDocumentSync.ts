import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	ConnectionStatus,
	ExternalCollaborationReadiness,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	createCollaborationLivePatcher,
	createSyncGate,
	createWriteBackScheduler,
	LOCAL_SYNC_ORIGIN,
	observeExternalCollaborationReadiness,
	observeYDocSlides,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import { ref, watch } from 'vue';

import { watchLoadAdoption } from './collaboration-load-adoption';
import type { UseCollaborationOptions } from './collaboration-types';
import { buildSaveSlides } from './template-editing';

/** Vue watches around the shared external readiness and document policy. */
export function useCollaborationDocumentSync(
	options: UseCollaborationOptions,
	status: { value: ConnectionStatus },
) {
	const readOnly = ref(false);
	const livePatcher = createCollaborationLivePatcher();
	let doc: YDocLike | null = null;
	let factories: YjsFactories | null = null;
	let config: CollaborationConfig | null = null;
	let applyingRemote = false;
	let lastSynced = '';
	let external: ExternalCollaborationReadiness | null = null;
	let unobserve: (() => void) | null = null;
	const writeBack = createWriteBackScheduler({
		getYDoc: () => doc,
		serialize: options.serialize,
		getSourceBytes: options.getSourceBytes,
		getTemplateElements: options.getTemplateElements,
		mergeTemplateElements: buildSaveSlides,
		getSaveOptions: options.getSaveOptions,
	});
	const gate = createSyncGate(flush);

	function flush(): void {
		if (!doc || !factories || !config || applyingRemote || !gate.isOpen()) {
			return;
		}
		if (
			config.role === 'viewer' ||
			(config.externalSession && !config.externalSession.getSnapshot().synced)
		) {
			return;
		}
		const serialized = JSON.stringify(options.slides.value);
		if (serialized === lastSynced) {
			return;
		}
		lastSynced = serialized;
		reconcileSlidesInYDoc(options.slides.value, doc, factories);
		writeBack.schedule(config);
	}
	function adopt(slides: PptxSlide[]): void {
		lastSynced = JSON.stringify(slides);
		applyingRemote = true;
		try {
			options.onRemoteSlides(slides);
		} finally {
			applyingRemote = false;
		}
	}
	function begin(next: CollaborationConfig): void {
		config = next;
		readOnly.value = next.role === 'viewer' || Boolean(next.externalSession);
	}
	function attach(nextDoc: YDocLike, nextFactories: YjsFactories): void {
		doc = nextDoc;
		factories = nextFactories;
		if (!config) {
			return;
		}
		const activeConfig = config;
		if (activeConfig.externalSession) {
			external = observeExternalCollaborationReadiness(activeConfig.externalSession, {
				gate,
				livePatcher,
				factories,
				role: activeConfig.role,
				sessionIntent: activeConfig.sessionIntent,
				onStatus: (value) => {
					status.value = value;
				},
				adoptSlides: (slides) => {
					adopt(slides);
					writeBack.schedule(activeConfig);
				},
				onReady: ({ seedEmptyRoom }) => {
					if (seedEmptyRoom) {
						lastSynced = '';
					}
					flush();
				},
				onSuspend: () => writeBack.cancel(),
				onReadOnlyChange: (value) => {
					readOnly.value = value;
				},
			});
			return;
		}
		livePatcher.configure(activeConfig.role === 'viewer' ? null : doc, factories);
		unobserve = observeYDocSlides(doc, (_events, transaction) => {
			if (transaction?.origin === LOCAL_SYNC_ORIGIN || applyingRemote || !doc) {
				return;
			}
			const remote = readSlidesFromYDoc(doc);
			if (!remote.length) {
				return;
			}
			adopt(remote);
			writeBack.schedule(activeConfig);
		});
		// A provider may have synchronized before its observer was attached.
		const initial = readSlidesFromYDoc(doc);
		if (initial.length) {
			adopt(initial);
		}
	}

	const stopWatch = watch(options.slides, flush, { deep: false });
	const stopBuiltinLoad = options.loadVersion
		? watchLoadAdoption({
				loadVersion: options.loadVersion,
				getYDoc: () => doc,
				isConnected: () => !config?.externalSession && status.value === 'connected',
				getLoadOrigin: options.getLoadOrigin,
				adoptDocSlides: adopt,
			})
		: null;
	const stopExternalLoad = options.loadVersion
		? watch(
				options.loadVersion,
				() => {
					external?.handleLoad(options.getLoadOrigin?.() ?? 'user');
				},
				{ flush: 'sync' },
			)
		: null;

	function stop(): void {
		external?.();
		external = null;
		unobserve?.();
		unobserve = null;
		gate.reset();
		writeBack.cancel();
		livePatcher.configure(null, null);
		doc = null;
		factories = null;
		config = null;
		applyingRemote = false;
		lastSynced = '';
		readOnly.value = false;
	}
	return {
		readOnly,
		livePatcher,
		gate,
		begin,
		attach,
		stop,
		dispose: () => {
			stop();
			stopWatch();
			stopBuiltinLoad?.();
			stopExternalLoad?.();
		},
	};
}
