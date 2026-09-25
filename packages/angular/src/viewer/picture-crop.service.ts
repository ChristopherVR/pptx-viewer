/**
 * picture-crop.service.ts: the Angular binding's on-canvas picture crop mode.
 *
 * Every decision (who may crop, what a handle drag does, what Enter / Escape
 * mean, whether a session changed anything) comes from the shared
 * `render/picture-crop` module. This service only owns the session signal and
 * maps the shared lifecycle onto {@link EditorStateService}'s history:
 *
 * - Live handle / pan drags write through `applyTransform`, which records no
 *   history, so the renderer shows the new `a:srcRect` as it changes.
 * - Commit (Enter, a press outside the overlay, a selection or slide change,
 *   the Crop button again) puts the pre-crop snapshot back silently, then
 *   writes the final crop through `updateElement`, whose single history entry
 *   therefore undoes to exactly the pre-crop state.
 * - Cancel (Escape) writes the snapshot back and leaves no history at all.
 *
 * Provided per viewer (see `POWER_POINT_VIEWER_PROVIDERS`).
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	cancelCropUpdate,
	cropFrameOf,
	cropModeKeyAction,
	cropSessionChanged,
	isEditorTextInputTarget,
	readCropInsets,
	startCropSession,
} from '../internal/shared';
import type { CropElementUpdate, CropSession } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

/** A live crop session and the slide its picture sits on. */
export interface PictureCropState {
	slideIndex: number;
	session: CropSession;
}

@Injectable()
export class PictureCropService {
	private readonly editor = inject(EditorStateService);

	/** The live session, or null outside crop mode. */
	readonly state = signal<PictureCropState | null>(null);
	/** Id of the picture in crop mode, or null. */
	readonly activeElementId = computed(() => this.state()?.session.elementId ?? null);

	/** Whether `id` is the picture currently in crop mode. */
	isCropping(id: string | null | undefined): boolean {
		return id !== null && id !== undefined && this.activeElementId() === id;
	}

	/**
	 * Enter crop mode on `element` (a croppable picture) on slide `slideIndex`.
	 * A session on another picture is committed first. Returns whether crop
	 * mode is now active on `element`.
	 */
	enter(slideIndex: number, element: PptxElement | null | undefined): boolean {
		if (!element) {
			return false;
		}
		if (this.isCropping(element.id)) {
			return true;
		}
		this.commit();
		const session = startCropSession(element);
		if (!session) {
			return false;
		}
		this.editor.select([element.id]);
		this.state.set({ slideIndex, session });
		return true;
	}

	/** The ribbon Crop button: enter, or commit when already cropping. */
	toggle(slideIndex: number, element: PptxElement | null | undefined): void {
		if (this.state()) {
			this.commit();
			return;
		}
		this.enter(slideIndex, element);
	}

	/** Apply a live handle / pan update WITHOUT recording history. */
	applyLive(update: CropElementUpdate): void {
		const state = this.state();
		if (state) {
			this.editor.applyTransform(state.slideIndex, state.session.elementId, update);
		}
	}

	/** End the session, leaving one undo step when the crop changed anything. */
	commit(): void {
		const state = this.state();
		if (!state) {
			return;
		}
		this.state.set(null);
		const element = this.elementOf(state);
		if (!element || !cropSessionChanged(state.session, element)) {
			return;
		}
		const final: CropElementUpdate = { ...cropFrameOf(element), ...readCropInsets(element) };
		const { slideIndex, session } = state;
		// Silently rewind to the snapshot, then commit the final crop as ONE
		// history entry whose undo lands on the pre-crop picture.
		this.editor.applyTransform(slideIndex, session.elementId, cancelCropUpdate(session));
		this.editor.updateElement(slideIndex, session.elementId, final as Partial<PptxElement>);
	}

	/** Commit, but only while `session` is still the live one. */
	commitSession(session: CropSession | null | undefined): void {
		if (session && this.state()?.session === session) {
			this.commit();
		}
	}

	/** Escape: restore the snapshot and leave no history. */
	cancel(): void {
		const state = this.state();
		if (!state) {
			return;
		}
		this.state.set(null);
		if (this.elementOf(state)) {
			this.editor.applyTransform(
				state.slideIndex,
				state.session.elementId,
				cancelCropUpdate(state.session),
			);
		}
	}

	/**
	 * Crop mode's own keys (Enter commits, Escape cancels). Returns true when
	 * the key was consumed, so the caller skips its normal handling for it
	 * (an Escape that cancels a crop must not also deselect or close chrome).
	 */
	handleKeyDown(event: KeyboardEvent): boolean {
		if (!this.state() || isEditorTextInputTarget(event.target)) {
			return false;
		}
		const action = cropModeKeyAction(event.key);
		if (action === null) {
			return false;
		}
		event.preventDefault();
		event.stopPropagation();
		if (action === 'commit') {
			this.commit();
		} else {
			this.cancel();
		}
		return true;
	}

	private elementOf(state: PictureCropState): PptxElement | undefined {
		const slide = this.editor.slides()[state.slideIndex];
		const id = state.session.elementId;
		return (
			slide?.elements.find((el) => el.id === id) ??
			(slide
				? this.editor.templateElementsBySlideId()[slide.id]?.find((el) => el.id === id)
				: undefined)
		);
	}
}
