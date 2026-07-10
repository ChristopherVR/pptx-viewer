import type { PptxHandler } from 'pptx-viewer-core';
import { EncryptedFileError } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';

import type { Translator } from './i18n';
import { createTranslator } from './i18n';
import type { PptxViewerSource } from './load';
import { loadPresentation, resolveSourceToBuffer, revokeBlobUrls } from './load';
import type { ElementRendererRegistry } from './render';
import { createDefaultRegistry } from './render';
import type { RenderController } from './render-controller';
import { createRenderController } from './render-controller';
import type { Store, ViewerState, ZoomLevel } from './state';
import { clampSlideIndex, createInitialViewerState, createStore } from './state';
import { createStateSync } from './state-sync';
import { ensureViewerStyles } from './styles';
import { applyThemeVars } from './theme-apply';
import type { PptxViewerInstance, PptxViewerOptions } from './types';
import type { PresentationController, ViewerChrome } from './ui';
import { attachKeyboardNavigation, buildViewerChrome, createPresentationController } from './ui';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

/**
 * The zero-framework PowerPoint viewer. Construct via {@link createPptxViewer}
 * (or `new PptxViewer(container, options)`): builds its chrome inside
 * `container`, loads `options.source` when given, and re-renders through a
 * tiny reactive store. All parsing lives in `pptx-viewer-core`; all pure
 * render logic in `pptx-viewer-shared`.
 */
export class PptxViewer implements PptxViewerInstance {
	private readonly container: HTMLElement;
	private readonly doc: Document;
	private readonly options: PptxViewerOptions;
	private readonly store: Store<ViewerState>;
	private readonly registry: ElementRendererRegistry;
	private readonly renderer: RenderController;
	private t: Translator;
	private chrome!: ViewerChrome;
	private presentation!: PresentationController;
	private detachKeyboard: () => void = () => {};
	private resizeObserver: ResizeObserver | null = null;
	private handler: PptxHandler | null = null;
	private blobUrls: string[] = [];
	private appliedThemeVars: string[] = [];
	private loadToken = 0;
	private destroyed = false;

	constructor(container: HTMLElement, options: PptxViewerOptions = {}) {
		this.container = container;
		this.doc = container.ownerDocument;
		this.options = options;
		this.t = createTranslator(options.locale ?? 'en', options.messages);
		this.registry = options.registry ?? createDefaultRegistry();
		this.store = createStore(createInitialViewerState());
		this.renderer = createRenderController({
			doc: this.doc,
			store: this.store,
			registry: this.registry,
			getChrome: () => this.chrome,
			getTranslator: () => this.t,
		});

		ensureViewerStyles(this.doc);
		this.mountChrome();
		this.store.subscribe(
			createStateSync({
				getChrome: () => this.chrome,
				renderer: this.renderer,
				callbacks: options,
			}),
		);
		this.renderer.renderAll();

		if (options.source !== undefined) {
			void this.load(options.source);
		}
	}

	// ── Loading ────────────────────────────────────────────────────────────

	async loadFile(file: Blob | ArrayBuffer | Uint8Array): Promise<void> {
		await this.load(file);
	}

	async loadUrl(url: string): Promise<void> {
		await this.load(url);
	}

	private async load(source: PptxViewerSource): Promise<void> {
		const token = ++this.loadToken;
		this.store.set({ loading: true, error: null });
		try {
			const buffer = await resolveSourceToBuffer(source);
			const loaded = await loadPresentation(buffer);
			if (token !== this.loadToken) {
				revokeBlobUrls(loaded.blobUrls);
				loaded.handler.dispose();
				return;
			}
			this.releaseLoaded();
			this.handler = loaded.handler;
			this.blobUrls = loaded.blobUrls;
			this.store.set({
				slides: loaded.slides,
				canvasSize: loaded.canvasSize,
				mediaDataUrls: loaded.mediaDataUrls,
				currentSlide: clampSlideIndex(this.options.initialSlide ?? 0, loaded.slides.length),
				loading: false,
			});
			this.options.onLoad?.({ slideCount: loaded.slides.length, canvasSize: loaded.canvasSize });
		} catch (error) {
			if (token !== this.loadToken) {
				return;
			}
			const message =
				error instanceof EncryptedFileError
					? this.t('pptx.security.currentlyProtected')
					: error instanceof Error
						? error.message
						: String(error);
			this.store.set({ loading: false, error: message });
			this.options.onError?.(message, error);
		}
	}

	/** Dispose the previous handler + Blob URLs (before replacing or on destroy). */
	private releaseLoaded(): void {
		revokeBlobUrls(this.blobUrls);
		revokeBlobUrls(this.store.get().mediaDataUrls.values());
		this.blobUrls = [];
		this.handler?.dispose();
		this.handler = null;
	}

	// ── Navigation / zoom ──────────────────────────────────────────────────

	next(): void {
		this.goToSlide(this.store.get().currentSlide + 1);
	}

	prev(): void {
		this.goToSlide(this.store.get().currentSlide - 1);
	}

	goToSlide(index: number): void {
		this.store.set({ currentSlide: clampSlideIndex(index, this.store.get().slides.length) });
	}

	getSlideCount(): number {
		return this.store.get().slides.length;
	}

	getCurrentSlide(): number {
		return this.store.get().currentSlide;
	}

	getZoom(): number {
		return this.renderer.effectiveScale();
	}

	setZoom(zoom: ZoomLevel): void {
		this.store.set({
			zoom: zoom === 'fit' ? 'fit' : Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
		});
	}

	zoomIn(): void {
		this.setZoom(this.renderer.effectiveScale() * ZOOM_STEP);
	}

	zoomOut(): void {
		this.setZoom(this.renderer.effectiveScale() / ZOOM_STEP);
	}

	zoomToFit(): void {
		this.setZoom('fit');
	}

	// ── Theme / locale ─────────────────────────────────────────────────────

	setTheme(theme: ViewerTheme | undefined): void {
		this.appliedThemeVars = applyThemeVars(this.chrome.root, theme, this.appliedThemeVars);
	}

	setLocale(locale: string): void {
		this.t = createTranslator(locale, this.options.messages);
		// Chrome labels are baked at build time; rebuild it under the new locale.
		this.unmountChrome();
		this.mountChrome();
		this.renderer.renderAll();
	}

	// ── Presentation mode ──────────────────────────────────────────────────

	async enterPresentation(): Promise<void> {
		await this.presentation.enter();
	}

	async exitPresentation(): Promise<void> {
		await this.presentation.exit();
	}

	// ── Escape hatches / teardown ──────────────────────────────────────────

	getRegistry(): ElementRendererRegistry {
		return this.registry;
	}

	getHandler(): PptxHandler | null {
		return this.handler;
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.loadToken++;
		this.unmountChrome();
		this.releaseLoaded();
	}

	// ── Chrome lifecycle ───────────────────────────────────────────────────

	private mountChrome(): void {
		this.chrome = buildViewerChrome(this.doc, this.t, {
			showToolbar: this.options.showToolbar ?? true,
			showThumbnails: this.options.showThumbnails ?? true,
			toolbarHandlers: {
				prev: () => this.prev(),
				next: () => this.next(),
				zoomIn: () => this.zoomIn(),
				zoomOut: () => this.zoomOut(),
				zoomToFit: () => this.zoomToFit(),
				togglePresentation: () => {
					void (this.presentation.isActive() ? this.exitPresentation() : this.enterPresentation());
				},
			},
			onSelectSlide: (index) => this.goToSlide(index),
		});
		this.appliedThemeVars = applyThemeVars(this.chrome.root, this.options.theme, []);
		this.container.appendChild(this.chrome.root);

		this.detachKeyboard = attachKeyboardNavigation(this.chrome.root, {
			next: () => this.next(),
			prev: () => this.prev(),
			first: () => this.goToSlide(0),
			last: () => this.goToSlide(this.getSlideCount() - 1),
			escape: () => void this.exitPresentation(),
		});
		this.presentation = createPresentationController(this.chrome.root, (presenting) => {
			this.store.set({ presenting });
		});
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => {
				if (this.store.get().zoom === 'fit') {
					this.renderer.renderStage();
				}
			});
			this.resizeObserver.observe(this.chrome.viewport);
		}
	}

	private unmountChrome(): void {
		this.detachKeyboard();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.presentation.dispose();
		this.chrome.root.remove();
	}
}

/**
 * Create a PowerPoint viewer inside `container`.
 *
 * ```ts
 * import { createPptxViewer } from 'pptx-vanilla-viewer';
 * const viewer = createPptxViewer(document.querySelector('#host')!, {
 * 	source: '/deck.pptx',
 * 	onSlideChange: (i) => console.log('slide', i + 1),
 * });
 * ```
 */
export function createPptxViewer(
	container: HTMLElement,
	options: PptxViewerOptions = {},
): PptxViewerInstance {
	return new PptxViewer(container, options);
}
