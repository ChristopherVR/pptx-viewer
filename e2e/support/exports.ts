/**
 * Driving the File-backstage export cards and validating what they download.
 *
 * Every binding renders the Export page's action cards from the shared
 * `BACKSTAGE_CARDS` table (`packages/shared/src/render/backstage-cards.ts`),
 * so the accessible names asserted here ("Create PDF", "Export current slide",
 * "Create an Animated GIF", ...) are the one contract all five agree on by
 * construction. Downloads are validated by magic bytes rather than filename,
 * because the filename prefix legitimately differs per binding
 * (`slide-1.png` vs `<deck>-slide-1.png`) while a wrong container format is
 * always a bug.
 *
 * @module e2e/support/exports
 */
import { readFileSync } from 'node:fs';

import type { Download, Locator, Page } from '@playwright/test';

import { fixture } from './deck';

/** 4 slides, 19KB: big enough to prove per-slide loops, small enough for GIF. */
export const EXPORT_DECK = fixture('transitions-animations.pptx');
export const EXPORT_DECK_SLIDE_COUNT = 4;

/** Shared card titles (accessible names) from `BACKSTAGE_CARDS`. */
export const PNG_CARD = /create a high-quality png|export current slide/iu;
export const PDF_CARD = /create pdf/iu;
export const GIF_CARD = /create an animated gif/iu;
export const VIDEO_CARD = /create a video/iu;
export const COPY_IMAGE_CARD = /copy as image/iu;

/**
 * The first html2canvas capture of a session warms fonts and stylesheets and
 * takes ~30s in a cold demo tab; later captures take ~1s per slide. Budgets
 * below assume a cold page per test.
 */
export const EXPORT_DOWNLOAD_TIMEOUT_MS = 120_000;

/** The backstage dialog (shared `aria-label="File"` contract). */
export function backstage(page: Page): Locator {
	return page.locator('[role="dialog"][aria-label="File"]');
}

/** Open File > Export through the shared toolbar/tablist contract. */
export async function openBackstageExport(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await backstage(page).waitFor();
	await backstage(page)
		.getByRole('button', { name: /^export$/iu })
		.first()
		.click();
	// Let the pane swap settle before we address a card.
	await page.waitForTimeout(300);
}

/** An export action card by its shared accessible name. */
export function exportCard(page: Page, title: RegExp): Locator {
	return backstage(page).getByRole('button', { name: title }).first();
}

/** Click a card and capture the download it produces. */
export async function downloadViaCard(
	page: Page,
	title: RegExp,
	timeoutMs: number = EXPORT_DOWNLOAD_TIMEOUT_MS,
): Promise<Download> {
	const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs });
	await exportCard(page, title).click();
	return downloadPromise;
}

/** Read a completed download's bytes. */
export async function downloadBytes(download: Download): Promise<Uint8Array> {
	const path = await download.path();
	return new Uint8Array(readFileSync(path));
}

/** Decode a byte range as latin1 (magic bytes and PDF syntax are all ASCII). */
function latin1(bytes: Uint8Array, start: number, end: number): string {
	return new TextDecoder('latin1').decode(bytes.subarray(start, end));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** `89 50 4E 47 0D 0A 1A 0A` */
export function isPng(bytes: Uint8Array): boolean {
	return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

/** `%PDF-` */
export function isPdf(bytes: Uint8Array): boolean {
	return latin1(bytes, 0, 5) === '%PDF-';
}

/** `GIF87a` or `GIF89a` */
export function isGif(bytes: Uint8Array): boolean {
	return /^GIF8[79]a$/u.test(latin1(bytes, 0, 6));
}

/**
 * Page count of a PDF, from its page objects (`/Type /Page`, excluding the
 * `/Pages` tree node). jsPDF writes these uncompressed, so a plain scan of the
 * byte stream is reliable for the files these viewers emit.
 */
export function pdfPageCount(bytes: Uint8Array): number {
	const text = new TextDecoder('latin1').decode(bytes);
	return (text.match(/\/Type\s*\/Page(?!s)/gu) ?? []).length;
}

/**
 * How many on-screen elements currently show text matching `pattern`.
 * Visibility-filtered because ribbon menus keep a hidden "Export as PDF"
 * command mounted, which would satisfy a bare text locator while nothing at
 * all is shown to the user.
 */
export async function visibleTextMatches(page: Page, pattern: RegExp): Promise<number> {
	return page
		.getByText(pattern)
		.evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

/**
 * Poll until text matching `pattern` is actually visible, resolving `false` on
 * timeout instead of throwing so a parity spec can report the gap by name.
 */
export async function progressAppears(
	page: Page,
	pattern: RegExp,
	timeoutMs: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if ((await visibleTextMatches(page, pattern)) > 0) {
			return true;
		}
		await page.waitForTimeout(100);
	}
	return false;
}
