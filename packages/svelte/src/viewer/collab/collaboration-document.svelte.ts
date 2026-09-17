import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
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
	observeExternalCollaborationReadiness,
	readSlidesFromYDoc,
} from 'pptx-viewer-shared';

import type { CollaborationDeps } from './collaboration-deps';
import {
	adoptDocSlidesAfterLoad,
	observeRemoteSlides,
	publishLocalSlides,
} from './collaboration-remote-sync';

/** Svelte state around the shared external-document readiness controller. */
export class CollaborationDocument {
	readOnly = $state(false);
	readonly livePatcher = createCollaborationLivePatcher();
	readonly gate = createSyncGate(() => this.flush());
	readonly #deps: CollaborationDeps;
	readonly #setStatus: (status: ConnectionStatus) => void;
	#doc: YDocLike | null = null;
	#factories: YjsFactories | null = null;
	#config: CollaborationConfig | null = null;
	#applyingRemote = false;
	#lastSynced = '';
	#external: ExternalCollaborationReadiness | null = null;
	#unobserve: (() => void) | null = null;
	readonly #writeBack = createWriteBackScheduler({
		getYDoc: () => this.#doc,
		getSourceBytes: () => this.#deps.getSourceBytes?.() ?? null,
		getSaveOptions: () => this.#deps.getSaveOptions?.(),
	});
	constructor(deps: CollaborationDeps, setStatus: (status: ConnectionStatus) => void) {
		this.#deps = deps;
		this.#setStatus = setStatus;
	}
	begin(config: CollaborationConfig): void {
		this.#config = config;
		this.readOnly = config.role === 'viewer' || Boolean(config.externalSession);
	}
	attach(doc: YDocLike, factories: YjsFactories): void {
		this.#doc = doc;
		this.#factories = factories;
		const config = this.#config;
		if (!config) {
			return;
		}
		if (config.externalSession) {
			this.#external = observeExternalCollaborationReadiness(config.externalSession, {
				gate: this.gate,
				livePatcher: this.livePatcher,
				factories,
				role: config.role,
				sessionIntent: config.sessionIntent,
				onStatus: this.#setStatus,
				adoptSlides: (slides) => {
					this.#adopt(slides);
					this.#writeBack.schedule(config);
				},
				onReady: ({ seedEmptyRoom }) => {
					if (seedEmptyRoom) {
						this.#lastSynced = '';
					}
					this.flush();
				},
				onSuspend: () => this.#writeBack.cancel(),
				onReadOnlyChange: (readOnly) => {
					this.readOnly = readOnly;
				},
			});
			return;
		}
		this.livePatcher.configure(config.role === 'viewer' ? null : doc, factories);
		this.#unobserve = observeRemoteSlides(doc, config, this.#remoteDeps());
		const initial = readSlidesFromYDoc(doc);
		if (initial.length) {
			this.#adopt(initial);
		}
	}
	#remoteDeps() {
		return {
			isApplyingRemote: () => this.#applyingRemote,
			setApplyingRemote: (value: boolean) => {
				this.#applyingRemote = value;
			},
			setLastSynced: (value: string) => {
				this.#lastSynced = value;
			},
			applyRemoteSlides: (slides: PptxSlide[]) => this.#deps.applyRemoteSlides(slides),
			scheduleWriteBack: (config: CollaborationConfig) => this.#writeBack.schedule(config),
		};
	}
	#adopt(slides: PptxSlide[]): void {
		this.#lastSynced = JSON.stringify(slides);
		this.#applyingRemote = true;
		try {
			this.#deps.applyRemoteSlides(slides);
		} finally {
			this.#applyingRemote = false;
		}
	}
	adoptAfterLoad(origin: CollabLoadOrigin): void {
		if (this.#external) {
			this.#external.handleLoad(origin);
		} else if (this.#doc) {
			adoptDocSlidesAfterLoad(this.#doc, this.#remoteDeps(), origin);
		}
	}
	flush(slides: PptxSlide[] = this.#deps.getSlides()): void {
		if (!this.gate.isOpen()) {
			return;
		}
		if (this.#config?.externalSession && !this.#config.externalSession.getSnapshot().synced) {
			return;
		}
		const published = publishLocalSlides({
			slides,
			ydoc: this.#doc,
			factories: this.#factories,
			applyingRemote: this.#applyingRemote,
			role: this.#config?.role,
			lastSynced: this.#lastSynced,
		});
		if (published === null) {
			return;
		}
		this.#lastSynced = published;
		if (this.#config) {
			this.#writeBack.schedule(this.#config);
		}
	}
	stop(): void {
		this.#external?.();
		this.#external = null;
		this.#unobserve?.();
		this.#unobserve = null;
		this.#writeBack.cancel();
		this.gate.reset();
		this.livePatcher.configure(null, null);
		this.#doc = null;
		this.#factories = null;
		this.#config = null;
		this.#applyingRemote = false;
		this.#lastSynced = '';
		this.readOnly = false;
	}
}
