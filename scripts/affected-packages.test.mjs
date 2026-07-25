import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyse, BINDINGS, dependentsOf, TEST_LEGS } from './affected-packages.mjs';

test('a react-only change runs just the react legs', () => {
	const r = analyse(['packages/react/src/viewer/components/Ribbon.tsx']);
	assert.deepEqual(r.testLegs, ['react', 'react18']);
	assert.deepEqual(r.e2eProjects, ['react']);
});

test('react-compat maps onto the react legs', () => {
	const r = analyse(['packages/react-compat/package.json']);
	assert.ok(r.testLegs.includes('react18'));
});

test('a core change fans out to everything', () => {
	const r = analyse(['packages/core/src/core/runtime/parse.ts']);
	assert.deepEqual(r.testLegs, Object.keys(TEST_LEGS));
	assert.deepEqual(r.e2eProjects, BINDINGS);
});

test('a shared change reaches every binding but not core or cli', () => {
	const r = analyse(['packages/shared/src/render/thing.ts']);
	assert.ok(r.testLegs.includes('shared'));
	for (const b of BINDINGS) {
		assert.ok(r.testLegs.includes(b), `expected ${b}`);
	}
	assert.ok(!r.testLegs.includes('core'));
	assert.ok(!r.testLegs.includes('cli'));
});

test('a tools change reaches shared and the bindings', () => {
	// packages/shared imports the MCP registry from packages/tools, which is why
	// a stale tools dist breaks all five demos at once.
	const r = analyse(['packages/tools/src/index.ts']);
	assert.ok(r.testLegs.includes('tools'));
	assert.ok(r.testLegs.includes('shared'));
	assert.ok(r.testLegs.includes('vue'));
});

test('a locales change reaches the bindings', () => {
	const r = analyse(['packages/locales/src/de/index.ts']);
	assert.ok(r.testLegs.includes('locales'));
	assert.ok(r.testLegs.includes('svelte'));
});

test('a docs-only change runs nothing', () => {
	const r = analyse(['docs/guide/index.md', 'README.md', 'CONTRIBUTING.md']);
	assert.deepEqual(r.testLegs, []);
	assert.deepEqual(r.e2eProjects, []);
});

test('an e2e spec change runs every playwright leg but no unit legs', () => {
	const r = analyse(['e2e/viewer-basics.spec.ts']);
	assert.deepEqual(r.e2eProjects, BINDINGS);
	assert.deepEqual(r.testLegs, []);
});

test('a demo change runs only that framework e2e leg', () => {
	const r = analyse(['demos/demo-svelte/src/App.svelte']);
	assert.deepEqual(r.e2eProjects, ['svelte']);
	assert.deepEqual(r.testLegs, []);
});

test('a root config change runs everything', () => {
	for (const file of ['package.json', 'bun.lock', '.oxlintrc.json', 'scripts/x.mjs']) {
		const r = analyse([file]);
		assert.deepEqual(r.testLegs, Object.keys(TEST_LEGS), `expected full matrix for ${file}`);
	}
});

test('an unrecognised path is treated as global, never ignored', () => {
	const r = analyse(['some/new/toplevel/thing.ts']);
	assert.deepEqual(r.testLegs, Object.keys(TEST_LEGS));
	assert.match(r.reason, /global or unrecognised/u);
});

test('inert paths do not drag in the full matrix alongside a scoped change', () => {
	const r = analyse(['README.md', 'packages/vue/src/a.vue']);
	assert.deepEqual(r.testLegs, ['vue']);
});

test('dependentsOf models the real graph direction', () => {
	assert.deepEqual(dependentsOf('core').sort(), [
		'angular',
		'cli',
		'core',
		'locales',
		'react',
		'shared',
		'svelte',
		'tools',
		'vanilla',
		'vue',
	]);
	assert.deepEqual(dependentsOf('react'), ['react']);
});

test('every test leg in the map is reachable from some package', () => {
	// Guards against a leg being added to ci.yml but left unreachable here, which
	// would silently stop it ever running on a PR.
	for (const leg of Object.keys(TEST_LEGS)) {
		const reachable = Object.keys(TEST_LEGS).some(() =>
			analyse(['packages/core/src/x.ts']).testLegs.includes(leg),
		);
		assert.ok(reachable, `${leg} is unreachable`);
	}
});

test('a null or empty file list scopes to nothing rather than crashing', () => {
	// `jq -s 'add'` yields null for a PR with no files; the workflow defaults it
	// to [], but the script must not throw if that guard ever regresses.
	for (const input of [null, undefined, []]) {
		const r = analyse(input);
		assert.deepEqual(r.testLegs, []);
		assert.deepEqual(r.e2eProjects, []);
	}
});
