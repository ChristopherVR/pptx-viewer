/**
 * PowerPoint acceptance for the legacy binary `.ppt` writer: does a deck
 * built PURELY through the public SDK (`PptxHandler`, no fixture bytes
 * reused from anywhere) actually open in real PowerPoint?
 *
 * ## Why this exists
 *
 * A from-scratch `.ppt` this writer produced round-tripped through this
 * project's own reader while still failing real PowerPoint's
 * `Presentations.Open` with a bare COM error and no diagnostic message, for
 * reasons only reverse bisection against a COM-authored ground-truth fixture
 * (build one via COM, splice one synthetic piece in at a time, see which
 * single change breaks it) could isolate: a from-scratch deck's
 * "PowerPoint Document" stream can be small enough to tie or undercut the
 * "Current User" stream's CFB sector count, which real PowerPoint never
 * needs to handle because its own smallest output always carries a full
 * embedded theme (12+ layouts, fonts) that dwarfs the threshold on its own.
 * See `packages/core/src/core/ppt/writer/document-stream-layout.ts`'s
 * `ensureMinimumDocumentStreamSize` for the fix. Nothing in this project's
 * unit suite could have caught it: it needs a REAL PowerPoint install.
 *
 * ## What it does
 *
 * Builds a deck purely from `PptxHandler` (create presentation, add a
 * rectangle shape with text on the one slide), saves it with
 * `outputFormat: 'ppt'`, hands the bytes to PowerPoint through COM
 * (`scripts/ppt-com-open.ps1`), and asserts the slide count, shape count,
 * and the read-back text all match what was written. Also tries the
 * SMALLEST possible variant (an empty slide, zero shapes) and a
 * multi-slide deck, since the underlying defect was a size threshold: a
 * regression could plausibly affect only one end of that range.
 *
 * Exit code is 1 on any assertion failure or COM rejection, 2 if PowerPoint
 * COM itself is unavailable. Otherwise 0.
 *
 * ## Supported runtimes
 *
 * **Bun only, and Windows only.** See `scripts/com-acceptance.mjs`'s doc
 * comment for why (this project's TypeScript source uses extensionless and
 * directory imports node's ESM resolver rejects).
 *
 * ## Running it
 *
 *     bun run scripts/com-acceptance-ppt.mjs
 *
 * It is deliberately NOT part of `bun run test`: it needs a local
 * PowerPoint install and drives a real application. Run it after any change
 * to `packages/core/src/core/ppt/writer/`, and always before claiming a
 * `.ppt`-open regression is fixed.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import JSZip from 'jszip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

if (!process.versions.bun) {
	console.error(
		'com-acceptance-ppt.mjs runs under bun only: it imports packages/core/src as\n' +
			"TypeScript source, whose extensionless/directory imports node's ESM\n" +
			'resolver cannot follow. Run:\n\n    bun scripts/com-acceptance-ppt.mjs\n',
	);
	process.exit(2);
}

const importFrom = (...segments) => import(pathToFileURL(path.join(REPO, ...segments)).href);

const { PptxHandler } = await importFrom('packages/core/src/index.ts');

/**
 * Build a minimal from-scratch deck purely through the SDK's own public
 * builder API (`PptxHandler.create`, `createSlide`, `.addShape`): no
 * fixture bytes, no internal writer functions called directly.
 */
async function buildDeck(slideCount, withShape) {
	const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
	for (let i = 0; i < slideCount; i++) {
		const slide = createSlide('Blank');
		if (withShape && i === 0) {
			slide.addShape('rect', {
				x: 72,
				y: 72,
				width: 300,
				height: 150,
				fill: { type: 'solid', color: '#4472C4' },
				stroke: { color: '#2E528F', width: 1 },
				text: 'Hello',
			});
		}
		data.slides.push(slide.build());
	}
	return handler.save(data.slides, { outputFormat: 'ppt' });
}

const scratch = mkdtempSync(path.join(tmpdir(), 'pptx-com-ppt-'));
console.log(`scratch: ${scratch}`);

const cases = [
	{
		name: 'one-slide-one-shape',
		slideCount: 1,
		withShape: true,
		expectShapes: 1,
		expectText: 'Hello',
	},
	{
		name: 'one-slide-zero-shapes',
		slideCount: 1,
		withShape: false,
		expectShapes: 0,
		expectText: '',
	},
	{
		name: 'five-slides-one-shape',
		slideCount: 5,
		withShape: true,
		expectShapes: 1,
		expectText: 'Hello',
	},
];

const jobs = [];
for (const c of cases) {
	try {
		const bytes = await buildDeck(c.slideCount, c.withShape);
		const filePath = path.join(scratch, `${c.name}.ppt`);
		writeFileSync(filePath, Buffer.from(bytes));
		jobs.push({ ...c, filePath });
	} catch (err) {
		console.error(`  ! ${c.name}: save threw: ${err.message}`);
	}
}

function openAll(paths) {
	const script = path.join(HERE, 'ppt-com-open.ps1');
	const result = spawnSync(
		'pwsh',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...paths],
		{
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	const stdout = result.stdout ?? '';
	if (stdout.startsWith('FATAL')) {
		console.error(stdout.trim());
		console.error('PowerPoint COM is required. This tool is Windows-only and opt-in.');
		process.exit(2);
	}
	const verdicts = new Map();
	for (const line of stdout.split(/\r?\n/)) {
		const ok = /^OK\s+(.+?)\s{2}slides=(\d+) shapes=(\d+) text=(\S*)$/.exec(line);
		if (ok) {
			const text = ok[4] ? Buffer.from(ok[4], 'base64').toString('utf8') : '';
			verdicts.set(path.resolve(ok[1]).toLowerCase(), {
				ok: true,
				slides: Number(ok[2]),
				shapes: Number(ok[3]),
				text,
			});
			continue;
		}
		const fail = /^FAIL\s+(.+?)\s\s(.*)$/.exec(line);
		if (fail) {
			verdicts.set(path.resolve(fail[1]).toLowerCase(), { ok: false, message: fail[2] });
		}
	}
	return verdicts;
}

const verdicts = jobs.length > 0 ? openAll(jobs.map((j) => j.filePath)) : new Map();
const look = (p) =>
	verdicts.get(path.resolve(p).toLowerCase()) ?? { ok: false, message: 'no verdict' };

let failures = 0;
console.log(`\n${'case'.padEnd(28)}verdict`);
console.log('-'.repeat(90));
for (const job of jobs) {
	const v = look(job.filePath);
	if (!v.ok) {
		console.log(`${job.name.padEnd(28)}FAIL (COM): ${v.message}`);
		failures++;
		continue;
	}
	const problems = [];
	if (v.slides !== job.slideCount) {
		problems.push(`slides ${v.slides} != ${job.slideCount}`);
	}
	if (v.shapes !== job.expectShapes) {
		problems.push(`shapes ${v.shapes} != ${job.expectShapes}`);
	}
	if (v.text !== job.expectText) {
		problems.push(`text ${JSON.stringify(v.text)} != ${JSON.stringify(job.expectText)}`);
	}
	if (problems.length > 0) {
		console.log(`${job.name.padEnd(28)}FAIL (assert): ${problems.join(', ')}`);
		failures++;
	} else {
		console.log(
			`${job.name.padEnd(28)}OK  slides=${v.slides} shapes=${v.shapes} text=${JSON.stringify(v.text)}`,
		);
	}
}

console.log(`\n${jobs.length} case(s), ${failures} failure(s).`);

/**
 * Hyperlink/click-action acceptance: builds a deck purely through the SDK
 * (`PptxHandler`, `addShape`, then setting the resulting element's own
 * public `actionClick` field, exactly as the editor's Action Settings UI
 * does), saves it as `.ppt`, and asserts real PowerPoint's own
 * `ActionSettings(ppMouseClick)` reads back the same action for every kind
 * this writer supports: URL, a specific-slide jump, every relative jump
 * (next/previous/first/last/end show), mailto, and a run-level (text
 * selection) hyperlink. See `ppt-com-hyperlinks.ps1` for the reader.
 */
async function runHyperlinkCase() {
	const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
	const slideBuilder = createSlide('Blank');
	const addRect = (y, text) =>
		slideBuilder.addShape('rect', {
			x: 20,
			y,
			width: 200,
			height: 40,
			fill: { type: 'solid', color: '#4472C4' },
			text,
		});
	addRect(10, 'url-link');
	addRect(60, 'slide-link');
	addRect(110, 'next-link');
	addRect(160, 'prev-link');
	addRect(210, 'first-link');
	addRect(260, 'last-link');
	addRect(310, 'end-link');
	addRect(360, 'mailto-link');
	addRect(410, 'this has a linked word inside');

	const slide1 = slideBuilder.build();
	data.slides.push(slide1);
	data.slides.push(createSlide('Blank').build());
	data.slides.push(createSlide('Blank').build());

	const [urlSh, slideSh, nextSh, prevSh, firstSh, lastSh, endSh, mailtoSh, runSh] = slide1.elements;
	urlSh.actionClick = { url: 'https://example.com/path?q=1' };
	slideSh.actionClick = { action: 'ppaction://hlinksldjump', targetSlideIndex: 2 };
	nextSh.actionClick = { action: 'ppaction://hlinkshowjump?jump=nextslide' };
	prevSh.actionClick = { action: 'ppaction://hlinkshowjump?jump=previousslide' };
	firstSh.actionClick = { action: 'ppaction://hlinkshowjump?jump=firstslide' };
	lastSh.actionClick = { action: 'ppaction://hlinkshowjump?jump=lastslide' };
	endSh.actionClick = { action: 'ppaction://hlinkshowjump?jump=endshow' };
	mailtoSh.actionClick = { url: 'mailto:test@example.com' };
	for (const seg of runSh.textSegments ?? []) {
		if (seg.text.includes('linked')) {
			seg.style = { ...seg.style, hyperlink: 'https://run-level.example.com/' };
		}
	}

	const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
	const filePath = path.join(scratch, 'hyperlinks.ppt');
	writeFileSync(filePath, Buffer.from(bytes));

	const script = path.join(HERE, 'ppt-com-hyperlinks.ps1');
	const result = spawnSync(
		'pwsh',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', filePath],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	const stdout = result.stdout ?? '';
	if (stdout.startsWith('FATAL')) {
		console.error(stdout.trim());
		return 2;
	}

	// PpActionType: ppActionHyperlink=7, ppActionNextSlide=1,
	// ppActionPreviousSlide=2, ppActionFirstSlide=3, ppActionLastSlide=4,
	// ppActionEndShow=6.
	const expectations = [
		{
			re: /^SHAPE \d+ .*?\s+action=7 address=https:\/\/example\.com\/path\?q=1/m,
			label: 'url shape',
		},
		{ re: /^SHAPE \d+ .*?\s+action=7 address= subaddress=258,3,/m, label: 'slide-jump shape' },
		{ re: /^SHAPE \d+ .*?\s+action=1 /m, label: 'next-slide shape' },
		{ re: /^SHAPE \d+ .*?\s+action=2 /m, label: 'previous-slide shape' },
		{ re: /^SHAPE \d+ .*?\s+action=3 /m, label: 'first-slide shape' },
		{ re: /^SHAPE \d+ .*?\s+action=4 /m, label: 'last-slide shape' },
		{ re: /^SHAPE \d+ .*?\s+action=6 /m, label: 'end-show shape' },
		{
			re: /^SHAPE \d+ .*?\s+action=7 address=mailto:test@example\.com/m,
			label: 'mailto shape',
		},
		{
			re: /^RUN \d+ .*linked.*\s+action=7 address=https:\/\/run-level\.example\.com\//m,
			label: 'run-level hyperlink',
		},
	];

	console.log(`\n${'hyperlink case'.padEnd(28)}verdict`);
	console.log('-'.repeat(90));
	let hyperlinkFailures = 0;
	for (const exp of expectations) {
		const ok = exp.re.test(stdout);
		console.log(`${exp.label.padEnd(28)}${ok ? 'OK' : 'FAIL'}`);
		if (!ok) {
			hyperlinkFailures++;
		}
	}
	if (hyperlinkFailures > 0) {
		console.error(`\nFull COM output:\n${stdout}`);
	}
	console.log(`\n${expectations.length} hyperlink assertion(s), ${hyperlinkFailures} failure(s).`);
	return hyperlinkFailures > 0 ? 1 : 0;
}

const hyperlinkExit = await runHyperlinkCase();
failures += hyperlinkExit === 1 ? 1 : 0;
if (hyperlinkExit === 2) {
	rmSync(scratch, { recursive: true, force: true });
	process.exit(2);
}

/**
 * Picture + OLE-embed acceptance: a plain picture (MsoShapeType 13 =
 * msoPicture) proves the picture-frame FOPT fix alone (this shape kind had
 * never been COM-tested before: `com-acceptance-ppt.mjs`'s other cases only
 * ever used `addShape`), and an OLE embed (MsoShapeType 7 =
 * msoEmbeddedOLEObject, `OLEFormat.ProgID` = `"Package"`) proves the whole
 * `ExOleEmbedContainer`/`ExOleObjStg`/`fOleShape` chain. See
 * `packages/core/src/core/ppt/writer/ole-writer.ts`'s doc comment for what
 * each of the three fixes downstream of the ground-truth fixture were.
 */
async function runOleCase() {
	const PNG_1X1 =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
	const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
	const slideBuilder = createSlide('Blank').addImage(PNG_1X1, {
		x: 20,
		y: 20,
		width: 100,
		height: 80,
	});
	const slide1 = slideBuilder.build();

	const textBytes = new TextEncoder().encode('Hello embedded object from the .ppt writer');
	const oleDataUrl = `data:text/plain;base64,${Buffer.from(textBytes).toString('base64')}`;
	slide1.elements.push({
		type: 'ole',
		id: 'ole1',
		x: 150,
		y: 20,
		width: 200,
		height: 150,
		fileName: 'notes.txt',
		oleEmbeddedFileName: 'notes.txt',
		oleEmbeddedData: oleDataUrl,
		previewImageData: PNG_1X1,
	});
	data.slides.push(slide1);

	const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
	const filePath = path.join(scratch, 'ole.ppt');
	writeFileSync(filePath, Buffer.from(bytes));

	const script = path.join(HERE, 'ppt-com-ole.ps1');
	const result = spawnSync(
		'pwsh',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', filePath],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	const stdout = result.stdout ?? '';
	if (stdout.startsWith('FATAL')) {
		console.error(stdout.trim());
		return 2;
	}
	if (/^FAIL/mu.test(stdout)) {
		console.error(`\nOLE case: file failed to open. Full COM output:\n${stdout}`);
		return 1;
	}

	const expectations = [
		{ re: /^SHAPE 1 type=13 /m, label: 'plain picture (msoPicture)' },
		{ re: /^SHAPE 2 type=7 progid=Package/m, label: 'OLE embed (ProgID=Package)' },
	];
	console.log(`\n${'ole case'.padEnd(28)}verdict`);
	console.log('-'.repeat(90));
	let oleFailures = 0;
	for (const exp of expectations) {
		const ok = exp.re.test(stdout);
		console.log(`${exp.label.padEnd(28)}${ok ? 'OK' : 'FAIL'}`);
		if (!ok) {
			oleFailures++;
		}
	}
	if (oleFailures > 0) {
		console.error(`\nFull COM output:\n${stdout}`);
	}
	console.log(`\n${expectations.length} OLE assertion(s), ${oleFailures} failure(s).`);
	return oleFailures > 0 ? 1 : 0;
}

const oleExit = await runOleCase();
failures += oleExit === 1 ? 1 : 0;
if (oleExit === 2) {
	rmSync(scratch, { recursive: true, force: true });
	process.exit(2);
}

/**
 * Embedded-audio acceptance. See `ppt-com-media.ps1`'s doc comment for why
 * `MediaFormat.Length` is not the assertion: this writes a real WAV
 * (RIFF/WAVE, not silence-only, so a truncated/garbled SoundDataBlob would
 * produce audibly wrong output even though this check only compares bytes),
 * saves as `.ppt`, opens it via a FRESH `PowerPoint.Application` (never the
 * one that wrote it, ruling out any in-process cache), asserts
 * `Shape.Type`/`MediaType`, then has PowerPoint itself `SaveAs` to `.pptx`
 * and asserts the re-exported `ppt/media/*` part is byte-identical to the
 * WAV this test embedded: proof PowerPoint's own importer read the
 * `SoundDataBlob` this writer's exporter never emits on its own (see
 * `packages/core/src/core/ppt/writer/media-writer.ts`'s module doc).
 */
function buildTestWav() {
	const sampleRate = 8000;
	const numSamples = 400; // 50ms
	const dataSize = numSamples * 2;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(dataSize, 40);
	for (let i = 0; i < numSamples; i++) {
		const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
		buf.writeInt16LE(v, 44 + i * 2);
	}
	return buf;
}

async function runMediaCase() {
	const wav = buildTestWav();
	const dataUrl = `data:audio/wav;base64,${wav.toString('base64')}`;
	const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
	const slideBuilder = createSlide('Blank').addMedia('audio', dataUrl, {
		x: 50,
		y: 50,
		width: 200,
		height: 50,
		name: 'TestSound',
	});
	data.slides.push(slideBuilder.build());

	const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
	const filePath = path.join(scratch, 'media.ppt');
	writeFileSync(filePath, Buffer.from(bytes));

	const script = path.join(HERE, 'ppt-com-media.ps1');
	const result = spawnSync(
		'pwsh',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', filePath],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	const stdout = result.stdout ?? '';
	if (stdout.startsWith('FATAL')) {
		console.error(stdout.trim());
		return 2;
	}
	if (/^FAIL/mu.test(stdout)) {
		console.error(`\nmedia case: file failed to open. Full COM output:\n${stdout}`);
		return 1;
	}

	console.log(`\n${'media case'.padEnd(28)}verdict`);
	console.log('-'.repeat(90));
	const checks = [];

	const shapeOk = /^SHAPE \d+ type=16 mediatype=2/mu.test(stdout);
	checks.push(['audio shape (msoMedia, ppMediaTypeSound)', shapeOk]);

	const resavedMatch = /^RESAVED (.+)$/mu.exec(stdout);
	let byteMatchOk = false;
	if (resavedMatch) {
		try {
			const zip = await JSZip.loadAsync(readFileSync(resavedMatch[1].trim()));
			const mediaFiles = Object.keys(zip.files).filter((n) => /^ppt\/media\//u.test(n));
			for (const name of mediaFiles) {
				const reExported = await zip.files[name].async('nodebuffer');
				if (reExported.equals(wav)) {
					byteMatchOk = true;
					break;
				}
			}
		} catch (err) {
			console.error(`  ! could not read resaved .pptx: ${err.message}`);
		}
	}
	checks.push(['re-exported WAV byte-identical', byteMatchOk]);

	let mediaFailures = 0;
	for (const [label, ok] of checks) {
		console.log(`${label.padEnd(40)}${ok ? 'OK' : 'FAIL'}`);
		if (!ok) {
			mediaFailures++;
		}
	}
	if (mediaFailures > 0) {
		console.error(`\nFull COM output:\n${stdout}`);
	}
	console.log(`\n${checks.length} media assertion(s), ${mediaFailures} failure(s).`);
	return mediaFailures > 0 ? 1 : 0;
}

const mediaExit = await runMediaCase();
failures += mediaExit === 1 ? 1 : 0;
if (mediaExit === 2) {
	rmSync(scratch, { recursive: true, force: true });
	process.exit(2);
}

rmSync(scratch, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
