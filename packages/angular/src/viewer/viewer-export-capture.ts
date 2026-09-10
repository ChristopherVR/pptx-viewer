/**
 * Per-slide capture loops for `ViewerExportService`: flip the live stage to
 * each slide in turn, let it settle, and rasterise it (plain canvas, raw
 * tiles, or a PNG data URL), reporting progress and honouring cooperative
 * cancellation. Split out of `viewer-export.service.ts` to keep that file
 * under the file-size budget.
 *
 * Rasterisation itself is `ExportService`'s job (the shared `foreignObject`
 * fidelity pipeline, see `export-raster-tiles.ts`); this module only owns
 * the "make slide N the live DOM, then capture it" choreography.
 */
import type { WritableSignal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { RasterizeElementTilesResult } from '../internal/shared';
import { slideProgressPercent, slideStatusLabel } from '../internal/shared';
import type { ExportService } from './export.service';

/** Live accessors the export loop needs from the host component. */
export interface ExportHost {
	/** The component's active-slide index (read + written to flip the live stage). */
	readonly activeSlideIndex: WritableSignal<number>;
	/** Current slide count of the displayed deck. */
	readonly slideCount: () => number;
	/** The full deck (templates merged back) for the print job. */
	readonly mergedSlides: () => readonly PptxSlide[];
	/** Resolve the live slide-stage element, or `undefined` when not mounted. */
	readonly resolveStage: () => HTMLElement | undefined;
	/**
	 * File > Options > Advanced > "Image Size and Quality"
	 * (`resolveImageResolutionScale`), read fresh for every PNG/PDF capture.
	 * Not applied to GIF/video (those intentionally stay at their own fixed
	 * capture resolution). Defaults to 2 (the pre-existing hardcoded value)
	 * when omitted.
	 */
	readonly imageExportScale?: () => number;
}

/** Progress-reporting sinks the capture loops write to. */
export interface CaptureProgressSinks {
	setProgress(value: number): void;
	setStatusMessage(value: string): void;
}

/** How long the stage is given to re-render after flipping the active slide. */
const SETTLE_MS = 150;

/**
 * Make `index` the live slide and wait one settle tick, then hand back the
 * stage element (or `undefined` when the viewer is not mounted). The viewer
 * reuses one stage node, so every capture must happen *while its slide is
 * the live DOM*: a deferred capture would yield the same (last) slide.
 */
async function flipToSlide(host: ExportHost, index: number): Promise<HTMLElement | undefined> {
	host.activeSlideIndex.set(index);
	await new Promise<void>((resolve) => {
		setTimeout(resolve, SETTLE_MS);
	});
	return host.resolveStage();
}

/**
 * The one capture loop every multi-slide export shares: visit each slide in
 * turn, report per-slide progress (`verb` + `span`), bail out cooperatively
 * when `abortSignal.aborted`, skip a slide whose stage is not mounted, and
 * always restore the original active slide afterwards. `capture` decides
 * what one live stage becomes (a canvas, a tile set, ...).
 */
export async function captureEachSlide<T>(
	host: ExportHost,
	sinks: CaptureProgressSinks,
	abortSignal: AbortSignal,
	verb: string,
	span: number,
	capture: (stage: HTMLElement) => Promise<T>,
): Promise<T[]> {
	const total = host.slideCount();
	const original = host.activeSlideIndex();
	const results: T[] = [];
	try {
		for (let i = 0; i < total; i++) {
			if (abortSignal.aborted) {
				throw new DOMException('Export cancelled', 'AbortError');
			}
			sinks.setProgress(slideProgressPercent(i, total, span));
			sinks.setStatusMessage(slideStatusLabel(verb, i, total));
			const el = await flipToSlide(host, i);
			if (el) {
				results.push(await capture(el));
			}
		}
	} finally {
		host.activeSlideIndex.set(original);
	}
	return results;
}

/**
 * Render every slide to a single canvas each, via `exportSvc.renderElement`
 * (the shared `foreignObject` pipeline clamped to one canvas) - for GIF and
 * video export, which consume exactly one image per frame.
 */
export function captureSlideCanvases(
	exportSvc: ExportService,
	host: ExportHost,
	sinks: CaptureProgressSinks,
	abortSignal: AbortSignal,
	verb: string,
	span: number,
	scale: number = 2,
): Promise<HTMLCanvasElement[]> {
	return captureEachSlide(host, sinks, abortSignal, verb, span, (el) =>
		exportSvc.renderElement(el, scale),
	);
}

/**
 * Render every slide to its raw per-tile canvases via
 * `exportSvc.renderElementToTiles` - for PDF export: a PDF page has no
 * canvas-size limit of its own, so it can place several small tile images
 * per page instead of needing one oversized canvas.
 */
export function captureSlideTiles(
	exportSvc: ExportService,
	host: ExportHost,
	sinks: CaptureProgressSinks,
	abortSignal: AbortSignal,
	verb: string,
	span: number,
	scale: number = 2,
): Promise<RasterizeElementTilesResult[]> {
	return captureEachSlide(host, sinks, abortSignal, verb, span, (el) =>
		exportSvc.renderElementToTiles(el, scale),
	);
}

/**
 * Flip the live stage to `index`, let it settle, and capture it to a PNG
 * data URL (the print/notes-page path, one image per page). `scale`
 * defaults to the host's own Image Size/Quality scale (matching PNG/PDF
 * export); the print notes/handouts path passes a higher value when
 * Options > Advanced > "High quality" is on.
 */
export async function captureSlideDataUrl(
	exportSvc: ExportService,
	host: ExportHost,
	index: number,
	scale?: number,
): Promise<string | null> {
	const el = await flipToSlide(host, index);
	if (!el) {
		return null;
	}
	const canvas = await exportSvc.renderElement(el, scale ?? host.imageExportScale?.() ?? 2);
	return canvas.toDataURL('image/png');
}
