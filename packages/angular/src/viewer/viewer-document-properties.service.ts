/**
 * viewer-document-properties.service.ts: Viewer-scoped state + logic for the
 * Info (document properties) dialog and the hyperlink-edit dialog: their
 * open/closed signals, the in-session core-properties override merged over
 * the loaded document properties, and persisting an edit from either dialog.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * few accessors/emitters it alone owns (canEdit / selected-element /
 * active-slide-index / the `propertiesChange` emitter) via {@link bind}.
 *
 * Provide it once on the viewer component (`providers: [ViewerDocumentPropertiesService]`).
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxCoreProperties, PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';

/** Live host accessors the document-properties controller needs. */
interface DocumentPropertiesHost {
	readonly canEdit: () => boolean;
	readonly selectedElement: () => PptxElement | null;
	readonly activeSlideIndex: () => number;
	readonly emitPropertiesChange: (patch: Partial<PptxCoreProperties>) => void;
}

@Injectable()
export class ViewerDocumentPropertiesService {
	private readonly editor = inject(EditorStateService);
	private readonly loader = inject(LoadContentService);

	/** Document-properties (Info) dialog visibility. */
	readonly showProperties = signal(false);
	/** Hyperlink-edit dialog visibility. */
	readonly showHyperlink = signal(false);
	/** Local overrides applied to document properties via the Info dialog. */
	private readonly coreOverride = signal<Partial<PptxCoreProperties>>({});
	/** Document core properties (loaded, with any in-session edits merged in). */
	readonly coreProperties = computed<PptxCoreProperties>(() => ({
		...(this.loader.coreProperties() ?? {}),
		...this.coreOverride(),
	}));

	private host: DocumentPropertiesHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: DocumentPropertiesHost): void {
		this.host = host;
	}

	private requireHost(): DocumentPropertiesHost {
		if (!this.host) {
			throw new Error('ViewerDocumentPropertiesService.bind() was not called');
		}
		return this.host;
	}

	/**
	 * Persist a document-properties edit from the Info dialog. Gated on
	 * `canEdit`: viewers may inspect properties but not mutate them (mirrors the
	 * comments / hyperlink edit paths).
	 */
	onPropertiesSave(patch: Partial<PptxCoreProperties>): void {
		const host = this.requireHost();
		if (!host.canEdit()) {
			this.showProperties.set(false);
			return;
		}
		this.coreOverride.update((current) => ({ ...current, ...patch }));
		host.emitPropertiesChange(patch);
		this.showProperties.set(false);
	}

	/** Apply a hyperlink edit to the selected element (one history entry). */
	onHyperlinkSave(patch: Partial<PptxElement>): void {
		const host = this.requireHost();
		const el = host.selectedElement();
		if (el) {
			this.editor.updateElement(host.activeSlideIndex(), el.id, patch);
		}
		this.showHyperlink.set(false);
	}
}
