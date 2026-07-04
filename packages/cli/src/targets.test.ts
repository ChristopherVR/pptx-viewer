import { describe, expect, it } from 'vitest';

import { TARGETS } from './targets';

describe('targets', () => {
	it('has a unique, lowercase id per target', () => {
		const ids = TARGETS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toBe(id.toLowerCase());
		}
	});

	it('lists at least one package for every target', () => {
		for (const target of TARGETS) {
			expect(target.packages.length).toBeGreaterThan(0);
		}
	});

	it('the core target has no companion packages beyond itself', () => {
		const core = TARGETS.find((t) => t.id === 'core');
		expect(core?.packages).toStrictEqual(['pptx-viewer-core']);
	});

	it('the mcp target prints config instead of installing', () => {
		const mcp = TARGETS.find((t) => t.id === 'mcp');
		expect(mcp?.mode).toBe('print-config');
	});

	it('every UI framework target has a compat check and a scaffold recipe', () => {
		for (const id of ['react', 'vue', 'angular']) {
			const target = TARGETS.find((t) => t.id === id);
			expect(target?.compat).toBeDefined();
			expect(target?.scaffold).toBeDefined();
			expect(target?.scaffold?.entryCandidates.length).toBeGreaterThan(0);
		}
	});

	it('core and mcp have no compat check or scaffold recipe', () => {
		for (const id of ['core', 'mcp']) {
			const target = TARGETS.find((t) => t.id === id);
			expect(target?.compat).toBeUndefined();
			expect(target?.scaffold).toBeUndefined();
		}
	});

	it('react, vue, and angular share the same exclusive group', () => {
		const groups = ['react', 'vue', 'angular'].map((id) => TARGETS.find((t) => t.id === id)?.group);
		expect(groups.every((g) => g !== undefined)).toBeTruthy();
		expect(new Set(groups).size).toBe(1);
	});

	it('core and mcp have no exclusive group', () => {
		for (const id of ['core', 'mcp']) {
			expect(TARGETS.find((t) => t.id === id)?.group).toBeUndefined();
		}
	});

	it('the react and vue vite scaffolds opt out of create-vite prompting and auto-starting a dev server', () => {
		for (const id of ['react', 'vue']) {
			const target = TARGETS.find((t) => t.id === id);
			const args = target?.scaffold?.args('my-app') ?? [];
			expect(args).toContain('--no-interactive');
			expect(args).toContain('--no-immediate');
		}
	});

	it('every scaffold recipe passes the project directory as its first arg', () => {
		for (const id of ['react', 'vue', 'angular']) {
			const target = TARGETS.find((t) => t.id === id);
			const args = target?.scaffold?.args('my-app') ?? [];
			const dirArgIndex = id === 'angular' ? 1 : 0;
			expect(args[dirArgIndex]).toBe('my-app');
		}
	});

	it('the angular scaffold skips install and opts out of interactive prompts (e.g. the SSR x-prompt)', () => {
		const angular = TARGETS.find((t) => t.id === 'angular');
		const args = angular?.scaffold?.args('my-app') ?? [];
		expect(args).toContain('--skip-install');
		expect(args).toContain('--no-interactive');
	});

	it('every scaffold entryContent and nextSteps import styles via the .css-suffixed subpath', () => {
		// The extension-less `/styles` alias isn't matched by Vite's ambient
		// `declare module '*.css'`, so `vue-tsc -b`/`tsc -b` fails on a fresh
		// scaffold's very first build unless the import literally ends in `.css`.
		for (const id of ['react', 'vue', 'angular']) {
			const target = TARGETS.find((t) => t.id === id);
			const bareImport = `${target?.packages[0]}/styles';`;
			const cssImport = `${target?.packages[0]}/styles.css';`;

			expect(target?.scaffold?.entryContent).not.toContain(bareImport);
			expect(target?.nextSteps).not.toContain(bareImport);
			expect(target?.nextSteps).toContain(cssImport);
		}

		// React and Vue wire the style import into the scaffolded entry file itself;
		// Angular's starter component has no direct style import to patch.
		for (const id of ['react', 'vue']) {
			const target = TARGETS.find((t) => t.id === id);
			expect(target?.scaffold?.entryContent).toContain(`${target?.packages[0]}/styles.css';`);
		}
	});
});
