/**
 * PowerPoint acceptance: does the file we actually produce actually open?
 *
 * ## Why this exists
 *
 * Eight defects that made PowerPoint refuse to open a saved deck shipped under
 * a green suite. Not one of them was reachable from the test suite, because
 * nothing in the repo had ever opened a saved file. Schema reasoning is not a
 * substitute: `c:lblOffset="100%"` is legal by the schema, which even
 * documents it as the default, and PowerPoint rejects it anyway. During the
 * audit this check downgraded one suspected P0 to a P2 and confirmed several
 * others. It outranks every other kind of argument about what is valid.
 *
 * ## What it does
 *
 * For every deck in `packages/core/src/__tests__/integration/fixture-corpus-manifest.ts`:
 *
 *   1. copy the ORIGINAL into a scratch directory;
 *   2. load it through `PptxHandler`, save it unmodified, write the result
 *      beside the original as `<name>.saved.pptx`;
 *   3. hand both to PowerPoint through COM (`scripts/pptx-com-open.ps1`);
 *   4. report, per deck, whether the original opened, whether ours opened, and
 *      whether the slide and shape counts survived.
 *
 * A deck whose ORIGINAL fails is a fixture problem, not a save problem, and is
 * reported separately so the two never get confused. A deck whose original
 * opens and whose saved copy does not is the failure this tool exists to find.
 *
 * PowerPoint can SILENTLY REPAIR a lightly damaged package and still report a
 * successful open, so a matching verdict is not by itself proof. That is why
 * the shape and slide counts are compared too: a repair that drops content
 * shows up as a count regression even when the open succeeded.
 *
 * ## Running it
 *
 *     bun run scripts/com-acceptance.mjs                  # whole manifest
 *     bun run scripts/com-acceptance.mjs solution-explorer # substring filter
 *     bun run scripts/com-acceptance.mjs --genuine        # skip synthetic decks
 *     bun run scripts/com-acceptance.mjs --keep           # keep the scratch dir
 *     bun run scripts/com-acceptance.mjs --graft <part-regex>
 *
 * `--graft` is the attribution mode. Instead of comparing a wholly re-saved
 * package, it grafts only the parts matching `<part-regex>` from our output
 * into the PRISTINE original and opens that. If the grafted package fails,
 * the fault is in those parts and nowhere else. This is how the wave-1 defects
 * were narrowed from "the deck will not open" to a single attribute, by
 * bisecting on part-name patterns such as `slides/slide4` or `charts/`.
 *
 * It is deliberately NOT part of `bun run test`: it needs a local PowerPoint
 * install and drives a real application. Run it after any change to the save
 * pipeline, and always before claiming a corruption bug is fixed.
 *
 * Exit code is 1 on a save regression, on a fixture that broke without being
 * declared `powerpointRejects` in the manifest, or on a declared entry that
 * now opens fine (a stale ledger entry). Otherwise 0.
 *
 * @see packages/core/src/__tests__/integration/fixture-corpus-roundtrip.test.ts
 *      for the automated half, which runs everywhere and gates CI.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const { PptxHandler } = await import(path.join(REPO, 'packages/core/src/index.ts'));
const { default: JSZip } = await import(path.join(REPO, 'node_modules/jszip/lib/index.js'));
const { FIXTURE_MANIFEST, fixturePath } = await import(
	path.join(REPO, 'packages/core/src/__tests__/integration/fixture-corpus-manifest.ts')
);

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const genuineOnly = args.includes('--genuine');
const graftAt = args.indexOf('--graft');
const graftPattern = graftAt >= 0 ? new RegExp(args[graftAt + 1], 'u') : undefined;
const filters = args.filter((a, i) => !a.startsWith('--') && !(graftAt >= 0 && i === graftAt + 1));

const selected = FIXTURE_MANIFEST.filter(
	(entry) =>
		entry.status === 'roundtrip' &&
		(!genuineOnly || entry.provenance !== 'synthetic') &&
		(filters.length === 0 || filters.some((f) => entry.file.includes(f))),
);

if (selected.length === 0) {
	console.error('No fixtures selected.');
	process.exit(1);
}

const scratch = mkdtempSync(path.join(tmpdir(), 'pptx-com-'));
mkdirSync(scratch, { recursive: true });
console.log(`scratch: ${scratch}`);
console.log(
	`${selected.length} deck(s)${graftPattern ? `, grafting parts matching ${graftPattern}` : ''}\n`,
);

const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

/** Save `entry` unmodified; optionally graft only the matching parts back into the original. */
async function produce(entry, originalPath, outPath) {
	const bytes = readFileSync(originalPath);
	const handler = new PptxHandler();
	const loaded = await handler.load(toArrayBuffer(bytes));
	const saved = await handler.save(loaded.slides);

	if (!graftPattern) {
		writeFileSync(outPath, Buffer.from(saved));
		return;
	}
	// Graft-into-pristine isolation: everything except the matched parts comes
	// from the untouched original, so a failure can only be caused by them.
	const base = await JSZip.loadAsync(toArrayBuffer(bytes));
	const donor = await JSZip.loadAsync(saved);
	let grafted = 0;
	for (const name of Object.keys(donor.files)) {
		if (donor.files[name].dir || !graftPattern.test(name)) {
			continue;
		}
		base.file(name, await donor.files[name].async('uint8array'));
		grafted++;
	}
	if (grafted === 0) {
		console.warn(`  ! ${entry.file}: --graft matched no parts`);
	}
	writeFileSync(
		outPath,
		Buffer.from(await base.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })),
	);
}

const jobs = [];
for (const entry of selected) {
	const originalPath = fixturePath(entry);
	const base = entry.file.replace(/\.pptx$/i, '');
	const originalCopy = path.join(scratch, `${base}.original.pptx`);
	const savedCopy = path.join(scratch, `${base}.saved.pptx`);
	copyFileSync(originalPath, originalCopy);
	try {
		await produce(entry, originalPath, savedCopy);
	} catch (err) {
		console.error(`  ! ${entry.file}: save threw: ${err.message}`);
		continue;
	}
	jobs.push({ entry, originalCopy, savedCopy });
}

/** Run the PowerShell opener over every path in one PowerPoint session. */
function openAll(paths) {
	const script = path.join(HERE, 'pptx-com-open.ps1');
	const result = spawnSync(
		'pwsh',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...paths],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	const stdout = result.stdout ?? '';
	if (stdout.startsWith('FATAL')) {
		console.error(stdout.trim());
		console.error('PowerPoint COM is required. This tool is Windows-only and opt-in.');
		process.exit(2);
	}
	const verdicts = new Map();
	for (const line of stdout.split(/\r?\n/)) {
		const ok = /^OK\s+(.+?)\s{2}slides=(\d+) shapes=(\d+)$/.exec(line);
		if (ok) {
			verdicts.set(path.resolve(ok[1]).toLowerCase(), {
				ok: true,
				slides: Number(ok[2]),
				shapes: Number(ok[3]),
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

const verdicts = openAll(jobs.flatMap((j) => [j.originalCopy, j.savedCopy]));
const look = (p) =>
	verdicts.get(path.resolve(p).toLowerCase()) ?? { ok: false, message: 'no verdict' };

const regressions = [];
const newBadFixtures = [];
const knownBadFixtures = [];
const staleLedger = [];

console.log(`${'deck'.padEnd(56)}${'original'.padEnd(22)}ours`);
console.log('-'.repeat(104));
for (const { entry, originalCopy, savedCopy } of jobs) {
	const before = look(originalCopy);
	const after = look(savedCopy);
	const fmt = (v) => (v.ok ? `OK ${v.slides}sl/${v.shapes}sh` : 'FAIL');
	let flag = '';
	if (!before.ok) {
		// A deck the manifest already declares un-openable is a standing debt,
		// not news. One that is NOT declared is a fixture that just broke.
		if (entry.powerpointRejects) {
			knownBadFixtures.push({ entry, message: before.message });
			flag = '   (known-broken fixture, see manifest)';
		} else {
			newBadFixtures.push({ entry, message: before.message });
			flag = '   <-- FIXTURE IS BROKEN BEFORE WE TOUCH IT';
		}
	} else {
		if (entry.powerpointRejects) {
			staleLedger.push(entry);
			flag = '   <-- manifest says PowerPoint rejects this; it does not. Delete powerpointRejects.';
		}
		if (!after.ok) {
			regressions.push({ entry, message: after.message });
			flag = '   <-- OUR SAVE BROKE IT';
		} else if (after.slides !== before.slides || after.shapes !== before.shapes) {
			// A no-edit save must not change what PowerPoint sees. Fewer shapes
			// means loss, or a silent repair that dropped content; more means
			// we duplicated something.
			regressions.push({
				entry,
				message: `shape/slide count changed: ${before.slides}sl/${before.shapes}sh -> ${after.slides}sl/${after.shapes}sh`,
			});
			flag = after.shapes > before.shapes ? '   <-- CONTENT DUPLICATED' : '   <-- CONTENT LOST';
		}
	}
	console.log(`${entry.file.padEnd(56)}${fmt(before).padEnd(22)}${fmt(after)}${flag}`);
}

console.log();
for (const { entry, message } of knownBadFixtures) {
	console.log(`known-broken   ${entry.file}: ${entry.powerpointRejects}`);
	console.log(`               PowerPoint said: ${message}`);
}
for (const { entry, message } of newBadFixtures) {
	console.log(`BROKEN FIXTURE ${entry.file}: ${message}`);
	console.log('               Not declared in the manifest. Repair it, or add powerpointRejects.');
}
for (const entry of staleLedger) {
	console.log(`STALE LEDGER   ${entry.file}: opens fine now; remove powerpointRejects.`);
}
for (const { entry, message } of regressions) {
	console.log(`SAVE REGRESSION ${entry.file}: ${message}`);
}
const counts = [
	`${knownBadFixtures.length} known-broken`,
	`${newBadFixtures.length} newly broken`,
	`${staleLedger.length} stale ledger entr(ies)`,
	`${regressions.length} save regression(s)`,
].join(', ');
console.log(`\n${jobs.length} deck(s): ${counts}.`);

if (keep) {
	console.log(`kept: ${scratch}`);
} else {
	rmSync(scratch, { recursive: true, force: true });
}

process.exit(regressions.length + newBadFixtures.length + staleLedger.length > 0 ? 1 : 0);
