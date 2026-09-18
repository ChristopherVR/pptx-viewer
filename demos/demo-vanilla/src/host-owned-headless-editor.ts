import {
	buildInlineTextCommitPatch,
	canInlineEditElement,
	canInteractWithElement,
	createCollaborationShell,
	createDefaultRegistry,
	createInitialViewerState,
	createStore,
	describeCollaborationShellState,
	getViewerCss,
	loadPresentation,
	openInlineEditor,
	renderSlideStage,
	revokeBlobUrls,
} from 'pptx-vanilla-viewer';
import type { InlineEditorSession, LoadedPresentation, PptxElement } from 'pptx-vanilla-viewer';

import type { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedShellHandle } from '../../shared/host-owned-shell-controls';
import { t } from './demo-i18n';

/** Custom chrome with native rendering/inline editing and host-owned selection/drag. */
export function mountHostOwnedHeadlessEditor(
	root: HTMLElement,
	host: Awaited<ReturnType<typeof createHostOwnedDemo>>,
): HostOwnedShellHandle & { destroy(): void } {
	const store = createStore({ ...createInitialViewerState(), loading: true });
	const registry = createDefaultRegistry();
	const style = document.createElement('style');
	style.textContent = getViewerCss();
	const shellRoot = document.createElement('section');
	shellRoot.className = 'pptxv';
	shellRoot.dataset.hostCustomShell = '';
	shellRoot.style.cssText = 'height:100%;overflow:auto;background:#e2e8f0;padding:24px';
	// Same localised readout and label as the other four custom-shell demos;
	// the e2e readiness wait (`waitForHostEditing`) reads it before editing.
	const status = document.createElement('output');
	status.setAttribute('aria-label', t('pptx.collaboration.shellStatusLabel'));
	const viewport = document.createElement('div');
	viewport.dataset.pptxViewport = '';
	viewport.style.cssText = 'position:relative;margin:24px auto';
	const stageRoot = document.createElement('div');
	const editorRoot = document.createElement('div');
	editorRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none';
	viewport.append(stageRoot, editorRoot);
	shellRoot.append(status, viewport);
	root.replaceChildren(style, shellRoot);
	let loaded: LoadedPresentation | undefined;
	let scale = 1;
	let destroyed = false;
	let inline: InlineEditorSession | undefined;
	let editingId: string | undefined;
	let drag: { element: PptxElement; x: number; y: number } | undefined;
	const collaboration = createCollaborationShell({
		document,
		store,
		getCanEdit: () => host.editable,
		getHandler: () => loaded?.handler ?? null,
		getSourcePending: () => store.get().loading,
		getScale: () => scale,
		// Connection and presence changes update the readout without a stage
		// re-render (render() only runs on slide/canvas/editable changes).
		onStateChange: (state) => {
			status.textContent = describeCollaborationShellState(state, t);
		},
	});
	viewport.append(collaboration.cursorOverlay.el, collaboration.selectionOverlay.el);
	const commitInline = (): void => {
		const current = inline;
		inline = undefined;
		current?.commit();
	};
	const patchElement = (element: PptxElement, patch: Partial<PptxElement>): void => {
		const state = store.get();
		store.set({
			slides: state.slides.map((slide, index) =>
				index === state.currentSlide
					? {
							...slide,
							elements: slide.elements.map((item) =>
								item.id === element.id ? ({ ...item, ...patch } as PptxElement) : item,
							),
						}
					: slide,
			),
		});
	};
	const render = (): void => {
		const state = store.get();
		if (!state.editable) {
			drag = undefined;
			commitInline();
		}
		status.textContent = describeCollaborationShellState(collaboration.getState(), t);
		const slide = store.get().slides[state.currentSlide];
		if (!slide) {
			return;
		}
		viewport.style.width = `${state.canvasSize.width * scale}px`;
		viewport.style.height = `${state.canvasSize.height * scale}px`;
		stageRoot.replaceChildren(
			renderSlideStage({
				document,
				slide,
				canvasSize: state.canvasSize,
				registry,
				t,
				scale,
				mediaDataUrls: loaded?.mediaDataUrls ?? new Map(),
				colorScheme: loaded?.colorScheme,
				fontScheme: loaded?.fontScheme,
				tableStyleMap: loaded?.tableStyleMap,
				interactive: true,
			}),
		);
		for (const node of stageRoot.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (node.dataset.elementId === editingId) {
				node.style.visibility = 'hidden';
			}
		}
	};
	const unsubscribe = store.subscribe((state, previous) => {
		// Presence updates redraw their own overlays, never replace active stage nodes.
		if (
			state.slides !== previous.slides ||
			state.currentSlide !== previous.currentSlide ||
			state.canvasSize !== previous.canvasSize ||
			state.editable !== previous.editable
		) {
			render();
		}
	});
	const elementAt = (target: EventTarget | null): PptxElement | undefined => {
		const id =
			target instanceof Element
				? target.closest<HTMLElement>('[data-element-id]')?.dataset.elementId
				: undefined;
		const state = store.get();
		return state.slides[state.currentSlide]?.elements.find((element) => element.id === id);
	};
	stageRoot.onpointerdown = (event) => {
		if (!store.get().editable || event.button !== 0) {
			return;
		}
		const element = elementAt(event.target);
		commitInline();
		if (!element || !canInteractWithElement(element, 'select')) {
			return;
		}
		store.set({ selectedElementId: element.id });
		if (canInteractWithElement(element, 'move')) {
			drag = { element, x: event.clientX, y: event.clientY };
		}
	};
	const onPointerMove = (event: PointerEvent): void => {
		const bounds = viewport.getBoundingClientRect();
		collaboration.controller.setCursor(
			(event.clientX - bounds.left) / scale,
			(event.clientY - bounds.top) / scale,
		);
		if (drag && store.get().editable) {
			patchElement(drag.element, {
				x: drag.element.x + (event.clientX - drag.x) / scale,
				y: drag.element.y + (event.clientY - drag.y) / scale,
			});
		}
	};
	const onPointerUp = (): void => {
		drag = undefined;
	};
	document.addEventListener('pointermove', onPointerMove);
	document.addEventListener('pointerup', onPointerUp);
	stageRoot.ondblclick = (event) => {
		const element = elementAt(event.target);
		if (!store.get().editable || !element || !canInlineEditElement(element)) {
			return;
		}
		commitInline();
		editingId = element.id;
		inline = openInlineEditor({
			doc: document,
			overlayRoot: editorRoot,
			element,
			scale,
			box: { ...element, rotation: element.rotation ?? 0 },
			onInput(text, snapshot) {
				if (!store.get().editable) {
					return;
				}
				const patch = buildInlineTextCommitPatch(element, text, snapshot);
				collaboration.controller.livePatcher.patchText(
					store.get().slides[store.get().currentSlide]?.id,
					element.id,
					text,
					{
						textSegments: patch && 'textSegments' in patch ? patch.textSegments : undefined,
						textStyle: 'textStyle' in element ? element.textStyle : undefined,
					},
				);
			},
			onCommit(text, snapshot) {
				const patch = buildInlineTextCommitPatch(element, text, snapshot);
				if (patch) {
					patchElement(element, patch);
				}
			},
			onClose() {
				inline = undefined;
				editingId = undefined;
				render();
			},
		});
		inline.el.style.pointerEvents = 'auto';
		render();
	};
	const ready = (async () => {
		await collaboration.setConfig(host.config);
		if (destroyed) {
			return;
		}
		collaboration.controller.beginContentLoad('bootstrap');
		const result = await loadPresentation(host.source.slice().buffer);
		if (destroyed) {
			result.handler.dispose();
			revokeBlobUrls(result.blobUrls);
			return;
		}
		loaded = result;
		store.set({ slides: result.slides, canvasSize: result.canvasSize, loading: false });
		collaboration.controller.notifyContentLoaded('bootstrap');
	})().catch((error: unknown) => {
		if (!destroyed) {
			store.set({ loading: false, error: String(error) });
		}
	});
	return {
		async getContent() {
			await ready;
			if (destroyed) {
				return;
			}
			commitInline();
			return loaded?.handler.save(store.get().slides);
		},
		setScale(value) {
			commitInline();
			scale = value;
			collaboration.refresh();
			render();
		},
		destroy() {
			if (destroyed) {
				return;
			}
			commitInline();
			destroyed = true;
			unsubscribe();
			collaboration.destroy();
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerUp);
			loaded?.handler.dispose();
			if (loaded) {
				revokeBlobUrls(loaded.blobUrls);
			}
			root.replaceChildren();
		},
	};
}
