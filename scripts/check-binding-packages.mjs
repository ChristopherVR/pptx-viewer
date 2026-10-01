/**
 * Install the npm-packed UI bindings without workspace links and import each
 * public entry from an isolated Node consumer. Run after all package builds.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toPublishManifest, readWorkspacePackages } from './publish-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'pptx-binding-consumer-'));
const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const angularHostPackages = [
	'@angular/common',
	'@angular/compiler',
	'@angular/core',
	'@angular/platform-browser',
].map((name) => `${name}@${rootManifest.dependencies[name]}`);
const packages = [
	{ key: 'core', name: 'pptx-viewer-core', entry: 'PptxHandler' },
	{ key: 'react', name: 'pptx-react-viewer', entry: 'PowerPointViewer' },
	{ key: 'vue', name: 'pptx-vue-viewer', entry: 'PowerPointViewer' },
	{ key: 'angular', name: 'pptx-angular-viewer', entry: 'PowerPointViewerComponent' },
	{ key: 'vanilla', name: 'pptx-vanilla-viewer', entry: 'createPptxViewer' },
	{ key: 'svelte', name: 'pptx-svelte-viewer', entry: 'PowerPointViewer' },
];
const bindings = [...packages.slice(1)];

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
	if (process.platform === 'win32') {
		const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
		return run(process.execPath, [npmCli, ...args], cwd, capture);
	}
	return run('npm', args, cwd, capture);
}

try {
	// The engine lives in the unpublished sibling @christophervr/ooxml-core, which the core package
	// reaches through a `file:` dependency; pack it and point the consumer's resolution at it.
	const packedEngine = JSON.parse(
		npm(
			['pack', '--ignore-scripts', '--json', '--pack-destination', temporary],
			resolve(root, '../ooxml-core'),
			true,
		),
	)[0];
	const tarballs = [];
	const cjsBindings = [];
	for (const target of packages) {
		const sourceDir = join(root, 'packages', target.key);
		const packDir = target.key === 'angular' ? join(sourceDir, 'dist') : sourceDir;
		const packed = JSON.parse(
			npm(
				[
					'pack',
					'--ignore-scripts',
					'--json',
					'--workspaces=false',
					'--pack-destination',
					temporary,
				],
				packDir,
				true,
			),
		)[0];
		const packedPaths = new Set(packed.files.map((file) => file.path));
		const shippedManifest = JSON.parse(readFileSync(join(packDir, 'package.json'), 'utf8'));
		const rootExport = shippedManifest.exports?.['.'];
		const entryFile =
			rootExport?.import ?? rootExport?.default ?? shippedManifest.module ?? shippedManifest.main;
		if (target.key !== 'core' && typeof rootExport?.require === 'string') {
			cjsBindings.push({ name: target.name, entry: target.entry });
		}
		assert.ok(entryFile, `${target.name} has no declared root runtime entry`);
		assert.ok(
			packedPaths.has(entryFile.replace(/^\.\//u, '')),
			`${target.name} npm tarball is missing root entry ${entryFile}`,
		);

		// CI builds from workspace manifests, where publishable runtime workspace
		// dependencies still say workspace:*. Apply the exact release resolver to
		// the extracted npm tarball before repacking it as a consumer-installable
		// artifact. The packed file selection and JS/declaration files stay intact.
		const unpacked = join(temporary, `${target.key}-unpacked`);
		mkdirSync(unpacked);
		run('tar', ['-xzf', join(temporary, packed.filename), '-C', unpacked], temporary);
		const packageDir = join(unpacked, 'package');
		const manifestPath = join(packageDir, 'package.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (target.key === 'angular') {
			assert.ok(
				manifest.peerDependencies?.['@angular/platform-browser'],
				'Angular package declares @angular/platform-browser as a host peer',
			);
		}
		writeFileSync(
			manifestPath,
			`${JSON.stringify(toPublishManifest(manifest, readWorkspacePackages()), null, '\t')}\n`,
		);
		const normalized = JSON.parse(
			npm(
				[
					'pack',
					'--ignore-scripts',
					'--json',
					'--workspaces=false',
					'--pack-destination',
					temporary,
				],
				packageDir,
				true,
			),
		)[0];
		tarballs.push(join(temporary, normalized.filename));
		console.log(`[binding-pack] ${target.name}: packed ${packed.files.length} files`);
	}

	const consumer = join(temporary, 'consumer');
	mkdirSync(consumer);
	writeFileSync(
		join(consumer, 'package.json'),
		JSON.stringify({
			name: 'pptx-binding-packed-consumer',
			private: true,
			type: 'module',
			overrides: { '@christophervr/ooxml-core': `file:${join(temporary, packedEngine.filename)}` },
		}),
	);
	npm(
		[
			'install',
			'--ignore-scripts',
			'--omit=optional',
			'--no-audit',
			'--no-fund',
			'--package-lock=false',
			...angularHostPackages,
			...tarballs,
		],
		consumer,
	);
	const checks = JSON.stringify(bindings.map(({ name, entry }) => ({ name, entry })));
	writeFileSync(
		join(consumer, 'consumer.mjs'),
		`import assert from 'node:assert/strict';
const core = await import('pptx-viewer-core');
assert.equal(typeof core.PptxHandler, 'function', 'packed core exports PptxHandler');
await import('@angular/compiler');
const bindings = ${checks};
const failures = [];
for (const { name, entry } of bindings) {
  try {
    const api = await import(name);
    assert.ok(api[entry], name + ' exports ' + entry);
    console.log(name + ': isolated packed entry imported and exported ' + entry);
  } catch (error) {
    failures.push(name + ': ' + (error?.name ?? 'Error') + ': ' + (error?.message ?? String(error)));
  }
}
if (failures.length) {
  throw new AggregateError(failures.map((message) => new Error(message)), 'Packed binding imports failed');
}
console.log('All five packed binding entry points imported successfully.');
`,
	);
	run(process.execPath, ['consumer.mjs'], consumer);
	writeFileSync(
		join(consumer, 'consumer.cjs'),
		`const assert = require('node:assert/strict');
for (const { name, entry } of ${JSON.stringify(cjsBindings.map(({ name, entry }) => ({ name, entry })))}) {
  const api = require(name);
  assert.ok(api[entry], name + ' CommonJS entry exports ' + entry);
  console.log(name + ': isolated packed CommonJS entry imported and exported ' + entry);
}
`,
	);
	run(process.execPath, ['consumer.cjs'], consumer);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
