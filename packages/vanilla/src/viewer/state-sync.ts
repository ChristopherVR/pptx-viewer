import { getActiveElements } from './editor/editor-active-elements';
import type { RenderController } from './render-controller';
import { selectionChangeNeedsStageRender } from './selection-render-trigger';
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
			chrome.statusBar?.setPresenting(state.presenting);
			callbacks.onPresentationChange?.(state.presenting);
		}
		// Thumbnails are skipped while a drag/resize gesture streams slide
		// patches; one refresh happens when the gesture ends.
		if (
			((state.slides !== previous.slides ||
				state.sections !== previous.sections ||
				state.canvasSize !== previous.canvasSize ||
				state.templateElementsBySlideId !== previous.templateElementsBySlideId ||
				state.slideMasters !== previous.slideMasters ||
				state.notesMaster !== previous.notesMaster ||
				state.handoutMaster !== previous.handoutMaster ||
				state.masterViewTarget !== previous.masterViewTarget ||
				state.masterViewTab !== previous.masterViewTab ||
				state.handoutSlidesPerPage !== previous.handoutSlidesPerPage ||
				// The Header & Footer dialog and the document-property editors feed
				// the FIELD-SUBSTITUTION context, not the slide model, so nothing in
				// `slides` changes when the user sets a footer. Without these two the
				// canvas kept painting the string it was loaded with until some other
				// edit happened to force a repaint.
				state.headerFooter !== previous.headerFooter ||
				state.customProperties !== previous.customProperties ||
				// A table style DEFINITION edit ("Edit style...") repaints every
				// table using that style; without this the map changed under the
				// renderer's feet but nothing scheduled the next paint (unlike the
				// other four bindings' reactive frameworks, this store's listener
				// IS the reactivity: a change unlisted here simply never repaints).
				state.tableStyleMap !== previous.tableStyleMap) &&
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
			state.canvasSize !== previous.canvasSize ||
			state.presenting !== previous.presenting ||
			state.editTemplateMode !== previous.editTemplateMode ||
			state.slideMasters !== previous.slideMasters ||
			state.notesMaster !== previous.notesMaster ||
			state.handoutMaster !== previous.handoutMaster ||
			state.masterViewTarget !== previous.masterViewTarget ||
			state.masterViewTab !== previous.masterViewTab ||
			state.handoutSlidesPerPage !== previous.handoutSlidesPerPage ||
			state.headerFooter !== previous.headerFooter ||
			state.customProperties !== previous.customProperties ||
			state.tableStyleMap !== previous.tableStyleMap ||
			// A chart arms its on-canvas mark hit-testing only while selected (B3),
			// so a chart entering/leaving the selection re-renders the stage to
			// re-arm it. Only a chart: rebuilding on every selection change would
			// replace the node under the pointer between the two clicks of a
			// double-click (see `selection-render-trigger.ts`).
			selectionChangeNeedsStageRender(
				previous.selectedElementIds,
				state.selectedElementIds,
				getActiveElements(state),
			)
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
				zoomPercent: renderer.zoomPercent(),
			});
			chrome.presentationTouchControls.update(state.currentSlide, state.slides.length);
			chrome.presentationToolbar.update({
				current: state.currentSlide,
				total: state.slides.length,
			});
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
			chrome.root.classList.toggle('pptxv-editable', state.editable);
			chrome.notes.update({
				slide: state.slides[state.currentSlide],
				editable: state.editable,
				notesStyle: state.notesMaster?.notesStyle,
			});
			chrome.mobileActionSheets?.setEditable(state.editable);
		}
		if (state.protectedView !== previous.protectedView) {
			chrome.setProtectedView(state.protectedView);
		}
		if (
			state.readOnlyRecommendation !== previous.readOnlyRecommendation ||
			state.readOnlyBannerDismissed !== previous.readOnlyBannerDismissed ||
			state.readOnlyPasswordPromptOpen !== previous.readOnlyPasswordPromptOpen ||
			state.readOnlyPasswordError !== previous.readOnlyPasswordError ||
			state.readOnlyCheckingPassword !== previous.readOnlyCheckingPassword
		) {
			chrome.setReadOnlyRecommendation(
				state.readOnlyRecommendation,
				state.readOnlyBannerDismissed,
				{
					promptOpen: state.readOnlyPasswordPromptOpen,
					error: state.readOnlyPasswordError,
					checking: state.readOnlyCheckingPassword,
				},
			);
		}
		if (state.compatToasts !== previous.compatToasts) {
			chrome.setCompatToasts(state.compatToasts);
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
		// The View tab's Show group is the only chrome that reflects these flags,
		// and toggling one re-renders nothing else, so it needs its own
		// comparison rather than riding on a stage or thumbnail refresh.
		if (
			state.showGrid !== previous.showGrid ||
			state.showRulers !== previous.showRulers ||
			state.showGuides !== previous.showGuides ||
			state.snapToGrid !== previous.snapToGrid ||
			state.snapToShape !== previous.snapToShape
		) {
			chrome.ribbon?.setViewOptions(state);
		}
		if (state.hasMacros !== previous.hasMacros) {
			chrome.ribbon?.setHasMacros(state.hasMacros);
		}
		if (
			state.presentationProperties.showSubtitles !== previous.presentationProperties.showSubtitles
		) {
			chrome.ribbon?.setSubtitlesVisible(Boolean(state.presentationProperties.showSubtitles));
		}
		// The Hide Slide toggle reflects the ACTIVE slide, so it has to re-sync on a
		// slide change as well as on an edit that flips the flag.
		if (
			state.currentSlide !== previous.currentSlide ||
			state.slides[state.currentSlide]?.hidden !== previous.slides[previous.currentSlide]?.hidden
		) {
			chrome.ribbon?.setHideSlideActive(Boolean(state.slides[state.currentSlide]?.hidden));
		}
	};
}
