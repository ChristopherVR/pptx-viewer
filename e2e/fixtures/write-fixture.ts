/**
 * Deterministic fixture writer shared by every `generate-*-fixture.ts`.
 *
 * The generators are re-run by `global-setup.ts` on every Playwright run, and
 * JSZip stamps each zip entry with `new Date()` at generation time, so a
 * content-identical fixture still came out byte-different on every run and the
 * committed `.pptx` files showed up as perpetually modified in `git status`.
 *
 * This helper normalizes the package before writing: entries are re-added in
 * sorted order with a fixed timestamp, a fixed platform, and a fixed DEFLATE
 * level, so the same logical deck always produces the same bytes. When the
 * result matches what is already on disk the write is skipped entirely,
 * keeping the working tree clean. A genuine generator change still surfaces
 * as a real, reviewable fixture diff.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// JSZip is a dependency of `pptx-viewer-core` (bundled, not re-exported) and
// not a direct dependency of the e2e harness; resolve it from the core
// package's own resolution scope, same as the generators do.
import type JSZipType from 'jszip';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

/** Fixed timestamp applied to every zip entry (zip dates are cosmetic here). */
const FIXED_DATE = new Date(Date.UTC(2000, 0, 1));

/** Fixed W3CDTF stamp for docProps/core.xml created/modified. */
const FIXED_W3CDTF = '2000-01-01T00:00:00Z';

/**
 * The core save pipeline stamps `dcterms:created`/`dcterms:modified` with the
 * wall-clock save time; pin both so regeneration is reproducible.
 */
function normalizeCoreProps(xml: string): string {
	return xml.replace(
		/(<dcterms:(created|modified)\b[^>]*>)[^<]*(<\/dcterms:\2>)/gu,
		`$1${FIXED_W3CDTF}$3`,
	);
}

/**
 * Rewrite `bytes` as a canonical zip (sorted entries, fixed dates, fixed
 * compression) and write it to `outPath` unless the file already holds
 * exactly those bytes.
 */
export async function writeFixtureDeterministic(outPath: string, bytes: Uint8Array): Promise<void> {
	const source = await JSZip.loadAsync(bytes);

	const names = Object.keys(source.files)
		.filter((name) => !source.files[name].dir)
		.sort();

	const canonical = new JSZip();
	for (const name of names) {
		if (name === 'docProps/core.xml') {
			const xml = normalizeCoreProps(await source.files[name].async('string'));
			canonical.file(name, xml, { date: FIXED_DATE, createFolders: false });
			continue;
		}
		const content = await source.files[name].async('uint8array');
		canonical.file(name, content, { binary: true, date: FIXED_DATE, createFolders: false });
	}

	const output = await canonical.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 9 },
		platform: 'DOS',
	});

	if (existsSync(outPath)) {
		const existing = readFileSync(outPath);
		if (existing.length === output.length && existing.equals(Buffer.from(output))) {
			return;
		}
	}
	writeFileSync(outPath, output);
}
