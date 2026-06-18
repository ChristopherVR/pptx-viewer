/**
 * Phase-attribution profiler for the core load/save pipeline.
 *
 * Reproduces, in isolation and with the *same* JSZip / fast-xml-parser
 * configuration the core engine uses, the individual stages of a large-deck
 * load and save so we can attribute wall-clock time to:
 *
 *   - JSZip.loadAsync          (read central directory / inflate index)
 *   - per-part async() text     (DEFLATE inflate of slide XML)
 *   - XMLParser.parse           (fast-xml-parser slide XML -> object tree)
 *   - XMLBuilder.build          (object tree -> XML string; format:true)
 *   - JSZip.generateAsync       (DEFLATE compress the whole package)
 *
 * This does NOT modify core; it imports the same libs and mirrors the
 * engine's parser/builder options so the numbers are representative.
 *
 *   bun packages/core/scripts/perf-profile.ts <path-to.pptx>
 *
 * Generate a fixture first, e.g.:
 *   bun packages/core/scripts/perf-large.ts --mode=xml --targets=100 --runs=1 --keep
 *   bun packages/core/scripts/perf-profile.ts packages/core/.perf-tmp/perf-100mb-xml.pptx
 *
 * @module scripts/perf-profile
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

const MB = 1024 * 1024;

// Mirror PptxRuntimeDependencyFactory.createParser / createBuilder exactly.
const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	processEntities: false,
});
const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	format: true,
});

const fmtMs = (ms: number): string => `${ms.toFixed(0)} ms`;
const pct = (part: number, whole: number): string => `${((part / whole) * 100).toFixed(1)}%`;

async function main(): Promise<void> {
	const path = process.argv[2];
	if (!path) {
		console.error('usage: bun packages/core/scripts/perf-profile.ts <path-to.pptx>');
		process.exit(1);
	}

	const bytes = await Bun.file(path).arrayBuffer();
	console.log(`Profiling ${path} (${(bytes.byteLength / MB).toFixed(1)} MB)\n`);

	// ── Phase 1: open the zip central directory ──
	let t = performance.now();
	const zip = await JSZip.loadAsync(bytes);
	const tOpen = performance.now() - t;

	const slidePaths = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p));

	// ── Phase 2: inflate slide XML text ──
	t = performance.now();
	const xmlTexts: string[] = [];
	for (const p of slidePaths) {
		const f = zip.files[p];
		if (f) {
			xmlTexts.push(await f.async('text'));
		}
	}
	const tInflate = performance.now() - t;
	const totalXmlChars = xmlTexts.reduce((a, s) => a + s.length, 0);

	// ── Phase 3: parse slide XML into object trees ──
	t = performance.now();
	const trees = xmlTexts.map((x) => parser.parse(x) as unknown);
	const tParse = performance.now() - t;

	// ── Phase 4: rebuild XML strings (format:true, as core does) ──
	t = performance.now();
	let rebuiltChars = 0;
	for (const tree of trees) {
		rebuiltChars += (builder.build(tree) as string).length;
	}
	const tBuild = performance.now() - t;

	// ── Phase 5: re-zip the whole package (DEFLATE) ──
	t = performance.now();
	const out = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
	const tZip = performance.now() - t;

	const loadTotal = tOpen + tInflate + tParse;
	console.log(`Slides: ${slidePaths.length}, slide XML chars: ${(totalXmlChars / MB).toFixed(1)}M`);
	console.log('');
	console.log('LOAD-side phases (representative):');
	console.log(
		`  JSZip.loadAsync (open dir)   ${fmtMs(tOpen).padStart(10)}  ${pct(tOpen, loadTotal)}`,
	);
	console.log(
		`  inflate slide XML (text)     ${fmtMs(tInflate).padStart(10)}  ${pct(tInflate, loadTotal)}`,
	);
	console.log(
		`  XMLParser.parse slides       ${fmtMs(tParse).padStart(10)}  ${pct(tParse, loadTotal)}`,
	);
	console.log(`  -- load-ish subtotal         ${fmtMs(loadTotal).padStart(10)}`);
	console.log('');
	console.log('SAVE-side phases (representative):');
	console.log(
		`  XMLBuilder.build (format:1)  ${fmtMs(tBuild).padStart(10)}   (rebuilt ${(rebuiltChars / MB).toFixed(1)}M chars)`,
	);
	console.log(
		`  JSZip.generateAsync DEFLATE  ${fmtMs(tZip).padStart(10)}   (-> ${(out.byteLength / MB).toFixed(1)} MB)`,
	);
	console.log('');
	console.log('Note: these reproduce the libs/options core uses; engine load/save also does');
	console.log('theme/master/layout resolution and element-tree construction on top of parse.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
