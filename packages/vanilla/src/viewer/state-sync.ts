import type { RenderController } from './render-controller';
import type { StoreListener, ViewerState } from './state';
import type { PptxViewerCallbacks } from './types';
import type { ViewerChrome } from './ui';

export interface StateSyncDeps {
	getChrome(): ViewerChrome;
	renderer: RenderController;
	callbacks: PptxViewerCallbacks;
}

/**
 * Build the store listener that turns {@link ViewerState} transitions into
 * chrome updates, stage re-renders, and host callbacks. Extracted from
 * {@link PptxViewer} to keep the class focused on its public API.
 */
export function createStateSync(deps: StateSyncDeps): StoreListener<ViewerState> {
	const { renderer, callbacks } = deps;
	return (state, previous) => {
		const chrome = deps.getChrome();
		if (state.loading !== previous.loading) {
			chrome.setLoading(state.loading);
		}
		if (state.error !== previous.error) {
			chrome.setError(state.error);
		}
		if (state.presenting !== previous.presenting) {
			chrome.setPresenting(state.presenting);
			callbacks.onPresentationChange?.(state.presenting);
		}
		// Thumbnails are skipped while a drag/resize gesture streams slide
		// patches; one refresh happens when the gesture ends.
		if (
			((state.slides !== previous.slides ||
				state.templateElementsBySlideId !== previous.templateElementsBySlideId ||
				state.slideMasters !== previous.slideMasters ||
				state.notesMaster !== previous.notesMaster ||
				state.handoutMaster !== previous.handoutMaster ||
				state.masterViewTarget !== previous.masterViewTarget ||
				state.masterViewTab !== previous.masterViewTab ||
				state.handoutSlidesPerPage !== previous.handoutSlidesPerPage) &&
				!state.interactionActive) ||
			(previous.interactionActive && !state.interactionActive)
		) {
			renderer.renderThumbnails();
		}
		if (
			state.slides !== previous.slides ||
			state.templateElementsBySlideId !== previous.templateElementsBySlideId ||
			state.currentSlide !== previous.currentSlide ||
			state.zoom !== previous.zoom ||
			state.presenting !== previous.presenting ||
			state.editTemplateMode !== previous.editTemplateMode ||
			state.slideMasters !== previous.slideMasters ||
			state.notesMaster !== previous.notesMaster ||
			state.handoutMaster !== previous.handoutMaster ||
			state.masterViewTarget !== previous.masterViewTarget ||
			state.masterViewTab !== previous.masterViewTab ||
			state.handoutSlidesPerPage !== previous.handoutSlidesPerPage
		) {
			renderer.renderStage();
		}
		if (state.currentSlide !== previous.currentSlide) {
			chrome.thumbnails?.setActive(state.currentSlide);
			callbacks.onSlideChange?.(state.currentSlide);
		}
		if (
			state.slides !== previous.slides ||
			state.currentSlide !== previous.currentSlide ||
			state.zoom !== previous.zoom
		) {
			chrome.statusBar?.update({
				current: state.currentSlide,
				total: state.slides.length,
				zoomPercent: renderer.effectiveScale() * 100,
			});
			chrome.presentationTouchControls.update(state.currentSlide, state.slides.length);
			chrome.mobileActionSheets?.update(
				state.currentSlide,
				state.slides,
				state.slides[state.currentSlide]?.comments ?? [],
			);
		}
		if (state.zoom !== previous.zoom) {
			callbacks.onZoomChange?.(renderer.effectiveScale());
		}
		if (state.selectedElementId !== previous.selectedElementId) {
			callbacks.onSelectionChange?.(state.selectedElementId);
		}
		if (state.dirty !== previous.dirty) {
			chrome.statusBar?.setDirty(state.dirty);
			chrome.titleBar?.setDirty(state.dirty);
			callbacks.onDirtyChange?.(state.dirty);
		}
		if (state.editable !== previous.editable) {
			chrome.notes.update({ slide: state.slides[state.currentSlide], editable: state.editable });
			chrome.mobileActionSheets?.setEditable(state.editable);
		}
		if (state.notesExpanded !== previous.notesExpanded) {
			chrome.notes.setExpanded(state.notesExpanded);
			chrome.ribbon?.setNotesExpanded(state.notesExpanded);
			chrome.statusBar?.setNotesExpanded(state.notesExpanded);
			chrome.mobileActionSheets?.setNotesExpanded(state.notesExpanded);
		}
		if (state.editTemplateMode !== previous.editTemplateMode) {
			chrome.ribbon?.setTemplateEditing(state.editTemplateMode);
		}
		if (state.hasMacros !== previous.hasMacros) {
			chrome.ribbon?.setHasMacros(state.hasMacros);
		}
	};
}
