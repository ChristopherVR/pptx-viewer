import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('a dictionary-only change re-releases every viewer containing it', () => {
	const root = mkdtempSync(join(tmpdir(), 'pptx-locale-release-'));
	const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
	const write = (path, value) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), value);
	};
	try {
		git('init', '-q');
		git('config', 'user.name', 'Release Test');
		git('config', 'user.email', 'release-test@example.com');
		const names = {
			core: 'pptx-viewer-core',
			react: 'pptx-react-viewer',
			vue: 'pptx-vue-viewer',
			angular: 'pptx-angular-viewer',
			vanilla: 'pptx-vanilla-viewer',
			svelte: 'pptx-svelte-viewer',
			tools: 'pptx-viewer-mcp',
			cli: '@christophervr/pptx-viewer',
		};
		for (const [key, name] of Object.entries(names)) {
			write(`packages/${key}/package.json`, JSON.stringify({ name, version: '1.0.0' }));
		}
		write('packages/locales/src/zh-CN/index.ts', 'export const translationsZhCN = {};\n');
		mkdirSync(join(root, 'scripts'));
		copyFileSync(
			fileURLToPath(new URL('./release-plan.mjs', import.meta.url)),
			join(root, 'scripts/release-plan.mjs'),
		);
		git('add', '.');
		git('commit', '-qm', 'chore: initial release');
		for (const name of Object.values(names)) {
			git('tag', `${name}@1.0.0`);
		}
		write(
			'packages/locales/src/zh-CN/index.ts',
			"export const translationsZhCN = { 'pptx.common.ok': '确定' };\n",
		);
		git('add', '.');
		git('commit', '-qm', 'fix(i18n): correct Chinese confirmation label');
		execFileSync(process.execPath, ['scripts/release-plan.mjs', '--no-npm'], {
			cwd: root,
			stdio: 'pipe',
			env: { ...process.env, GITHUB_OUTPUT: '' },
		});
		const plan = JSON.parse(readFileSync(join(root, 'release-plan.json'), 'utf8'));
		for (const binding of ['react', 'vue', 'angular', 'vanilla', 'svelte']) {
			assert.equal(plan.packages[binding].release, true, binding);
			assert.equal(plan.packages[binding].version, '1.0.1', binding);
			assert.ok(plan.packages[binding].includePaths.includes('packages/locales/**'));
		}
		assert.equal(plan.packages.core.release, false);
		assert.equal(plan.packages.tools.release, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
