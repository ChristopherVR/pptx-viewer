import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import {
	decide,
	diffRangeForLine,
	isRelevantPath,
	parseRefLines,
	ZERO_SHA,
} from './pre-push-local-e2e.mjs';

test('isRelevantPath matches the shared export pipeline', () => {
	assert.ok(isRelevantPath('packages/shared/src/export/rasterize-element-tiled-canvas.ts'));
	assert.ok(!isRelevantPath('packages/shared/src/render/text.ts'));
});

test('isRelevantPath matches each binding export area', () => {
	assert.ok(isRelevantPath('packages/react/src/viewer/utils/export-video.ts'));
	assert.ok(isRelevantPath('packages/react/src/viewer/hooks/useExportMediaHandlers.ts'));
	assert.ok(isRelevantPath('packages/vue/src/viewer/composables/useMediaExport.ts'));
	assert.ok(isRelevantPath('packages/vue/src/viewer/composables/useGifExport.ts'));
	assert.ok(isRelevantPath('packages/angular/src/viewer/video-export-helpers.ts'));
	assert.ok(
		isRelevantPath('packages/angular/src/internal/shared-src/export/export-capture-decision.ts'),
	);
	assert.ok(isRelevantPath('packages/svelte/src/viewer/export/export-video.ts'));
	assert.ok(isRelevantPath('packages/vanilla/src/viewer/export/export-video.ts'));
	assert.ok(isRelevantPath('packages/vanilla/src/viewer/export-lifecycle.ts'));
});

test('isRelevantPath matches the spec, its support helper, and the playwright config', () => {
	assert.ok(isRelevantPath('e2e/export-raster-tiling.spec.ts'));
	assert.ok(isRelevantPath('e2e/support/exports.ts'));
	assert.ok(isRelevantPath('playwright.config.ts'));
});

test('isRelevantPath ignores unrelated paths', () => {
	assert.ok(!isRelevantPath('packages/react/src/viewer/components/Ribbon.tsx'));
	assert.ok(!isRelevantPath('README.md'));
	assert.ok(!isRelevantPath('packages/react/src/viewer/utils/export.ts.bak'));
});

test('parseRefLines drops blank lines and splits fields', () => {
	const lines = parseRefLines(
		'refs/heads/main abc123 refs/heads/main def456\n\n  refs/heads/x 111 refs/heads/x 222  \n',
	);
	assert.deepEqual(lines, [
		{
			localRef: 'refs/heads/main',
			localSha: 'abc123',
			remoteRef: 'refs/heads/main',
			remoteSha: 'def456',
		},
		{ localRef: 'refs/heads/x', localSha: '111', remoteRef: 'refs/heads/x', remoteSha: '222' },
	]);
});

test('parseRefLines returns an empty array for empty stdin', () => {
	assert.deepEqual(parseRefLines(''), []);
	assert.deepEqual(parseRefLines('\n'), []);
});

test('diffRangeForLine returns null for a deleted ref (all-zero local sha)', () => {
	const range = diffRangeForLine({
		localRef: 'refs/heads/gone',
		localSha: ZERO_SHA,
		remoteRef: 'refs/heads/gone',
		remoteSha: 'abc123',
	});
	assert.equal(range, null);
});

test('diffRangeForLine falls back to origin/main for a brand-new branch (all-zero remote sha)', () => {
	const range = diffRangeForLine({
		localRef: 'refs/heads/new',
		localSha: 'abc123',
		remoteRef: 'refs/heads/new',
		remoteSha: ZERO_SHA,
	});
	assert.deepEqual(range, { base: 'origin/main', head: 'abc123' });
});

test('diffRangeForLine uses the remote sha as the base for an existing branch', () => {
	const range = diffRangeForLine({
		localRef: 'refs/heads/main',
		localSha: 'def456',
		remoteRef: 'refs/heads/main',
		remoteSha: 'abc123',
	});
	assert.deepEqual(range, { base: 'abc123', head: 'def456' });
});

test('decide is not relevant when no refs are being pushed', () => {
	const result = decide('');
	assert.equal(result.relevant, false);
	assert.match(result.reason, /no refs/u);
});

test('decide is not relevant when nothing in range touches export code', () => {
	const changedFiles = () => ['README.md', 'packages/react/src/viewer/components/Ribbon.tsx'];
	const result = decide('refs/heads/main abc123 refs/heads/main def456\n', { changedFiles });
	assert.equal(result.relevant, false);
	assert.deepEqual(result.files, []);
});

test('decide is relevant when a changed file matches an export pattern', () => {
	const changedFiles = () => ['README.md', 'packages/shared/src/export/video-plan.ts'];
	const result = decide('refs/heads/main abc123 refs/heads/main def456\n', { changedFiles });
	assert.equal(result.relevant, true);
	assert.deepEqual(result.files, ['packages/shared/src/export/video-plan.ts']);
});

test('decide skips a line that deletes a ref without diffing it', () => {
	let called = false;
	const changedFiles = () => {
		called = true;
		return [];
	};
	const result = decide(`refs/heads/gone ${ZERO_SHA} refs/heads/gone abc123\n`, { changedFiles });
	assert.equal(called, false);
	assert.equal(result.relevant, false);
});

test('decide treats an unexpected git failure as relevant (fail safe)', () => {
	const changedFiles = () => {
		throw new Error('unknown revision');
	};
	const result = decide('refs/heads/main abc123 refs/heads/main def456\n', { changedFiles });
	assert.equal(result.relevant, true);
	assert.match(result.reason, /unknown revision/u);
});

test('decide merges changed files across multiple pushed refs', () => {
	const seen = [];
	const changedFiles = (base, head) => {
		seen.push(`${base}...${head}`);
		return base === 'a1' ? ['packages/svelte/src/viewer/export/export-video.ts'] : ['README.md'];
	};
	const input = ['refs/heads/one a2 refs/heads/one a1', 'refs/heads/two b2 refs/heads/two b1'].join(
		'\n',
	);
	const result = decide(input, { changedFiles });
	assert.equal(result.relevant, true);
	assert.deepEqual(seen, ['a1...a2', 'b1...b2']);
});

test('main() run as a CLI process exits non-zero and prints one clear line when stdin is empty', () => {
	assert.throws(
		() => {
			execFileSync(process.execPath, ['scripts/pre-push-local-e2e.mjs'], {
				input: '',
				encoding: 'utf8',
			});
		},
		(error) => {
			assert.equal(error.status, 1);
			assert.match(error.stdout, /skipping local-only e2e/u);
			return true;
		},
	);
});
