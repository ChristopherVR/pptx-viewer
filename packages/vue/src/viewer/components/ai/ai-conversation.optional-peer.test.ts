import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Regression for issue #143 (and its sibling in `pptx-vue-viewer`):
 * `@ai-sdk/vue` is an optional peer (`peerDependenciesMeta['@ai-sdk/vue']
 * .optional === true`), so a consumer who has not installed it gets an empty
 * stub module from their bundler's optional-peer-dependency handling. A
 * STATIC named import of `useChat` from that module (`import { useChat }
 * from '@ai-sdk/vue'`) asks Rollup to validate the binding at link time,
 * which fails the CONSUMER's own production build with `"useChat" is not
 * exported`, even though the AI panel is only ever reached once the user
 * opens it.
 *
 * `AiConversation.vue` resolves `useChat` with a top-level `await
 * import(...)` in its `<script setup>` (Vue's compiler wraps this with
 * `withAsyncContext`, preserving the active component instance across the
 * await) and passes it into `useAiConversation` as a parameter instead of
 * the composable importing the SDK itself. This test reads both files'
 * source directly rather than the built bundle: it is the static `import`
 * declaration that trips Rollup's link-time validation, so asserting on it
 * here is a faithful (and far cheaper) proxy for building the whole package
 * and grepping its dist chunk.
 */
describe('the @ai-sdk/vue peer is never statically imported', () => {
	const componentSource = readFileSync(join(import.meta.dirname, 'AiConversation.vue'), 'utf-8');
	const composableSource = readFileSync(
		join(import.meta.dirname, '../../composables/ai/useAiConversation.ts'),
		'utf-8',
	);

	it('loads useChat through a dynamic import() in AiConversation.vue', () => {
		expect(componentSource).toMatch(/await import\(\s*['"]@ai-sdk\/vue['"]\s*\)/u);
	});

	it('has no static value import of @ai-sdk/vue anywhere in the AI chat panel chunk', () => {
		for (const [label, source] of [
			['AiConversation.vue', componentSource],
			['useAiConversation.ts', composableSource],
		] as const) {
			const staticValueImports = [
				...source.matchAll(/^import\s+(?!type\s).*from\s+['"]@ai-sdk\/vue['"]/gmu),
			];
			expect(staticValueImports, `${label} should not statically import @ai-sdk/vue`).toStrictEqual(
				[],
			);
		}
	});
});
