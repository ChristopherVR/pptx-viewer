import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Regression for issue #143: `@ai-sdk/svelte` is an optional peer
 * (`peerDependenciesMeta['@ai-sdk/svelte'].optional === true`), so a consumer
 * who has not installed it gets an empty stub module from their bundler's
 * optional-peer-dependency handling. A STATIC named import of `Chat` from
 * that module (`import { Chat } from '@ai-sdk/svelte'`) asks Rollup to
 * validate the binding at link time, which fails the CONSUMER's own
 * production build with `"Chat" is not exported by ".../@ai-sdk/svelte"`,
 * even though this module is only ever reached once the AI panel opens.
 *
 * A dynamic `import()` defers that lookup to runtime, so a consumer who
 * never installs the SDK can still build. This test reads the source
 * directly rather than the built bundle: it is the static `import`
 * declaration that trips Rollup's link-time validation, so asserting on it
 * here is a faithful (and far cheaper) proxy for building the whole package
 * and grepping its dist chunk.
 */
describe('chat.svelte.ts never statically imports @ai-sdk/svelte', () => {
	const source = readFileSync(join(import.meta.dirname, 'chat.svelte.ts'), 'utf-8');

	it('loads the Chat class through a dynamic import()', () => {
		expect(source).toMatch(/await import\(\s*['"]@ai-sdk\/svelte['"]\s*\)/u);
	});

	it('has no static value import of @ai-sdk/svelte', () => {
		const staticValueImports = [
			...source.matchAll(/^import\s+(?!type\s).*from\s+['"]@ai-sdk\/svelte['"]/gmu),
		];
		expect(staticValueImports).toStrictEqual([]);
	});
});
