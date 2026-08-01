import type { PptxSlide } from 'pptx-viewer-core';
import { strokeToInkElement } from 'pptx-viewer-shared';
import type {
	CanvasSize,
	PresentationInkPoint,
	PresentationInkStroke,
	PresentationPointerState,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { mountAnnotationOverlay } from './annotation-overlay';
import { promptKeepAnnotations } from './keep-annotations-dialog';

export interface PresentationAnnotationsControllerOptions {
	doc: Document;
	t: Translator;
	getSlides(): PptxSlide[];
	/** Commit accepted ink with the viewer's normal history and dirty-state integration. */
	commitSlides(slides: PptxSlide[]): void;
	onStrokesChange?(strokes: PresentationInkStroke[]): void;
	onPointerMove?(point: PresentationInkPoint): void;
}

export interface PresentationAnnotationStage {
	stageWrap: HTMLElement;
	active: boolean;
	slideIndex: number;
	canvasSize: CanvasSize;
	pointer?: PresentationPointerState;
}

export interface PresentationAnnotationsController {
	syncStage(stage: PresentationAnnotationStage): void;
	getStrokes(): readonly PresentationInkStroke[];
	setStrokes(strokes: readonly PresentationInkStroke[]): void;
	hasAnnotations(): boolean;
	clear(): void;
	finishPresentation(): Promise<'none' | 'kept' | 'discarded'>;
	dispose(): void;
}

/** Own temporary slide-show ink and optionally persist it into slide elements. */
export function createPresentationAnnotationsController(
	options: PresentationAnnotationsControllerOptions,
): PresentationAnnotationsController {
	let strokes: PresentationInkStroke[] = [];
	let unmount = (): void => undefined;
	let lastStage: PresentationAnnotationStage | null = null;
	let lastOverlayKey: string | null = null;

	/**
	 * Everything about a stage that changes what the overlay element must be.
	 * The pointer's x/y are deliberately excluded: they change on every mouse
	 * move, and remounting on one destroyed the SVG mid-gesture (the drag reports
	 * its position, the report re-synced the stage, the re-sync replaced the
	 * element that was capturing the pointer), so a pen stroke could never finish
	 * and the show's Clear button stayed disabled for ever.
	 */
	const overlayKey = (stage: PresentationAnnotationStage): string =>
		[
			String(stage.active),
			String(stage.slideIndex),
			stage.pointer?.tool ?? 'none',
			stage.pointer?.color ?? '',
		].join('|');

	const notify = (): void => options.onStrokesChange?.([...strokes]);
	const mount = (): void => {
		unmount();
		const stage = lastStage;
		const tool = stage?.pointer?.tool ?? 'none';
		if (!stage?.active || tool === 'none') {
			return;
		}
		unmount = mountAnnotationOverlay({
			stageWrap: stage.stageWrap,
			slideIndex: stage.slideIndex,
			tool,
			color: stage.pointer?.color ?? '#ef4444',
			strokes,
			onChange(next) {
				strokes = next;
				notify();
			},
			onPointerMove: options.onPointerMove,
		});
	};
	const clear = (): void => {
		strokes = [];
		notify();
		mount();
	};
	const persist = (): boolean => {
		const slides = options.getSlides();
		let changed = false;
		const next = slides.map((slide, slideIndex) => {
			const additions = strokes
				.filter((stroke) => stroke.slideIndex === slideIndex && stroke.points.length > 1)
				.map((stroke) =>
					strokeToInkElement({
						points: stroke.points.map((point) => ({
							x: point.x * (lastStage?.canvasSize.width ?? 960),
							y: point.y * (lastStage?.canvasSize.height ?? 540),
						})),
						color: stroke.color,
						width: stroke.width,
						tool: stroke.tool,
					}),
				)
				.filter((ink) => ink !== null);
			if (additions.length === 0) {
				return slide;
			}
			changed = true;
			return { ...slide, elements: [...slide.elements, ...additions] };
		});
		if (changed) {
			options.commitSlides(next);
		}
		return changed;
	};
	return {
		syncStage(stage) {
			const key = overlayKey(stage);
			// A stage rebuild empties `stageWrap`, so the overlay is also remounted
			// whenever it is no longer in the tree, not only when an input changed.
			const missing = stage.stageWrap.querySelector('.pptxv-presentation-annotations') === null;
			const changed = stage.stageWrap !== lastStage?.stageWrap || key !== lastOverlayKey;
			lastStage = stage;
			lastOverlayKey = key;
			if (changed || missing) {
				mount();
			}
		},
		getStrokes: () => strokes,
		setStrokes(next) {
			strokes = [...next];
			notify();
			mount();
		},
		hasAnnotations: () => strokes.length > 0,
		clear,
		async finishPresentation() {
			if (strokes.length === 0) {
				return 'none';
			}
			const slides = new Set(strokes.map((stroke) => stroke.slideIndex)).size;
			const choice = await promptKeepAnnotations(options.doc, options.t, strokes.length, slides);
			if (choice === 'keep') {
				persist();
			}
			clear();
			return choice === 'keep' ? 'kept' : 'discarded';
		},
		dispose() {
			unmount();
			lastStage = null;
		},
	};
}
