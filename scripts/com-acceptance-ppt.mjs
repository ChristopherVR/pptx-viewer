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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
rmSync(scratch, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
