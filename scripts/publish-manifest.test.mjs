/**
 * Regression tests for issue #129: pptx-react-viewer@2.4.0 (and its Vue /
 * Svelte / Vanilla siblings) shipped `"pptx-viewer-mcp": "workspace:*"` in
 * `dependencies`. `npm publish` uploads the manifest verbatim, so every install
 * of those versions failed:
 *
 *   error: Workspace dependency "pptx-viewer-mcp" not found
 *
 * Two independent guards below:
 *   1. the resolver itself behaves (unit tests),
 *   2. neither the workflow nor the checked-in manifests can drift back:
 *      every `npm publish` in release.yml must be preceded by the resolver, and
 *      every publishable package must resolve cleanly as it stands on disk.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	ALL_DEP_FIELDS,
	isWorkspaceRange,
	readWorkspacePackages,
	resolveWorkspaceRange,
	RUNTIME_DEP_FIELDS,
	toPublishManifest,
} from './publish-manifest.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

const WORKSPACE = new Map([
	['pptx-viewer-core', { version: '2.0.4', private: false }],
	['pptx-viewer-mcp', { version: '2.0.1', private: false }],
	['pptx-viewer-shared', { version: '0.1.0', private: true }],
]);

test('the exact issue #129 manifest resolves to an installable one', () => {
	const out = toPublishManifest(
		{
			name: 'pptx-viewer',
			version: '0.0.0',
			dependencies: { clsx: '^2.1.1', 'pptx-viewer-mcp': 'workspace:*' },
			devDependencies: { 'pptx-viewer-core': 'workspace:*', typescript: '^6.0.3' },
		},
		WORKSPACE,
		{ name: 'pptx-react-viewer', version: '2.4.1' },
	);

	assert.equal(out.name, 'pptx-react-viewer');
	assert.equal(out.version, '2.4.1');
	assert.equal(out.dependencies['pptx-viewer-mcp'], '^2.0.1');
	// Untouched third-party ranges and non-workspace devDeps survive.
	assert.equal(out.dependencies.clsx, '^2.1.1');
	assert.equal(out.devDependencies.typescript, '^6.0.3');
	// Internal build wiring is dropped: it is bundled into dist, not installed.
	assert.ok(!('pptx-viewer-core' in out.devDependencies));
});

test('the input manifest is not mutated', () => {
	const input = { name: 'x', dependencies: { 'pptx-viewer-mcp': 'workspace:*' } };
	toPublishManifest(input, WORKSPACE, { version: '9.9.9' });
	assert.equal(input.dependencies['pptx-viewer-mcp'], 'workspace:*');
	assert.equal(input.version, undefined);
});

test('every workspace range form resolves', () => {
	assert.equal(resolveWorkspaceRange('workspace:*', '1.2.3'), '^1.2.3');
	assert.equal(resolveWorkspaceRange('workspace:^', '1.2.3'), '^1.2.3');
	assert.equal(resolveWorkspaceRange('workspace:~', '1.2.3'), '~1.2.3');
	assert.equal(resolveWorkspaceRange('workspace:>=1.0.0', '1.2.3'), '>=1.0.0');
	assert.ok(isWorkspaceRange('workspace:*'));
	assert.ok(!isWorkspaceRange('^2.0.1'));
});

test('peer and optional dependencies resolve too', () => {
	const out = toPublishManifest(
		{
			name: 'x',
			peerDependencies: { 'pptx-viewer-core': 'workspace:^' },
			optionalDependencies: { 'pptx-viewer-mcp': 'workspace:~' },
		},
		WORKSPACE,
	);
	assert.equal(out.peerDependencies['pptx-viewer-core'], '^2.0.4');
	assert.equal(out.optionalDependencies['pptx-viewer-mcp'], '~2.0.1');
});

test('a runtime dep on a PRIVATE workspace package is rejected', () => {
	// pptx-viewer-shared is never published; resolving it to ^0.1.0 would produce
	// a manifest that installs from npm and then 404s.
	assert.throws(
		() =>
			toPublishManifest(
				{ name: 'x', dependencies: { 'pptx-viewer-shared': 'workspace:*' } },
				WORKSPACE,
			),
		/private/u,
	);
});

test('a runtime dep on an unknown workspace package is rejected', () => {
	assert.throws(
		() => toPublishManifest({ name: 'x', dependencies: { nope: 'workspace:*' } }, WORKSPACE),
		/not a workspace package/u,
	);
});

test('a workspace package without a version is rejected', () => {
	assert.throws(
		() =>
			toPublishManifest(
				{ name: 'x', dependencies: { 'no-version': 'workspace:*' } },
				new Map([['no-version', { private: false }]]),
			),
		/has no version/u,
	);
});

/** Publishable = a `packages/*` manifest that is not marked private. */
function publishablePackages() {
	const found = [];
	for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		let pkg;
		try {
			pkg = JSON.parse(readFileSync(join(PACKAGES_DIR, entry.name, 'package.json'), 'utf8'));
		} catch {
			continue;
		}
		if (pkg.name && pkg.private !== true) {
			found.push([entry.name, pkg]);
		}
	}
	return found;
}

test('every publishable package resolves to a workspace-free manifest', () => {
	const workspacePackages = readWorkspacePackages(PACKAGES_DIR);
	const publishable = publishablePackages();
	// core, react, vue, angular, svelte, vanilla, tools, cli.
	assert.ok(
		publishable.length >= 8,
		`expected the 8 published packages, saw ${publishable.length}`,
	);

	for (const [dir, pkg] of publishable) {
		const out = toPublishManifest(pkg, workspacePackages);
		for (const field of ALL_DEP_FIELDS) {
			for (const [dep, range] of Object.entries(out[field] ?? {})) {
				assert.ok(
					!isWorkspaceRange(range),
					`packages/${dir}: ${field}["${dep}"] would publish as "${range}"`,
				);
			}
		}
	}
});

test('no publishable package declares a runtime dep on a private workspace package', () => {
	const workspacePackages = readWorkspacePackages(PACKAGES_DIR);
	for (const [dir, pkg] of publishablePackages()) {
		for (const field of RUNTIME_DEP_FIELDS) {
			for (const dep of Object.keys(pkg[field] ?? {})) {
				assert.ok(
					!workspacePackages.get(dep)?.private,
					`packages/${dir}: ${field}["${dep}"] is a private workspace package; ` +
						'bundle it into dist and move it to devDependencies',
				);
			}
		}
	}
});

test('a change to the resolver re-releases every package', () => {
	// The resolver lives in scripts/, which is outside every packages/* dir, so
	// the release planner would skip all eight packages and a fix would never
	// reach npm. GLOBAL_TRIGGERS is what closes that loop.
	const plan = readFileSync(join(REPO_ROOT, 'scripts/release-plan.mjs'), 'utf8');
	const declared = plan.match(/const GLOBAL_TRIGGERS = \[([^\]]*)\]/u);
	assert.ok(declared, 'release-plan.mjs must declare GLOBAL_TRIGGERS');
	assert.match(declared[1], /'scripts\/publish-manifest\.mjs'/u);
	assert.match(plan, /viaGlobal/u, 'GLOBAL_TRIGGERS must feed the release decision');
});

test('every npm publish in release.yml resolves its manifest first', () => {
	// The original bug was not a bad manifest, it was a publish path that never
	// rewrote one. Splitting the publish step on the shell `case` terminator
	// gives one segment per package; each that publishes must also resolve.
	const workflow = readFileSync(join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');
	const segments = workflow.split(';;');
	const publishing = segments.filter((segment) => /\bnpm publish\b/u.test(segment));

	assert.equal(publishing.length, 8, 'expected one publish arm per published package');
	for (const segment of publishing) {
		const publishLine = segment.match(/.*npm publish.*/u)[0].trim();
		assert.match(
			segment,
			/publish-manifest\.mjs/u,
			`publish arm runs "${publishLine}" without scripts/publish-manifest.mjs`,
		);
	}
});
