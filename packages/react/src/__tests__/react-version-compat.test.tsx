// @vitest-environment happy-dom
/**
 * React 18 / React 19 compatibility guard.
 *
 * `pptx-react-viewer` declares `react`/`react-dom` as `^18.2.0 || ^19.0.0`
 * peers (issue #105). Nothing in `src/` may depend on a React-19-only runtime
 * API. This spec runs UNCHANGED under both majors:
 *
 *   bun run test            # React 19 (workspace default)
 *   bun run test:react18    # React 18 via vitest.react18.config.ts aliases
 *
 * It renders the real `PowerPointViewer` through the package's public entry
 * point and exercises the concurrent-rendering APIs the viewer relies on
 * (`forwardRef` + `useImperativeHandle`, `useSyncExternalStore`,
 * `useDeferredValue`, `useTransition`, `useId`), all of which exist in React
 * 18. If a React 19-only API is introduced, the React 18 leg fails here rather
 * than in a consumer's app.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, {
	act,
	createRef,
	useDeferredValue,
	useId,
	useSyncExternalStore,
	useTransition,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The viewer pulls translations through react-i18next; stub it so the spec has
// no i18next provider requirement and stays identical across both React legs.
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key] ?? key;
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
		i18n: {
			language: 'en',
			languages: ['en'],
			options: { resources: { en: {} } },
			changeLanguage: () => Promise.resolve(),
		},
	}),
}));

const { PowerPointViewer } = await import('../index');
type ViewerHandle = import('../index').PowerPointViewerHandle;

/** Majors this package supports, mirroring the `react` peerDependency range. */
const SUPPORTED_MAJORS = ['18', '19'];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('react major compatibility', () => {
	it('declares both supported majors in the react/react-dom peer range', () => {
		const manifest = JSON.parse(
			readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'),
		) as { peerDependencies?: Record<string, string> };
		const peers = manifest.peerDependencies ?? {};
		// react and react-dom must move together: a tree with mismatched majors
		// fails at the first hook call, so the ranges may never drift apart.
		expect(peers['react-dom']).toBe(peers['react']);
		const declared = [...(peers['react'] ?? '').matchAll(/\^(\d+)/gu)].map((m) => m[1]);
		expect(declared).toStrictEqual(SUPPORTED_MAJORS);
	});

	it('runs against a React major inside the declared peer range', () => {
		const major = React.version.split('.')[0];
		expect(SUPPORTED_MAJORS).toContain(major);
		// vitest.react18.config.ts pins this so a broken alias cannot silently
		// fall back to React 19 and turn the React 18 leg into a no-op.
		const expected = process.env['PPTX_EXPECTED_REACT_MAJOR'];
		if (expected) {
			expect(major).toBe(expected);
		}
	});

	it('exposes every concurrent hook the viewer uses (all React >= 18)', () => {
		expect(useSyncExternalStore).toBeTypeOf('function');
		expect(useDeferredValue).toBeTypeOf('function');
		expect(useTransition).toBeTypeOf('function');
		expect(useId).toBeTypeOf('function');
		// `forwardRef` is how the viewer publishes its imperative handle; React
		// 19's ref-as-a-prop shorthand must never replace it while 18 is supported.
		expect(React.forwardRef).toBeTypeOf('function');
	});

	it('mounts PowerPointViewer from the public entry point', () => {
		act(() => {
			root.render(<PowerPointViewer />);
		});
		// The empty-content viewer still renders its shell, not a blank container.
		expect(container.firstElementChild).not.toBeNull();
		expect(container.textContent).not.toBe('');
	});

	it('exposes the imperative handle through forwardRef', () => {
		const ref = createRef<ViewerHandle>();
		act(() => {
			root.render(<PowerPointViewer ref={ref} />);
		});
		expect(ref.current).not.toBeNull();
		expect(ref.current?.getContent).toBeTypeOf('function');
	});

	it('re-renders on prop changes without remounting the tree', () => {
		act(() => {
			root.render(<PowerPointViewer canEdit={false} />);
		});
		const first = container.firstElementChild;
		act(() => {
			root.render(<PowerPointViewer canEdit />);
		});
		expect(container.firstElementChild).toBe(first);
	});
});
