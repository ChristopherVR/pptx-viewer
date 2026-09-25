/**
 * usePictureCrop: PowerPoint's on-canvas picture crop mode for the Vue editor.
 *
 * The lifecycle and every piece of geometry are shared
 * (`pptx-viewer-shared`'s picture-crop module); this composable is the Vue
 * wiring around them:
 *
 * - Enter from the ribbon Crop button or the picture context menu's Crop.
 * - Handle/pan drags write LIVE, history-free updates onto the picture so the
 *   normal renderer shows the new `a:srcRect` as it changes.
 * - Commit (Enter, a pointer-down outside the overlay, a selection or slide
 *   change, Crop again) leaves exactly ONE undo step: the picture is put back
 *   to the session's snapshot, history is recorded, then the final crop is
 *   written again. Nothing changed means no undo step at all.
 * - Cancel (Escape) writes the snapshot back and leaves no undo step, and the
 *   key press is swallowed so the editor's own Escape does not also run.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	cancelCropUpdate,
	canCropElement,
	cropFill,
	cropFit,
	cropFrameOf,
	cropModeKeyAction,
	cropSessionChanged,
	cropToAspectRatio,
	CROP_ASPECT_PRESETS,
	getImageSrc,
	readCropInsets,
	startCropSession,
} from 'pptx-viewer-shared';
import type { CropElementUpdate, CropRestoreUpdate, CropSession } from 'pptx-viewer-shared';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';

import type { PictureCropController } from './merge-crop-context';
import { readNaturalImageSize } from './merge-crop-context';

export interface UsePictureCropInput {
	canEdit: () => boolean;
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	selectedElementIds: Ref<string[]>;
	pushHistory: () => void;
	mediaDataUrls: Ref<Map<string, string>>;
}

interface ActiveCrop {
	slideId: string;
	session: CropSession;
}

function isEditableTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	return Boolean(
		el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'),
	);
}

export function usePictureCrop(input: UsePictureCropInput): PictureCropController {
	const { slides, activeSlideIndex, selectedElementIds } = input;
	const active = shallowRef<ActiveCrop | null>(null);

	const findOn = (slideId: string, id: string): PptxElement | undefined =>
		slides.value.find((s) => s.id === slideId)?.elements.find((el) => el.id === id);

	function patch(slideId: string, id: string, update: CropElementUpdate | CropRestoreUpdate): void {
		slides.value = slides.value.map((s) =>
			s.id === slideId
				? {
						...s,
						elements: s.elements.map((el) =>
							el.id === id ? ({ ...el, ...update } as PptxElement) : el,
						),
					}
				: s,
		);
	}

	/** The single selected, croppable picture on the active slide. */
	const selectedPicture = computed<PptxElement | null>(() => {
		const ids = selectedElementIds.value;
		const slide = slides.value[activeSlideIndex.value];
		if (ids.length !== 1 || !slide) {
			return null;
		}
		const el = slide.elements.find((e) => e.id === ids[0]);
		return el && canCropElement(el) ? el : null;
	});

	const canCrop = computed(() => input.canEdit() && selectedPicture.value !== null);
	const cropActive = computed(() => active.value !== null);
	const cropElement = computed<PptxElement | null>(() => {
		const a = active.value;
		return a ? (findOn(a.slideId, a.session.elementId) ?? null) : null;
	});
	const cropImageSrc = computed(() => {
		const el = cropElement.value;
		return el ? getImageSrc(el, input.mediaDataUrls.value) : undefined;
	});

	function commitCrop(): void {
		const a = active.value;
		if (!a) {
			return;
		}
		active.value = null;
		const el = findOn(a.slideId, a.session.elementId);
		if (!el || !cropSessionChanged(a.session, el)) {
			return;
		}
		const finalUpdate: CropElementUpdate = { ...cropFrameOf(el), ...readCropInsets(el) };
		patch(a.slideId, el.id, cancelCropUpdate(a.session));
		input.pushHistory();
		patch(a.slideId, el.id, finalUpdate);
	}

	function cancelCrop(): void {
		const a = active.value;
		if (!a) {
			return;
		}
		active.value = null;
		if (findOn(a.slideId, a.session.elementId)) {
			patch(a.slideId, a.session.elementId, cancelCropUpdate(a.session));
		}
	}

	function enterCrop(id?: string): void {
		if (!input.canEdit()) {
			return;
		}
		const slide = slides.value[activeSlideIndex.value];
		const el = id ? slide?.elements.find((e) => e.id === id) : selectedPicture.value;
		const session = startCropSession(el);
		if (!slide || !el || !session) {
			return;
		}
		if (active.value?.session.elementId === el.id) {
			return;
		}
		commitCrop();
		selectedElementIds.value = [el.id];
		active.value = { slideId: slide.id, session };
	}

	function toggleCrop(): void {
		if (active.value) {
			commitCrop();
		} else {
			enterCrop();
		}
	}

	function applyLive(update: CropElementUpdate): void {
		const a = active.value;
		if (a) {
			patch(a.slideId, a.session.elementId, update);
		}
	}

	/** Aspect/Fill/Fit: live inside a session, else one undoable update. */
	function applyOneClick(build: (el: PptxElement) => CropElementUpdate): void {
		const el = cropElement.value ?? (canCrop.value ? selectedPicture.value : null);
		const slide = slides.value[activeSlideIndex.value];
		if (!el || !slide) {
			return;
		}
		const update = build(el);
		if (active.value) {
			applyLive(update);
			return;
		}
		input.pushHistory();
		patch(slide.id, el.id, update);
	}

	function applyAspect(presetId: string): void {
		const preset = CROP_ASPECT_PRESETS.find((p) => p.id === presetId);
		if (preset) {
			applyOneClick((el) => cropToAspectRatio(el, preset.ratioWidth, preset.ratioHeight));
		}
	}
	const applyFill = (): void => applyOneClick((el) => cropFill(el, readNaturalImageSize(el.id)));
	const applyFit = (): void => applyOneClick((el) => cropFit(el, readNaturalImageSize(el.id)));

	// -- Commit triggers ---------------------------------------------------
	watch(selectedElementIds, (ids) => {
		const a = active.value;
		if (a && (ids.length !== 1 || ids[0] !== a.session.elementId)) {
			commitCrop();
		}
	});
	watch(activeSlideIndex, () => commitCrop());
	watch(
		() => input.canEdit(),
		(editable) => {
			if (!editable) {
				commitCrop();
			}
		},
	);

	function onKeyDown(event: KeyboardEvent): void {
		if (!active.value || isEditableTarget(event.target)) {
			return;
		}
		const action = cropModeKeyAction(event.key);
		if (!action) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (action === 'commit') {
			commitCrop();
		} else {
			cancelCrop();
		}
	}
	function onPointerDown(event: PointerEvent): void {
		const target = event.target as Element | null;
		if (target?.closest?.('[data-pptx-crop-overlay], [data-pptx-crop-keep]')) {
			return;
		}
		commitCrop();
	}
	function detach(): void {
		window.removeEventListener('keydown', onKeyDown, true);
		document.removeEventListener('pointerdown', onPointerDown, true);
	}
	watch(cropActive, (on) => {
		detach();
		if (on) {
			window.addEventListener('keydown', onKeyDown, true);
			document.addEventListener('pointerdown', onPointerDown, true);
		}
	});
	onScopeDispose(detach);

	return {
		canCrop,
		cropActive,
		cropElement,
		cropImageSrc,
		enterCrop,
		toggleCrop,
		commitCrop,
		cancelCrop,
		applyLive,
		applyAspect,
		applyFill,
		applyFit,
	};
}
