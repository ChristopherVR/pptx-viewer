/**
 * Pixel-level comparison of what two bindings actually painted.
 *
 * `support/fingerprint` compares what the DOM *says* it painted; this module
 * compares the paint itself, which catches the drift the DOM cannot express:
 * an SVG path filled with the wrong gradient stop, a clip-path that eats a
 * corner, a border-collapse difference inside a table. The demos fit the
 * slide to their own chrome, so the raw stage screenshots come back at
 * different sizes; instead of fighting that, each page rasterizes its own
 * screenshot onto a fixed-size canvas (composited on white, masks painted
 * out), and Node diffs the resulting byte-identical grids.
 *
 * The diff itself lives in `support/pixels`: it is shift-tolerant (one pixel,
 * both directions) because the noise floor here is resampling - every binding
 * paints the same glyphs and edges at a different zoom, so high-contrast
 * edges land half a pixel apart and would otherwise drown the signal. What
 * is measured is area-proportional real difference.
 *
 * @module e2e/support/visual-diff
 */
import type { Page } from '@playwright/test';

import { slideStage } from './deck';
import { formatDiff, splitReference } from './parity';
import type { FrameworkResult } from './parity';
import { diffRgba, encodePng } from './pixels';

/** Every capture is normalised onto this canvas (16:9, matching the decks). */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/**
 * Border ring (px) excluded from every comparison. An element screenshot of a
 * stage whose bounding box sits at a fractional coordinate can include a
 * one-pixel sliver of the chrome around it; that sliver is not slide content.
 */
export const EDGE_CROP = 2;

/** A region to paint out before diffing, as fractions (0-1) of the stage box. */
export interface MaskRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** One stage screenshot, normalised to the fixed canvas. */
export interface NormalizedCapture {
	/** Raw RGBA bytes of the canvas; alpha is 255 everywhere (white backing). */
	rgba: Uint8Array;
	/** The same canvas re-encoded as PNG, for report attachments. */
	png: Buffer;
}

/** Captures per slide key (e.g. `slide-3`), as one binding produced them. */
export type SlideCaptures = Record<string, NormalizedCapture>;

/** Wait until the stage is actually done painting, not merely mounted. */
async function settleStage(page: Page): Promise<void> {
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	// A half-loaded <img> screenshots as a blank box and diffs as a false
	// positive. `complete` alone (not `naturalWidth`) so a genuinely broken
	// image still gets captured and reported as the pixel difference it is.
	await page.waitForFunction(() =>
		[...document.querySelectorAll('[aria-roledescription="slide"] img')].every(
			(node) => node instanceof HTMLImageElement && node.complete,
		),
	);
	// Two frames so style/layout flushed by the waits above reach the screen.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
}

/**
 * Screenshot the main-canvas stage and normalise it onto the fixed canvas.
 *
 * The rasterization runs inside the captured page itself (any page would do,
 * the canvas maths is identical in every tab of the same browser): the PNG is
 * decoded by an `Image`, drawn stretched onto a white-filled canvas, masked,
 * and read back as raw RGBA. Compositing on white happens implicitly, because
 * `source-over` onto the white fill resolves every translucent pixel.
 */
export async function captureNormalizedStage(
	page: Page,
	masks: readonly MaskRect[] = [],
): Promise<NormalizedCapture> {
	await settleStage(page);
	const shot = await slideStage(page).screenshot({ animations: 'disabled', scale: 'css' });

	const { rgbaBase64, pngBase64 } = await page.evaluate(
		async (input: {
			shotBase64: string;
			width: number;
			height: number;
			masks: readonly { x: number; y: number; width: number; height: number }[];
		}) => {
			const img = new Image();
			img.src = `data:image/png;base64,${input.shotBase64}`;
			await img.decode();

			const canvas = document.createElement('canvas');
			canvas.width = input.width;
			canvas.height = input.height;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) {
				throw new Error('no 2d canvas context available for normalisation');
			}
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, input.width, input.height);
			ctx.drawImage(img, 0, 0, input.width, input.height);
			for (const mask of input.masks) {
				ctx.fillRect(
					Math.floor(mask.x * input.width),
					Math.floor(mask.y * input.height),
					Math.ceil(mask.width * input.width),
					Math.ceil(mask.height * input.height),
				);
			}

			const data = ctx.getImageData(0, 0, input.width, input.height).data;
			let binary = '';
			const step = 0x8000;
			for (let i = 0; i < data.length; i += step) {
				binary += String.fromCharCode(...data.subarray(i, Math.min(i + step, data.length)));
			}
			return {
				rgbaBase64: btoa(binary),
				pngBase64: canvas.toDataURL('image/png').split(',')[1],
			};
		},
		{ shotBase64: shot.toString('base64'), width: CANVAS_WIDTH, height: CANVAS_HEIGHT, masks },
	);

	return {
		rgba: new Uint8Array(Buffer.from(rgbaBase64, 'base64')),
		png: Buffer.from(pngBase64, 'base64'),
	};
}

/** What a single reference/candidate pixel comparison measured. */
export interface VisualDiffResult {
	/** Pixels with no close colour within one pixel in the other capture. */
	differingPixels: number;
	/** Pixels compared (the canvas minus the {@link EDGE_CROP} ring). */
	totalPixels: number;
	/** `differingPixels / totalPixels`, 0-1. */
	ratio: number;
	/** Largest shift-tolerant delta seen on any compared pixel. */
	maxDelta: number;
	/** Differing pixels in red over a faded greyscale of the reference. */
	diffPng: Buffer;
}

/** Diff two normalised captures (shift-tolerant, edge ring cropped). */
export function diffCaptures(
	reference: NormalizedCapture,
	candidate: NormalizedCapture,
	channelThreshold: number,
): VisualDiffResult {
	const { differingPixels, totalPixels, ratio, maxDelta, overlay } = diffRgba(
		reference.rgba,
		candidate.rgba,
		CANVAS_WIDTH,
		CANVAS_HEIGHT,
		channelThreshold,
		EDGE_CROP,
	);
	return {
		differingPixels,
		totalPixels,
		ratio,
		maxDelta,
		diffPng: encodePng(CANVAS_WIDTH, CANVAS_HEIGHT, overlay),
	};
}

/** How far a pair may drift before it counts as a visual parity break. */
export interface VisualBudget {
	/** Per-channel delta a pixel may drift before it counts as different. */
	channelThreshold: number;
	/** Fraction (0-1) of pixels allowed to differ before the pair fails. */
	maxDiffRatio: number;
}

/** A known, tracked product divergence that this suite must not fail on. */
export interface VisualExclusion {
	/** Slide key as produced by the capture scenario, e.g. `slide-5`. */
	slide: string;
	/** Candidate binding name the exclusion applies to, or `*` for all. */
	binding: string;
	/** Root cause, so the exclusion can be deleted when the product is fixed. */
	reason: string;
}

/** An image (or text) the spec should attach to the test report. */
export interface VisualArtifact {
	name: string;
	contentType: string;
	body: Buffer;
}

/** Everything the spec needs to assert, attach, and account for thresholds. */
export interface VisualParityReport {
	/** One formatted entry per candidate binding that broke the budget. */
	problems: string[];
	/** Reference/candidate/diff PNGs for every failing pair. */
	artifacts: VisualArtifact[];
	/** One line per compared pair, for threshold bookkeeping in the report. */
	measurements: string[];
}

/**
 * Compare every candidate binding's captures against the reference's.
 *
 * Kept here rather than in the spec so the spec never touches a framework
 * name in a conditional: exclusions are matched, budgets applied, and
 * artifacts collected behind this neutral API, and the spec just asserts
 * that `problems` is empty and attaches whatever comes back.
 */
export function compareVisualResults(
	results: FrameworkResult<SlideCaptures>[],
	budget: VisualBudget,
	exclusions: readonly VisualExclusion[] = [],
): VisualParityReport {
	const { reference, candidates } = splitReference(results);
	const problems: string[] = [];
	const artifacts: VisualArtifact[] = [];
	const measurements: string[] = [];

	for (const candidate of candidates) {
		const name = candidate.framework.name;
		const perBinding: string[] = [];
		for (const [slide, referenceCapture] of Object.entries(reference.value)) {
			const excluded = exclusions.find(
				(entry) => entry.slide === slide && (entry.binding === '*' || entry.binding === name),
			);
			if (excluded) {
				measurements.push(`${slide} ${name}: excluded (${excluded.reason})`);
				continue;
			}
			const candidateCapture = candidate.value[slide];
			if (!candidateCapture) {
				perBinding.push(`${slide}: never captured on this binding`);
				continue;
			}
			const diff = diffCaptures(referenceCapture, candidateCapture, budget.channelThreshold);
			measurements.push(
				`${slide} ${name}: ${(diff.ratio * 100).toFixed(3)}% of pixels differ ` +
					`(max channel delta ${diff.maxDelta})`,
			);
			if (diff.ratio > budget.maxDiffRatio) {
				perBinding.push(
					`${slide}: ${(diff.ratio * 100).toFixed(2)}% of pixels drift beyond ` +
						`+/-${budget.channelThreshold} per channel (budget ${(budget.maxDiffRatio * 100).toFixed(2)}%)`,
				);
				artifacts.push(
					{ name: `${slide}-reference.png`, contentType: 'image/png', body: referenceCapture.png },
					{ name: `${slide}-${name}.png`, contentType: 'image/png', body: candidateCapture.png },
					{ name: `${slide}-${name}-diff.png`, contentType: 'image/png', body: diff.diffPng },
				);
			}
		}
		if (perBinding.length > 0) {
			problems.push(formatDiff(name, perBinding));
		}
	}

	return { problems, artifacts, measurements };
}
