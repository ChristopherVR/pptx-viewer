/** Test the actual npm tarball, without workspace links or development dependencies. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = join(root, 'packages/core');
const consumer = await mkdtemp(join(tmpdir(), 'pptx-core-consumer-'));
const npmCli =
	process.platform === 'win32'
		? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
		: undefined;
function run(command, args, cwd, capture = false) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: 'utf8',
		stdio: capture ? 'pipe' : 'inherit',
		env: { ...process.env, NODE_PATH: '' },
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${command} exited ${result.status}: ${result.stderr ?? ''}`);
	}
	return result.stdout;
}
function npm(args, cwd, capture = false) {
	return run(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, cwd, capture);
}
const packed = JSON.parse(
	npm(['pack', '--ignore-scripts', '--json', '--pack-destination', consumer], core, true),
)[0];
assert(packed.files.some((file) => file.path === 'dist/index.mjs'));
assert(packed.files.some((file) => file.path === 'dist/index.js'));
for (const file of packed.files.filter((entry) =>
	/\.(?:m?js|d\.ts|d\.cts|d\.mts)$/.test(entry.path),
)) {
	const source = await readFile(join(core, file.path), 'utf8');
	assert(
		!/(?:from\s*|import\s*\(|require\s*\()\s*['"]@christophervr\/ole2(?:\/|['"])/.test(source),
		`${file.path} leaks a development-only ole2 import`,
	);
}
await writeFile(
	join(consumer, 'package.json'),
	JSON.stringify({ name: 'pptx-packed-regression', private: true, type: 'module' }),
);
npm(
	[
		'install',
		'--ignore-scripts',
		'--omit=dev',
		'--omit=optional',
		'--no-audit',
		'--no-fund',
		join(consumer, packed.filename),
	],
	consumer,
);
const verification = `
const assert = REQUIRE('node:assert/strict');
const { createRequire } = REQUIRE('node:module');
const resolver = createRequire(process.cwd() + '/consumer.cjs');
assert.throws(() => resolver.resolve('@christophervr/ole2'), { code: 'MODULE_NOT_FOUND' });
const core = LOAD('pptx-viewer-core');
const converter = LOAD('pptx-viewer-core/converter');
assert.equal(typeof converter.PptxMarkdownConverter, 'function');
const { handler, createSlide } = await core.PptxHandler.createBlank({ title: 'Packaged legacy regression' });
const slide = createSlide('Blank').addText('Packed PPT roundtrip', { x: 20, y: 20, width: 400, height: 80, bold: true }).build();
const bytes = await handler.save([slide], { outputFormat: 'ppt' });
assert.deepEqual([...bytes.subarray(0, 8)], [208,207,17,224,161,177,26,225]);
const reopened = await new core.PptxHandler().load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
assert.equal(reopened.slides.length, 1);
assert.ok(reopened.slides[0].elements.some(element => element.text?.includes('Packed PPT roundtrip')));
console.log('Packed core import and legacy PPT export/reload passed.');
`;
await writeFile(
	join(consumer, 'consumer.mjs'),
	verification.replaceAll('REQUIRE(', 'await import(').replaceAll('LOAD(', 'await import('),
);
await writeFile(
	join(consumer, 'consumer.cjs'),
	`(async () => {\n${verification.replaceAll('REQUIRE(', 'require(').replaceAll('LOAD(', 'require(')}\n})().catch(error => { console.error(error); process.exitCode = 1; });`,
);
run(process.execPath, ['consumer.mjs'], consumer);
run(process.execPath, ['consumer.cjs'], consumer);
console.log(`Verified ESM and CommonJS consumers of ${packed.filename}`);
