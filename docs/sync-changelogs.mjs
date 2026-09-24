#!/usr/bin/env node
/**
 * Copies each package's generated CHANGELOG.md into docs/releases/<key>.md so
 * the docs site serves per-package release notes. Runs before `vitepress dev`
 * and `vitepress build` (see package.json scripts). The generated pages are
 * gitignored; docs/releases/index.md is the only committed page.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DOCS, '..');

const PACKAGES = [
	{ key: 'core', dir: 'packages/core', npm: 'pptx-viewer-core' },
	{ key: 'react', dir: 'packages/react', npm: 'pptx-react-viewer' },
	{ key: 'vue', dir: 'packages/vue', npm: 'pptx-vue-viewer' },
	{ key: 'angular', dir: 'packages/angular', npm: 'pptx-angular-viewer' },
	{ key: 'vanilla', dir: 'packages/vanilla', npm: 'pptx-vanilla-viewer' },
	{ key: 'svelte', dir: 'packages/svelte', npm: 'pptx-svelte-viewer' },
	{ key: 'mcp', dir: 'packages/tools', npm: 'pptx-viewer-mcp' },
	{ key: 'cli', dir: 'packages/cli', npm: '@christophervr/pptx-viewer' },
];

/**
 * Changelog lines come from commit subjects, which sometimes name an element
 * (e.g. "render through <pptx-three-view>"). VitePress compiles markdown as a
 * Vue template, so a bare tag there fails the docs build ("Element is missing
 * end tag"). Escape `<` before a tag name outside inline code spans; the
 * changelogs themselves are prepend-only and must not be rewritten.
 */
function escapeBareTags(markdown) {
	return markdown
		.split('\n')
		.map((line) =>
			line
				.split(/(`[^`]*`)/u)
				.map((part, index) => (index % 2 === 1 ? part : part.replace(/<(?=\/?[A-Za-z])/gu, '&lt;')))
				.join(''),
		)
		.join('\n');
}

mkdirSync(join(DOCS, 'releases'), { recursive: true });

for (const { key, dir, npm } of PACKAGES) {
	// Keep everything from the first release heading onward; the changelog's own
	// H1 + preamble are replaced by the page header below.
	let body = '';
	try {
		const raw = readFileSync(join(ROOT, dir, 'CHANGELOG.md'), 'utf8');
		const first = raw.indexOf('\n## ');
		body = first === -1 ? '' : escapeBareTags(raw.slice(first + 1));
	} catch {
		body = '_No releases yet._\n';
	}
	const page = `---
title: '${npm} changelog'
---

# \`${npm}\`

Release notes for [${npm} on npm](https://www.npmjs.com/package/${npm}),
generated from Conventional Commits by the release pipeline.

${body}`;
	writeFileSync(join(DOCS, 'releases', `${key}.md`), page);
}

console.log(`Synced ${PACKAGES.length} changelog page(s) into docs/releases/`);
