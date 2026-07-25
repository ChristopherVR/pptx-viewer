// node:test, not vitest: these are repo tooling tests that run without a vitest
// project (`bun run test:scripts`). Importing from 'vitest' here meant the root
// `test:e2e-contract` script could never run this file.
import assert from 'node:assert';
import { test } from 'node:test';

import { isProductSpec, scanSource } from './check-e2e-neutrality.mjs';

test('allows benign project-name use for artifact and room isolation', () => {
	const source = `
		test('artifact', async ({ page }, testInfo) => {
			const roomId = \`e2e-\${testInfo.project.name}-\${Date.now()}\`;
			await page.screenshot({ path: \`result-\${testInfo.project.name}.png\` });
			return roomId;
		});
	`;
	assert.deepEqual(scanSource(source), []);
});

test('rejects direct, aliased, and multiline project conditionals', () => {
	const source = `
		const framework = testInfo.project.name;
		if (
			framework === 'react' ||
			framework === 'vue'
		) runFrameworkPath();
		const control = projectName === 'svelte' ? first : second;
	`;
	const rules = scanSource(source).map((violation) => violation.rule);
	assert.deepEqual(rules, ['project-conditional', 'project-conditional']);
});

test('rejects demo ports outside the reference-comparison spec', () => {
	const violations = scanSource(`page.goto('http://localhost:4176/');`);
	assert.equal(violations.length, 1);
	assert.equal(violations[0].rule, 'demo-port');
});

test('rejects framework-specific selector prefixes but ignores comments', () => {
	const source = `
		// page.locator('.pptx-vue-comment-only');
		const selector = '.pptx-svelte-mobile-sheet';
		page.locator(selector);
		root.querySelector('pptx-presentation-transition-overlay');
	`;
	const rules = scanSource(source).map((violation) => violation.rule);
	assert.deepEqual(rules, ['framework-selector', 'framework-selector']);
});

test('reference spec exemption is limited to project and port orchestration', () => {
	const source = `
		if (projectName === 'react') page.goto('http://localhost:4173/');
		page.locator('.pptx-react-transition-overlay');
	`;
	const violations = scanSource(source, 'ribbon-tab-parity.spec.ts');
	assert.equal(violations.length, 1);
	assert.equal(violations[0].rule, 'framework-selector');
});

test('capture specs are excluded from the product scan', () => {
	assert.equal(isProductSpec('viewer-basics.spec.ts'), true);
	assert.equal(isProductSpec('capture-user-guide-assets.spec.ts'), false);
	assert.equal(isProductSpec('fixture.ts'), false);
});
