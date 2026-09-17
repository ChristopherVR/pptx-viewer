/**
 * Host documents and viewer-created shared types must use the same Yjs runtime.
 * Check actual package output: source-based demos cannot detect a bundled copy.
 * Usage: node scripts/check-published-yjs.mjs [react vue angular vanilla svelte]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BINDINGS = ['react', 'vue', 'angular', 'vanilla', 'svelte'];

export function inspectYjsRuntime(source) {
	return {
		// Yjs deliberately emits this sentinel to diagnose constructor mismatches.
		bundled: source.includes('Yjs was already imported.'),
		external: /(?:from\s+|import\s*\(|require\s*\()\s*["']yjs["']/u.test(source),
	};
}

export function checkDist(directory) {
	const files = readdirSync(directory, { recursive: true }).filter((file) =>
		/\.(?:c|m)?js$/u.test(file),
	);
	const bundled = [];
	let external = false;
	for (const file of files) {
		const result = inspectYjsRuntime(readFileSync(join(directory, file), 'utf8'));
		if (result.bundled) {
			bundled.push(file);
		}
		external ||= result.external;
	}
	return { scanned: files.length, bundled, external };
}

export function main() {
	const requested = process.argv.slice(2);
	for (const binding of requested.length ? requested : BINDINGS) {
		if (!BINDINGS.includes(binding)) {
			throw new Error(`Unknown binding: ${binding}`);
		}
		const result = checkDist(resolve(ROOT, 'packages', binding, 'dist'));
		if (result.bundled.length || !result.external) {
			console.error(
				`[check-published-yjs] ${binding}: keep yjs external; bundled files: ${result.bundled.join(', ') || 'none'}; external reference: ${result.external}.`,
			);
			process.exitCode = 1;
		} else {
			console.log(
				`[check-published-yjs] ${binding}: ${result.scanned} JavaScript files, external Yjs, no bundled runtime.`,
			);
		}
	}
}

if (process.argv[1]?.endsWith('check-published-yjs.mjs')) {
	main();
}
