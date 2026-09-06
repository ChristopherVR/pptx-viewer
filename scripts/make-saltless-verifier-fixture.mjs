/**
 * Generates the salt-less `p:modifyVerifier` fixtures behind the "Restricted
 * editing" limitation-row removal (w6-f): nothing in `e2e/fixtures/` or
 * `packages/core/src/__tests__/fixtures/` exercised a `p:modifyVerifier` with
 * no `saltData` attribute at all before this wave (`saltData` is optional per
 * ECMA-376 19.2.1.22; core's `verifyModifyPassword` now treats an absent salt
 * as a zero-length one, see that module's doc comment).
 *
 * Every fixture here is built with `createSaltlessModifyVerifierForTesting`
 * (test/fixture-only; real "Set Password to Modify" always writes a salt) and
 * saved through the SDK's own save pipeline, so the `p:modifyVerifier` XML is
 * genuine SDK output, not hand-authored markup.
 *
 * Writes:
 *   - packages/core/src/__tests__/fixtures/modify-verifier-saltless.pptx
 *     (password "open sesame", SHA-512, spinCount 100000: the primary fixture
 *     named in the wave-6 brief)
 *   - packages/core/src/__tests__/fixtures/modify-verifier-saltless-<algo>.pptx
 *     for every other algorithm family this codebase implements a digest for
 *     (SHA-1/256/384, MD5, RIPEMD-160, WHIRLPOOL), same password
 *   - e2e/fixtures/modify-password-saltless.pptx: the SHA-512 fixture again,
 *     for `e2e/modify-password-saltless.spec.ts` (registered in
 *     `fixture-corpus-manifest.ts` as an `e2e`-dir entry; the two files are
 *     byte-identical copies rather than one referenced from two directories,
 *     matching how every other e2e fixture here is a real file under
 *     `e2e/fixtures/`)
 *
 * Re-runnable: bun run scripts/make-saltless-verifier-fixture.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSaltlessModifyVerifierForTesting, PptxHandler } from 'pptx-viewer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const coreFixtureDir = resolve(root, 'packages/core/src/__tests__/fixtures');
const e2eFixtureDir = resolve(root, 'e2e/fixtures');

const PASSWORD = 'open sesame';
const SPIN_COUNT = 100000;

/** One password-protected, one-slide deck saved with a salt-less verifier. */
async function buildDeck(algorithmName) {
	const { handler, data, createSlide } = await PptxHandler.create({
		title: `Salt-less modifyVerifier (${algorithmName})`,
		creator: 'pptx-viewer-sdk',
		initialSlideCount: 0,
	});
	// One visible element: the e2e deck loader waits for a rendered element
	// before it touches the banner, so a blank slide never gets past load.
	data.slides.push(
		createSlide('Blank')
			.setBackground({ type: 'solid', color: '#ffffff' })
			.addText(`Salt-less modifyVerifier (${algorithmName})`, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.build(),
	);
	const verifier = await createSaltlessModifyVerifierForTesting(PASSWORD, {
		algorithmName,
		spinCount: SPIN_COUNT,
	});
	const bytes = await handler.save(data.slides, { modifyVerifier: verifier });
	handler.dispose();
	return bytes;
}

async function writeFixture(dir, filename, bytes) {
	await mkdir(dir, { recursive: true });
	const out = resolve(dir, filename);
	await writeFile(out, bytes);
	console.log(`wrote ${out} (${bytes.byteLength} bytes)`);
}

// The primary fixture (SHA-512), used by both core unit tests and the
// cross-binding e2e spec.
const primary = await buildDeck('SHA-512');
await writeFixture(coreFixtureDir, 'modify-verifier-saltless.pptx', primary);
await writeFixture(e2eFixtureDir, 'modify-password-saltless.pptx', primary);

// One variant per remaining algorithm family this codebase digests, so the
// core round-trip / verification suites have a genuine salt-less fixture for
// each rather than only ever exercising SHA-512.
const OTHER_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'MD5', 'RIPEMD-160', 'WHIRLPOOL'];
for (const algorithmName of OTHER_ALGORITHMS) {
	const bytes = await buildDeck(algorithmName);
	const suffix = algorithmName.toLowerCase().replace(/-/g, '');
	await writeFixture(coreFixtureDir, `modify-verifier-saltless-${suffix}.pptx`, bytes);
}

console.log(`\nAll fixtures use password: ${JSON.stringify(PASSWORD)}, spinCount: ${SPIN_COUNT}`);
