/**
 * React 18 compatibility run of the React package's own test suite.
 *
 * `pptx-react-viewer` declares `react`/`react-dom` as `^18.2.0 || ^19.0.0`
 * peers (issue #105). The default `vitest.config.ts` run exercises the suite
 * against the workspace's React 19; this config re-runs the identical specs
 * with `react` and `react-dom` aliased onto the React 18 pair owned by the
 * private `packages/react-compat` workspace, so a React-19-only API sneaking
 * into `src/` fails CI instead of shipping to React 18 consumers.
 *
 * Why a separate workspace package rather than `npm:react@18` aliases here:
 * bun resolves `react-dom`'s `react` PEER from the depending package's scope.
 * Under an alias the peer name never matches, so react-dom@18 would be paired
 * with the workspace's react@19 and die on the renamed `__SECRET_INTERNALS_*`
 * fields. `packages/react-compat` depends on the real `react`/`react-dom` at
 * 18.3.1, which makes bun install a correctly paired copy.
 *
 * The aliases must be regex-anchored: Vite's object-form alias does PREFIX
 * matching, so a plain `react` key would also rewrite `react-dom`,
 * `react-i18next`, `react-icons`, ...
 */
import { createRequire } from 'module';
import path from 'path';

import { defineConfig } from 'vitest/config';

/** Resolve React 18 entry points from the react-compat workspace package. */
const require18 = createRequire(
	path.resolve(import.meta.dirname, '../react-compat/resolve-anchor.cjs'),
);

const src = (rel: string): string => path.resolve(import.meta.dirname, rel);

/** Directory of a react-compat dependency, for aliasing its subpath exports. */
function pkgDir18(name: string): string {
	// `exports` maps often hide package.json, so walk up from the main entry.
	let dir = path.dirname(require18.resolve(name));
	while (path.basename(dir) !== name && path.dirname(dir) !== dir) {
		dir = path.dirname(dir);
	}
	return dir;
}

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^react$/u, replacement: require18.resolve('react') },
			{ find: /^react\/jsx-runtime$/u, replacement: require18.resolve('react/jsx-runtime') },
			{
				find: /^react\/jsx-dev-runtime$/u,
				replacement: require18.resolve('react/jsx-dev-runtime'),
			},
			{ find: /^react-dom$/u, replacement: require18.resolve('react-dom') },
			{ find: /^react-dom\/client$/u, replacement: require18.resolve('react-dom/client') },
			{ find: /^react-dom\/test-utils$/u, replacement: require18.resolve('react-dom/test-utils') },
			{ find: /^react-dom\/server$/u, replacement: require18.resolve('react-dom/server') },
			{
				find: /^react-dom\/server\.browser$/u,
				replacement: require18.resolve('react-dom/server.browser'),
			},
			// Every dependency that calls React itself has to come from the same
			// React 18 install: React 19 creates elements with a different
			// `$$typeof` symbol and a different hook dispatcher, so a stray React 19
			// copy inside one of these produces "invalid hook call" or "Objects are
			// not valid as a React child" the moment it renders under React 18.
			{ find: /^react-i18next$/u, replacement: require18.resolve('react-i18next') },
			{ find: /^framer-motion$/u, replacement: require18.resolve('framer-motion') },
			{ find: /^lucide-react$/u, replacement: require18.resolve('lucide-react') },
			{ find: /^@ai-sdk\/react$/u, replacement: require18.resolve('@ai-sdk/react') },
			{ find: /^react-icons\//u, replacement: `${pkgDir18('react-icons')}/` },
			{ find: /^pptx-viewer-core$/u, replacement: src('../core/src/index.ts') },
			{ find: /^pptx-viewer-shared\/i18n$/u, replacement: src('../shared/src/i18n/index.ts') },
			{ find: /^pptx-viewer-shared\/ai$/u, replacement: src('../shared/src/ai/index.ts') },
			{ find: /^pptx-viewer-shared$/u, replacement: src('../shared/src/index.ts') },
		],
	},
	test: {
		globals: true,
		include: ['src/**/*.test.{ts,tsx}'],
		// Asserted by src/__tests__/react-version-compat.test.tsx: without it a
		// broken alias would silently fall back to React 19 and the leg would pass
		// while testing nothing.
		env: { PPTX_EXPECTED_REACT_MAJOR: '18' },
	},
});
