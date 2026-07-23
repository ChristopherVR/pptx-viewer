/**
 * React 18 type-declaration guard (issue #105).
 *
 * The published `.d.ts` is generated against `@types/react` 19, so this file
 * type-checks a realistic consumer against the BUILT `dist/` declarations while
 * `react`/`react-dom` types are mapped to `@types/react` 18 (see
 * `tsconfig.react18.json`, run by `bun run typecheck:react18`). It compiles
 * nothing at runtime: it exists purely so `tsc` proves the declarations resolve
 * and narrow correctly under the older type definitions.
 *
 * React 18 and 19 differ here in ways that bite libraries: `RefObject<T>.current`
 * is READONLY in 18, `useRef()` still has a zero-argument overload, `ReactNode`
 * excludes promises, and function components do not accept `ref` as a plain
 * prop. Everything below sticks to the React 18 spelling on purpose.
 */
import type { PowerPointViewerHandle, PowerPointViewerProps, ViewerTheme } from 'pptx-react-viewer';
import { PowerPointViewer, vermilionDarkTheme } from 'pptx-react-viewer';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

/** A host component wiring the viewer the way the README documents it. */
export function React18Consumer({ content }: { content: Uint8Array }): ReactElement {
	// React 18 types: `useRef<T>(null)` yields `RefObject<T>` with a readonly
	// `current`, which must still satisfy the component's forwarded ref prop.
	const viewerRef = useRef<PowerPointViewerHandle>(null);
	const [theme, setTheme] = useState<ViewerTheme>(vermilionDarkTheme);
	// Compiles ONLY against @types/react 18: React 19 dropped the zero-argument
	// `useRef()` overload. Doubles as proof the tsconfig paths mapping took
	// effect, so a mis-wired path can't turn this check into a no-op.
	const react18Marker = useRef<number>();
	react18Marker.current = content.byteLength;

	const [dirty, setDirty] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);

	const save = useCallback(async (): Promise<Uint8Array | undefined> => {
		const bytes = await viewerRef.current?.getContent();
		return typeof bytes === 'string' ? undefined : bytes;
	}, []);

	const props: PowerPointViewerProps = {
		content,
		canEdit: true,
		theme,
		onDirtyChange: (isDirty: boolean) => setDirty(isDirty),
		onSelectionChange: (elementIds: string[]) => setSelected(elementIds),
		onThemeChange: () => setTheme(vermilionDarkTheme),
	};

	return (
		<div data-dirty={dirty} data-selected={selected.length} onClick={() => void save()}>
			<PowerPointViewer ref={viewerRef} {...props} />
		</div>
	);
}
