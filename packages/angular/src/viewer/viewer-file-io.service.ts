/**
 * viewer-file-io.service.ts: Viewer-scoped state + logic for getting `.pptx`
 * bytes in and out of the viewer: the built-in File ▸ Open override signal (a
 * native-picker-loaded deck swapped in place ahead of the host `content`
 * input), serialising the current deck to bytes, triggering a browser
 * download, and resolving the loaded source bytes for collaboration's
 * elected-writer write-back.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component keeps the
 * public {@link PowerPointViewerComponent.getContent} imperative-handle method
 * (documented host API, so it cannot move off the component) as a thin
 * delegate to {@link getContent} here. The component binds the few accessors
 * it alone owns (canEdit / host `content` input / onOpenFile override / editor
 * slides + template elements / the `contentChange` emitter) via {@link bind}.
 *
 * Provide it once on the viewer component (`providers: [ViewerFileIOService]`).
 */

import { inject, Injectable, signal } from '@angular/core';
import type { PptxSaveFormat, PptxSlide } from 'pptx-viewer-core';

import { downloadBlob, openPptxFile } from '../internal/shared';
import { ExportService } from './export.service';
import { LoadContentService } from './load-content.service';
import { buildSharingPackage } from './package-sharing';
import { buildSaveSlides } from './template-mode';
import type { TemplateElementsBySlideId } from './template-mode';

/** Live host accessors the file-IO controller needs. */
interface FileIOHost {
	readonly canEdit: () => boolean;
	readonly content: () => Uint8Array | ArrayBuffer | null;
	readonly onOpenFile: () => (() => void) | undefined;
	readonly slides: () => readonly PptxSlide[];
	readonly templateElementsBySlideId: () => TemplateElementsBySlideId;
	readonly emitContentChange: (bytes: Uint8Array) => void;
}

@Injectable()
export class ViewerFileIOService {
	private readonly loader = inject(LoadContentService);
	private readonly exportSvc = inject(ExportService);

	/**
	 * Built-in File ▸ Open override of the host `content` input. The native
	 * picker sets this to swap the deck in place; a fresh `content` input clears
	 * it so external reloads always win.
	 */
	readonly contentOverride = signal<Uint8Array | ArrayBuffer | null>(null);

	private host: FileIOHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: FileIOHost): void {
		this.host = host;
	}

	private requireHost(): FileIOHost {
		if (!this.host) {
			throw new Error('ViewerFileIOService.bind() was not called');
		}
		return this.host;
	}

	/** The currently active content: a picked-file override, else the host `content` input. */
	activeContent(): Uint8Array | ArrayBuffer | null {
		return this.contentOverride() ?? this.requireHost().content();
	}

	/** The loaded source `.pptx` bytes (for elected-writer write-back), if any. */
	sourceBytes(): Uint8Array | null {
		const content = this.activeContent();
		if (!content) {
			return null;
		}
		return content instanceof Uint8Array ? content : new Uint8Array(content);
	}

	/**
	 * Serialise the current presentation to `.pptx` bytes. When editing, this
	 * serialises the editor's edited deck so changes persist.
	 */
	async getContent(): Promise<Uint8Array> {
		const host = this.requireHost();
		const data = host.canEdit()
			? await this.loader.saveSlides(
					buildSaveSlides(host.slides(), host.templateElementsBySlideId()),
				)
			: await this.loader.getContent();
		// Mirror React's imperative handle: serialising the deck also notifies the
		// host so listeners wired to (contentChange) receive the latest bytes.
		host.emitContentChange(data);
		return data;
	}

	/**
	 * Serialise the current deck and trigger a browser download of the `.pptx`.
	 * Surfaced on the mobile toolbar so saving is reachable without the desktop
	 * ribbon's File tab.
	 */
	async saveAs(format: PptxSaveFormat): Promise<void> {
		const host = this.requireHost();
		const slides = buildSaveSlides(host.slides(), host.templateElementsBySlideId());
		const bytes = host.canEdit()
			? await this.loader.saveSlides(slides, format)
			: await this.loader.saveSlides(this.loader.slides(), format);
		host.emitContentChange(bytes);
		this.exportSvc.savePresentation(bytes, `presentation.${format}`, format);
	}

	async saveAsPptx(): Promise<void> {
		await this.saveAs('pptx');
	}

	async saveAsPpsx(): Promise<void> {
		await this.saveAs('ppsx');
	}

	async saveAsPptm(): Promise<void> {
		await this.saveAs('pptm');
	}

	/** Bundle the presentation and its usage notes in a shareable ZIP archive. */
	async packageForSharing(): Promise<void> {
		const presentationFilename = 'presentation.pptx';
		const blob = await buildSharingPackage(await this.getContent(), presentationFilename);
		downloadBlob(blob, 'presentation-package.zip');
	}

	/**
	 * File ▸ Open: host override (`onOpenFile` input) takes precedence; otherwise
	 * a built-in native picker loads the chosen presentation in place.
	 */
	openFile(): void {
		const host = this.requireHost();
		const override = host.onOpenFile();
		if (override) {
			override();
			return;
		}
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				this.contentOverride.set(new Uint8Array(picked.buffer));
			}
		})();
	}
}
