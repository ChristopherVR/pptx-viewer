#!/usr/bin/env node
// `vite build` compiles every Vue SFC's `<style scoped>` block into
// dist/pptx-vue-viewer.css, each rule tagged with a `[data-v-xxxxxxxx]`
// attribute selector. The build then runs `@tailwindcss/cli` to recompile the
// SAME output path from scratch (from src/styles/pptx-vue-viewer.css, to
// expand Tailwind utility classes), which has no knowledge of those scoped
// rules and overwrites them out of existence. Every hand-written
// `<style scoped>` rule across all SFCs (selection/resize handles, the
// presentation toolbar and annotation overlay, ...) silently vanished from the
// shipped package - see issue #196.
//
// Fix: snapshot the `[data-v-*]` rules from Vite's compiled CSS before the
// Tailwind pass ("save"), then append them back after it ("merge"), so the
// Tailwind CLI's rewrite adds utilities instead of destroying scoped styles.
//
// Usage:
//   node vue-css-merge.mjs save  <cssPath>   (run right after `vite build`)
//   node vue-css-merge.mjs merge <cssPath>   (run right after the Tailwind CLI pass)
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

/**
 * Split `css` into top-level blocks (each: everything from a selector/at-rule
 * up to its balanced closing `}`), tracking brace depth rather than assuming
 * one rule per line - the Tailwind/esbuild output is minified to a single
 * line. Good enough for machine-generated CSS with no braces inside string
 * literals, which is what Vite emits here.
 */
function splitTopLevelBlocks(css) {
	const blocks = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < css.length; i += 1) {
		const ch = css[i];
		if (ch === '{') {
			depth += 1;
		} else if (ch === '}') {
			depth -= 1;
			if (depth === 0) {
				blocks.push(css.slice(start, i + 1));
				start = i + 1;
			}
		}
	}
	return blocks;
}

export function extractScopedBlocks(css) {
	return splitTopLevelBlocks(css)
		.filter((block) => block.includes('data-v-'))
		.join('\n');
}

/** Merge the Tailwind-recompiled CSS with the snapshotted scoped rules. Throws if either would ship empty-handed. */
export function mergeScopedCss(tailwindCss, scoped) {
	const merged = `${tailwindCss}\n${scoped}`;
	// Guard against a repeat of issue #196: if this ever comes back empty (a
	// Vue/Tailwind upgrade changes how scoped attrs are emitted, a config
	// change reintroduces the overwrite, ...), every `<style scoped>` rule in
	// every SFC silently vanishes from the shipped package again. Fail loudly
	// instead of shipping unstyled selection handles, presentation toolbar, etc.
	if (!merged.includes('data-v-')) {
		throw new Error(
			'[vue-css-merge] merged CSS has no [data-v-*] scoped rules - the SFC ' +
				'<style scoped> blocks were lost. Refusing to ship (see issue #196).',
		);
	}
	return merged;
}

function main() {
	const [, , mode, cssPath] = process.argv;
	const snapshotPath = `${cssPath}.vue-scoped-snapshot`;

	if (mode === 'save') {
		const scoped = extractScopedBlocks(readFileSync(cssPath, 'utf8'));
		writeFileSync(snapshotPath, scoped);
		console.log(`[vue-css-merge] saved ${scoped.length} bytes of scoped SFC CSS`);
	} else if (mode === 'merge') {
		if (!existsSync(snapshotPath)) {
			throw new Error(
				`[vue-css-merge] missing snapshot at ${snapshotPath}; did the "save" step run first?`,
			);
		}
		const scoped = readFileSync(snapshotPath, 'utf8');
		const tailwindCss = readFileSync(cssPath, 'utf8');
		const merged = mergeScopedCss(tailwindCss, scoped);
		writeFileSync(cssPath, merged);
		unlinkSync(snapshotPath);
		console.log(`[vue-css-merge] merged ${scoped.length} bytes of scoped SFC CSS back in`);
	} else {
		throw new Error('usage: node vue-css-merge.mjs <save|merge> <cssPath>');
	}
}

if (process.argv[1]?.endsWith('vue-css-merge.mjs')) {
	main();
}
