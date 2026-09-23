/**
 * Shared scaffolding for the save-fidelity regression tests: load a committed
 * deck (optionally patched part by part, so the input is always what the real
 * parser produces), mutate the parsed model, save, and hand back both zips.
 *
 * @module __tests__/integration/save-fidelity-harness
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';

import type { PptxHandlerSaveOptions } from '../../core/core/types';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxSlide } from '../../core/types';
import { requireFixture } from '../require-fixture';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

/** Absolute path of a committed deck under `e2e/fixtures` (or a corpus-relative path). */
export function fixturePath(name: string): string {
	const candidates = [
		path.join(REPO_ROOT, 'e2e/fixtures', name),
		path.join(REPO_ROOT, 'packages/core/src/__tests__/fixtures/corpus', name),
		path.join(REPO_ROOT, 'packages/core/src/__tests__/fixtures', name),
	];
	const found = candidates.find((candidate) => existsSync(candidate));
	return found ?? requireFixture(candidates[0]);
}

export interface RoundTripResult {
	handler: PptxHandler;
	data: PptxData;
	source: JSZip;
	saved: JSZip;
	savedBytes: Uint8Array;
}

export interface RoundTripInput {
	/** Replace or add parts before loading (part path to XML/text). */
	patchParts?: Record<string, string | ((xml: string) => string)>;
	/** Mutate the parsed model; returns the slides to save (defaults to `data.slides`). */
	mutate?: (data: PptxData) => PptxSlide[] | void;
	options?: (data: PptxData) => PptxHandlerSaveOptions;
}

export async function loadPatched(
	name: string,
	patchParts: RoundTripInput['patchParts'] = {},
): Promise<{ bytes: Uint8Array; source: JSZip }> {
	const source = await JSZip.loadAsync(readFileSync(fixturePath(name)));
	for (const [part, patch] of Object.entries(patchParts)) {
		const current = (await source.file(part)?.async('string')) ?? '';
		source.file(part, typeof patch === 'function' ? patch(current) : patch);
	}
	const bytes = await source.generateAsync({ type: 'uint8array' });
	return { bytes, source };
}

export async function roundTrip(
	name: string,
	input: RoundTripInput = {},
): Promise<RoundTripResult> {
	const { bytes, source } = await loadPatched(name, input.patchParts);
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	const slides = input.mutate?.(data) ?? data.slides;
	const savedBytes = await handler.save(slides, input.options?.(data));
	const saved = await JSZip.loadAsync(savedBytes);
	return { handler, data, source, saved, savedBytes };
}

/** Mark every slide dirty so each one goes through the full re-serialization path. */
export function markAllDirty(data: PptxData): void {
	for (const slide of data.slides) {
		(slide as { isDirty?: boolean }).isDirty = true;
	}
}

export async function partText(zip: JSZip, part: string): Promise<string> {
	const file = zip.file(part);
	if (!file) {
		throw new Error(`part ${part} missing`);
	}
	return file.async('string');
}

/**
 * Prefixes used in element or attribute names but not declared in scope,
 * as `prefix@part` strings. Empty means every part is namespace-well-formed.
 */
export async function undeclaredPrefixes(zip: JSZip): Promise<string[]> {
	const out: string[] = [];
	for (const name of Object.keys(zip.files)) {
		if (!/\.(xml|rels)$/u.test(name)) {
			continue;
		}
		const xml = await zip.file(name)!.async('string');
		const stack: Set<string>[] = [];
		const tagRe =
			/<(\/?)([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/gu;
		let m: RegExpExecArray | null;
		while ((m = tagRe.exec(xml))) {
			if (m[1]) {
				stack.pop();
				continue;
			}
			const scope = new Set<string>(stack.length > 0 ? stack[stack.length - 1] : ['xml']);
			for (const a of (m[3] ?? '').matchAll(/xmlns:([\w.-]+)=/gu)) {
				scope.add(a[1]);
			}
			const names = [
				m[2],
				...[...(m[3] ?? '').matchAll(/\s([\w.-]+:[\w.-]+)=/gu)].map((a) => a[1]),
			];
			for (const qname of names) {
				const [prefix, local] = qname.split(':');
				if (local !== undefined && prefix !== 'xmlns' && !scope.has(prefix)) {
					out.push(`${prefix}@${name}`);
				}
			}
			if (!m[4]) {
				stack.push(scope);
			}
		}
	}
	return [...new Set(out)];
}
