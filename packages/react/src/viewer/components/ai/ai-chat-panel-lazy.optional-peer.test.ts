import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as ts from '@typescript/typescript6';
import { rollup } from 'rollup';
import { describe, expect, it } from 'vitest';

/**
 * Regression for issue #143 (and its sibling in `pptx-viewer`): `@ai-sdk/react`
 * is an optional peer (`peerDependenciesMeta['@ai-sdk/react'].optional ===
 * true`), so a consumer who has not installed it gets an empty stub module
 * from their bundler's optional-peer-dependency handling. A STATIC named
 * import of `useChat` from that module (`import { useChat } from
 * '@ai-sdk/react'`) asks Rollup to validate the binding at link time, which
 * fails the CONSUMER's own production build with `"useChat" is not exported`,
 * even though the AI panel is only ever reached once the user opens it.
 *
 * `AiChatPanelLazy.tsx` resolves `useChat` with a dynamic `import()` inside
 * its `React.lazy` factory and threads it down as a prop; `useAiConversation`
 * receives it as a parameter instead of importing the SDK itself. This test
 * reads both files' source directly rather than the built bundle: it is the
 * static `import` declaration that trips Rollup's link-time validation, so
 * asserting on it here is a faithful (and far cheaper) proxy for building the
 * whole package and grepping its dist chunk.
 */
describe('the @ai-sdk/react peer is never statically imported', () => {
	const lazySource = readFileSync(join(import.meta.dirname, 'AiChatPanelLazy.tsx'), 'utf-8');
	const hookSource = readFileSync(
		join(import.meta.dirname, '../../hooks/ai/useAiConversation.ts'),
		'utf-8',
	);

	it('loads useChat through a dynamic import() in AiChatPanelLazy.tsx', () => {
		expect(lazySource).toMatch(/import\(\s*['"]@ai-sdk\/react['"]\s*\)/u);
	});

	it('has no static value import of @ai-sdk/react anywhere in the AI chat panel chunk', () => {
		for (const [label, source] of [
			['AiChatPanelLazy.tsx', lazySource],
			['useAiConversation.ts', hookSource],
		] as const) {
			const staticValueImports = [
				...source.matchAll(/^import\s+(?!type\s).*from\s+['"]@ai-sdk\/react['"]/gmu),
			];
			expect(
				staticValueImports,
				`${label} should not statically import @ai-sdk/react`,
			).toStrictEqual([]);
		}
	});

	it('does not statically import runtime values from the optional ai peer', () => {
		const messagePartsSource = readFileSync(
			join(import.meta.dirname, 'ai-message-parts.ts'),
			'utf-8',
		);
		const staticAiImports = [
			...messagePartsSource.matchAll(/^import\s+(?!type\s).*from\s+['"]ai['"]/gmu),
		];
		expect(
			staticAiImports,
			'AI message helpers must use the shared runtime-free implementation',
		).toStrictEqual([]);
	});

	it('bundles the React and Vue message helpers with an empty optional-ai stub', async () => {
		const sharedUiParts = join(import.meta.dirname, '../../../../../shared/src/ai/ui-parts.ts');
		const plugin = {
			name: 'optional-ai-peer-fixture',
			resolveId(source: string) {
				if (source === 'pptx-viewer-shared/ai') {
					return sharedUiParts;
				}
				if (source === 'ai') {
					return '\0empty-ai-peer';
				}
				return null;
			},
			load(id: string) {
				if (id === '\0empty-ai-peer') {
					return 'export {};';
				}
				return null;
			},
			async transform(code: string, id: string) {
				if (id.endsWith('.ts')) {
					return ts.transpileModule(code, {
						compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
					}).outputText;
				}
				return null;
			},
		};
		const entries = [
			join(import.meta.dirname, 'ai-message-parts.ts'),
			join(import.meta.dirname, '../../../../../vue/src/viewer/composables/ai/message-parts.ts'),
		];
		for (const entry of entries) {
			const bundle = await rollup({ input: entry, plugins: [plugin] });
			try {
				await bundle.generate({ format: 'es' });
			} finally {
				await bundle.close();
			}
		}
	});

	it('confirms the empty ai stub rejects a static named import', async () => {
		const plugin = {
			name: 'optional-ai-peer-negative-control',
			resolveId(source: string) {
				if (source === 'virtual:consumer') {
					return '\0consumer';
				}
				if (source === 'ai') {
					return '\0empty-ai-peer';
				}
				return null;
			},
			load(id: string) {
				if (id === '\0consumer') {
					return "import { isToolUIPart } from 'ai'; console.log(isToolUIPart);";
				}
				if (id === '\0empty-ai-peer') {
					return 'export {};';
				}
				return null;
			},
		};
		await expect(async () => {
			const bundle = await rollup({ input: 'virtual:consumer', plugins: [plugin] });
			try {
				await bundle.generate({ format: 'es' });
			} finally {
				await bundle.close();
			}
		}).rejects.toThrow(/isToolUIPart.*not exported/iu);
	});
});
