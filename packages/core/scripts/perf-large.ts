/**
 * Large-presentation performance benchmark for `pptx-viewer-core`.
 *
 * Generates synthetic decks of a target on-disk size (default ~50MB and
 * ~100MB), then measures the core engine's load (parse) and save
 * (round-trip serialize) performance, peak memory, and document
 * statistics (slide / element counts).
 *
 * The script imports directly from the package source (`../src`) so it can
 * be run with `bun` without a prior build:
 *
 *   bun packages/core/scripts/perf-large.ts
 *   bun packages/core/scripts/perf-large.ts --targets=50,100 --runs=3
 *   bun packages/core/scripts/perf-large.ts --keep   # keep generated .pptx
 *
 * Generated fixtures are written to `packages/core/.perf-tmp/` (gitignored)
 * and removed afterwards unless `--keep` is passed.
 *
 * @module scripts/perf-large
 */

import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from '../src/core/PptxHandler';
import type { PptxElement } from '../src/core/types/elements';
import type { PptxData, PptxSlide } from '../src/core/types/presentation';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

/**
 * Deck content profile.
 *
 * - `image`: few elements per slide + one large incompressible PNG. File
 *   size is dominated by embedded media; this stresses zip deflate and the
 *   media write path, not XML parsing.
 * - `xml`: no large media; size is reached by packing many small text/shape
 *   elements per slide. This stresses XML parse/serialize and is the more
 *   representative bottleneck profile for the engine itself.
 */
type DeckMode = 'image' | 'xml';

interface CliOptions {
	/** Target on-disk sizes in megabytes. */
	targetsMb: number[];
	/** Number of measured runs per phase (median is reported). */
	runs: number;
	/** Keep generated .pptx files instead of deleting them. */
	keep: boolean;
	/** Content profile. */
	mode: DeckMode;
}

function parseArgs(argv: string[]): CliOptions {
	const opts: CliOptions = { targetsMb: [50, 100], runs: 3, keep: false, mode: 'image' };
	for (const arg of argv) {
		if (arg === '--keep') {
			opts.keep = true;
		} else if (arg.startsWith('--mode=')) {
			const m = arg.slice('--mode='.length);
			if (m === 'image' || m === 'xml') {
				opts.mode = m;
			}
		} else if (arg.startsWith('--targets=')) {
			opts.targetsMb = arg
				.slice('--targets='.length)
				.split(',')
				.map((s) => Number(s.trim()))
				.filter((n) => Number.isFinite(n) && n > 0);
		} else if (arg.startsWith('--runs=')) {
			const n = Number(arg.slice('--runs='.length));
			if (Number.isFinite(n) && n > 0) {
				opts.runs = Math.floor(n);
			}
		}
	}
	return opts;
}

// ---------------------------------------------------------------------------
// Constants / paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(SCRIPT_DIR, '..', '.perf-tmp');
const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Synthetic image generation
// ---------------------------------------------------------------------------

/**
 * Build a valid (but uncompressible) PNG of roughly `approxBytes` bytes.
 *
 * We synthesize a truecolor PNG whose pixel data is pseudo-random so that
 * the deflate stream inside the PNG cannot shrink it, and so that JSZip's
 * own DEFLATE pass during save cannot collapse the embedded media either.
 * This keeps the generated deck's on-disk size predictable and forces the
 * save pipeline to do real compression work (representative of photo-heavy
 * decks).
 *
 * Returns a `data:image/png;base64,...` URL consumable by the SDK's
 * `addImage`, which routes data URLs to `imageData` (embedded as binary in
 * the saved package).
 */
function makeRandomPng(approxBytes: number): string {
	// PNG truecolor (RGB) raw data = height * (1 + width * 3) bytes (1 filter
	// byte per scanline). We deflate-store it, so the IDAT is ~raw size. Solve
	// for a square-ish image.
	const bytesPerRow = (w: number): number => 1 + w * 3;
	let width = Math.max(8, Math.floor(Math.sqrt(approxBytes / 3)));
	let height = Math.max(8, Math.floor(approxBytes / bytesPerRow(width)));
	// Cap dimensions so a single image stays sane.
	width = Math.min(width, 4096);
	height = Math.min(height, 4096);

	const raw = Buffer.allocUnsafe(height * bytesPerRow(width));
	let p = 0;
	// xorshift32 PRNG — fast, deterministic, fills with incompressible noise.
	let s = 0x9e3779b9 ^ (width * 2654435761) ^ height;
	const next = (): number => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return s >>> 0;
	};
	for (let y = 0; y < height; y++) {
		raw[p++] = 0; // filter type: none
		for (let x = 0; x < width * 3; x++) {
			raw[p++] = next() & 0xff;
		}
	}

	const png = encodePng(width, height, raw);
	return `data:image/png;base64,${png.toString('base64')}`;
}

/** Minimal PNG encoder: stored (uncompressed) zlib IDAT, truecolor 8-bit. */
function encodePng(width: number, height: number, rawRgbWithFilters: Buffer): Buffer {
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	const ihdr = Buffer.allocUnsafe(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: truecolor RGB
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace

	const idat = zlibStore(rawRgbWithFilters);

	return Buffer.concat([
		signature,
		chunk('IHDR', ihdr),
		chunk('IDAT', idat),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

/** Wrap a zlib "stored" (type 0) stream around raw bytes — no compression. */
function zlibStore(data: Buffer): Buffer {
	const out: Buffer[] = [];
	out.push(Buffer.from([0x78, 0x01])); // zlib header, no compression preset
	const CHUNK = 0xffff;
	for (let off = 0; off < data.length; off += CHUNK) {
		const slice = data.subarray(off, Math.min(off + CHUNK, data.length));
		const last = off + CHUNK >= data.length ? 1 : 0;
		const header = Buffer.allocUnsafe(5);
		header[0] = last;
		header.writeUInt16LE(slice.length, 1);
		header.writeUInt16LE(~slice.length & 0xffff, 3);
		out.push(header, slice);
	}
	out.push(adler32(data));
	return Buffer.concat(out);
}

function adler32(data: Buffer): Buffer {
	let a = 1;
	let b = 0;
	const MOD = 65521;
	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]) % MOD;
		b = (b + a) % MOD;
	}
	const buf = Buffer.allocUnsafe(4);
	buf.writeUInt32BE(((b << 16) | a) >>> 0, 0);
	return buf;
}

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(data: Buffer): number {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const len = Buffer.allocUnsafe(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, 'ascii');
	const crc = Buffer.allocUnsafe(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}

// ---------------------------------------------------------------------------
// Deck generation
// ---------------------------------------------------------------------------

interface GenResult {
	path: string;
	sizeBytes: number;
	slideCount: number;
	elementCount: number;
}

const LOREM =
	'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod ' +
	'tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam.';

/** Number of small text/shape elements per slide in `xml` mode. */
const XML_ELEMENTS_PER_SLIDE = 60;

/**
 * Generate a deck targeting `targetMb` on-disk megabytes.
 *
 * In `image` mode each slide carries a few elements plus one embedded
 * incompressible PNG (predictable byte weight; stresses zip/media path).
 *
 * In `xml` mode each slide is packed with many small text/shape elements
 * and no large media, so the target size is reached purely through XML
 * volume — the profile that actually exercises the parser/serializer.
 *
 * We add slides until the saved file meets the target, re-saving to
 * measure actual size.
 */
async function generateDeck(
	targetMb: number,
	perImageKb: number,
	mode: DeckMode,
): Promise<GenResult> {
	const { handler, data, createSlide } = await PptxHandler.create({
		title: `Perf deck ${targetMb}MB (${mode})`,
		creator: 'perf-large.ts',
	});

	const targetBytes = targetMb * MB;
	const perImageBytes = perImageKb * 1024;
	let elementCount = 0;

	const addImageSlide = (n: number): void => {
		const b = createSlide('Blank');
		b.addText(`Slide ${n} — ${LOREM}`, {
			x: 40,
			y: 40,
			width: 880,
			height: 80,
			fontSize: 24,
			bold: true,
		});
		b.addText(`${LOREM} ${LOREM}`, { x: 40, y: 140, width: 880, height: 200, fontSize: 14 });
		b.addShape('roundRect', {
			x: 40,
			y: 360,
			width: 300,
			height: 120,
			fill: { type: 'solid', color: '#4472C4' },
		});
		b.addShape('ellipse', {
			x: 380,
			y: 360,
			width: 200,
			height: 120,
			fill: { type: 'solid', color: '#ED7D31' },
		});
		b.addImage(makeRandomPng(perImageBytes), { x: 600, y: 360, width: 320, height: 200 });
		const slide = b.build();
		elementCount += slide.elements.length;
		data.slides.push(slide);
	};

	const addXmlSlide = (n: number): void => {
		const b = createSlide('Blank');
		// Pack many small elements; each is real XML the parser must walk.
		for (let i = 0; i < XML_ELEMENTS_PER_SLIDE; i++) {
			const x = (i % 10) * 90 + 20;
			const y = Math.floor(i / 10) * 80 + 20;
			if (i % 2 === 0) {
				b.addText(`S${n}E${i} ${LOREM}`, {
					x,
					y,
					width: 88,
					height: 70,
					fontSize: 11,
					bold: i % 4 === 0,
				});
			} else {
				b.addShape(i % 3 === 0 ? 'roundRect' : 'rect', {
					x,
					y,
					width: 88,
					height: 70,
					fill: { type: 'solid', color: i % 6 === 1 ? '#4472C4' : '#ED7D31' },
				});
			}
		}
		const slide = b.build();
		elementCount += slide.elements.length;
		data.slides.push(slide);
	};

	const addSlide = mode === 'image' ? addImageSlide : addXmlSlide;

	// Rough initial estimate of slide count for the target.
	const estSlides =
		mode === 'image'
			? Math.max(4, Math.ceil(targetBytes / perImageBytes))
			: Math.max(8, Math.ceil(targetBytes / (XML_ELEMENTS_PER_SLIDE * 1500)));
	for (let i = 0; i < estSlides; i++) {
		addSlide(data.slides.length + 1);
	}

	// Measure & top up until we clear the target. Estimate the deficit from
	// the measured average bytes-per-slide so the loop converges in a couple
	// of iterations regardless of mode.
	let bytes = await handler.save(data.slides);
	while (bytes.byteLength < targetBytes) {
		const deficit = targetBytes - bytes.byteLength;
		const bytesPerSlide = Math.max(1, bytes.byteLength / data.slides.length);
		const more = Math.max(1, Math.ceil(deficit / bytesPerSlide));
		for (let i = 0; i < more; i++) {
			addSlide(data.slides.length + 1);
		}
		bytes = await handler.save(data.slides);
	}

	const outPath = join(TMP_DIR, `perf-${targetMb}mb-${mode}.pptx`);
	await writeFile(outPath, bytes);
	const onDisk = (await stat(outPath)).size;

	return {
		path: outPath,
		sizeBytes: onDisk,
		slideCount: data.slides.length,
		elementCount,
	};
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

interface PhaseStats {
	medianMs: number;
	minMs: number;
	maxMs: number;
	/** Peak heapUsed delta observed across the phase, in bytes. */
	peakHeapBytes: number;
	/** RSS after the phase, in bytes. */
	rssBytes: number;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function countElements(slides: PptxSlide[]): number {
	let n = 0;
	const walk = (els: PptxElement[]): void => {
		for (const el of els) {
			n++;
			if (el.type === 'group' && Array.isArray(el.children)) {
				walk(el.children);
			}
		}
	};
	for (const s of slides) {
		walk(s.elements);
	}
	return n;
}

/** Read a file into a fresh ArrayBuffer (detached from any pool). */
async function readArrayBuffer(path: string): Promise<ArrayBuffer> {
	const file = Bun.file(path);
	return file.arrayBuffer();
}

async function measureLoad(
	path: string,
	runs: number,
): Promise<{ stats: PhaseStats; data: PptxData }> {
	const times: number[] = [];
	let peakHeap = 0;
	let rss = 0;
	let lastData: PptxData | undefined;
	for (let i = 0; i < runs; i++) {
		const buf = await readArrayBuffer(path);
		const before = process.memoryUsage();
		const handler = new PptxHandler();
		const t0 = performance.now();
		const data = await handler.load(buf);
		const t1 = performance.now();
		const after = process.memoryUsage();
		times.push(t1 - t0);
		peakHeap = Math.max(peakHeap, after.heapUsed - before.heapUsed);
		rss = after.rss;
		lastData = data;
	}
	if (!lastData) {
		throw new Error('load produced no data');
	}
	return {
		stats: {
			medianMs: median(times),
			minMs: Math.min(...times),
			maxMs: Math.max(...times),
			peakHeapBytes: peakHeap,
			rssBytes: rss,
		},
		data: lastData,
	};
}

async function measureSave(path: string, runs: number): Promise<PhaseStats> {
	const times: number[] = [];
	let peakHeap = 0;
	let rss = 0;
	// Load once; re-save the same slides each run.
	const buf = await readArrayBuffer(path);
	const handler = new PptxHandler();
	const data = await handler.load(buf);
	for (let i = 0; i < runs; i++) {
		const before = process.memoryUsage();
		const t0 = performance.now();
		await handler.save(data.slides);
		const t1 = performance.now();
		const after = process.memoryUsage();
		times.push(t1 - t0);
		peakHeap = Math.max(peakHeap, after.heapUsed - before.heapUsed);
		rss = after.rss;
	}
	return {
		medianMs: median(times),
		minMs: Math.min(...times),
		maxMs: Math.max(...times),
		peakHeapBytes: peakHeap,
		rssBytes: rss,
	};
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const fmtMs = (ms: number): string => `${ms.toFixed(0)} ms`;
const fmtMb = (bytes: number): string => `${(bytes / MB).toFixed(1)} MB`;

interface RowResult {
	targetMb: number;
	gen: GenResult;
	load: PhaseStats;
	save: PhaseStats;
	roundTripOk: boolean;
}

function printReport(rows: RowResult[], runs: number, mode: DeckMode): void {
	console.log('\n========================================================================');
	console.log(`  pptx-viewer-core — large-deck benchmark (mode=${mode}, median of ${runs} runs)`);
	console.log('========================================================================\n');
	const header = [
		'Target'.padEnd(8),
		'On-disk'.padEnd(10),
		'Slides'.padEnd(8),
		'Elements'.padEnd(10),
		'Load'.padEnd(11),
		'Save'.padEnd(11),
		'Load heapΔ'.padEnd(12),
		'Save heapΔ'.padEnd(12),
		'RSS'.padEnd(10),
	].join('| ');
	console.log(header);
	console.log('-'.repeat(header.length + 8));
	for (const r of rows) {
		console.log(
			[
				`${r.targetMb}MB`.padEnd(8),
				fmtMb(r.gen.sizeBytes).padEnd(10),
				String(r.gen.slideCount).padEnd(8),
				String(r.gen.elementCount).padEnd(10),
				fmtMs(r.load.medianMs).padEnd(11),
				fmtMs(r.save.medianMs).padEnd(11),
				fmtMb(r.load.peakHeapBytes).padEnd(12),
				fmtMb(r.save.peakHeapBytes).padEnd(12),
				fmtMb(r.save.rssBytes).padEnd(10),
			].join('| '),
		);
	}
	console.log('\nNotes:');
	console.log(
		'  - Load = ArrayBuffer -> PptxData (unzip + XML parse + theme/master/layout resolve).',
	);
	console.log('  - Save = PptxData.slides -> Uint8Array (serialize + rebuild rels + zip/deflate).');
	console.log(
		'  - heapΔ = process.memoryUsage().heapUsed delta around the phase (approximate, GC-dependent).',
	);
	console.log('  - round-trip verified: save output re-loads with the same slide count.');
	for (const r of rows) {
		console.log(`  - ${r.targetMb}MB round-trip: ${r.roundTripOk ? 'OK' : 'FAILED'}`);
	}
	console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));
	await mkdir(TMP_DIR, { recursive: true });

	console.log(
		`Generating decks for targets: ${opts.targetsMb.map((t) => `${t}MB`).join(', ')} ` +
			`(mode=${opts.mode}, runs=${opts.runs}, keep=${opts.keep})`,
	);

	// ~256KB per embedded image keeps slide counts reasonable while still
	// exercising thousands of elements at 50-100MB.
	const PER_IMAGE_KB = 256;

	const rows: RowResult[] = [];
	for (const targetMb of opts.targetsMb) {
		const genStart = performance.now();
		const gen = await generateDeck(targetMb, PER_IMAGE_KB, opts.mode);
		console.log(
			`  generated ${gen.path} -> ${fmtMb(gen.sizeBytes)}, ` +
				`${gen.slideCount} slides, ${gen.elementCount} elements ` +
				`(${fmtMs(performance.now() - genStart)})`,
		);

		const { stats: load, data } = await measureLoad(gen.path, opts.runs);
		const save = await measureSave(gen.path, opts.runs);

		// Round-trip verification: re-load the saved bytes once.
		const buf = await readArrayBuffer(gen.path);
		const h = new PptxHandler();
		const reloaded = await h.load(buf);
		const reBytes = await h.save(reloaded.slides);
		const h2 = new PptxHandler();
		const reData = await h2.load(reBytes.buffer as ArrayBuffer);
		const roundTripOk =
			reData.slides.length === gen.slideCount &&
			countElements(reData.slides) === countElements(data.slides);

		rows.push({ targetMb, gen, load, save, roundTripOk });
	}

	printReport(rows, opts.runs, opts.mode);

	if (!opts.keep) {
		await rm(TMP_DIR, { recursive: true, force: true });
		console.log(`Cleaned up ${TMP_DIR} (use --keep to retain generated decks).`);
	} else {
		console.log(`Generated decks retained in ${TMP_DIR}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
