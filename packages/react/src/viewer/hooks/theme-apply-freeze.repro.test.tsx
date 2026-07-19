import { PptxHandler } from 'pptx-viewer-core';
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxElement,
	PptxEmbeddedFont,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeOption,
	ParsedTableStyleMap,
} from 'pptx-viewer-core';
// @vitest-environment happy-dom
/**
 * Regression harness for the "AI theme colour change freezes the renderer" bug.
 *
 * Wires the REAL `useLoadContent` + `useThemeHandlers` over a loaded fixture
 * deck and drives a scheme-colour change. The old implementation serialised the
 * whole deck and fed it back through `setContent`, re-running the full parse
 * pipeline on every change (heavy, and a stampede under the colour picker's
 * continuous `onChange`). The fix re-colours the live slides in place, so a
 * theme change must NOT re-enter the load pipeline at all.
 */
import React, { act, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import type { EditorHistoryResult } from './useEditorHistory';
import { useLoadContent } from './useLoadContent';
import { useThemeHandlers } from './useThemeHandlers';

let fixtureBytes: Uint8Array;

beforeAll(async () => {
	const { handler, data } = await PptxHandler.create({
		title: 'Theme Freeze Fixture',
		initialSlideCount: 2,
	});
	fixtureBytes = await handler.save(data.slides);
});

function noopDispatch<T>(): React.Dispatch<React.SetStateAction<T>> {
	return () => {};
}

const stubHistory: EditorHistoryResult = {
	canUndo: false,
	canRedo: false,
	undoLabel: undefined,
	redoLabel: undefined,
	handleUndo: () => {},
	handleRedo: () => {},
	resetHistory: () => {},
	markDirty: () => {},
	buildHistorySnapshot: () => ({}) as ReturnType<EditorHistoryResult['buildHistorySnapshot']>,
};

interface HarnessApi {
	getParseCount: () => number;
	getBumpCount: () => number;
	theme: PptxTheme | undefined;
	applyColors: (scheme: PptxThemeColorScheme) => Promise<void>;
}

let api: HarnessApi | null = null;

function Harness({ initial }: { initial: Uint8Array }): React.ReactElement {
	const [content, setContent] = useState<ArrayBuffer | Uint8Array | null>(initial);
	const [slides, setSlides] = useState<PptxSlide[]>([]);
	const [theme, setTheme] = useState<PptxTheme | undefined>(undefined);
	const parseCountRef = useRef(0);
	const bumpCountRef = useRef(0);

	const { handlerRef } = useLoadContent({
		content,
		clearSelection: () => {},
		history: stubHistory,
		setSlides,
		setTemplateElementsBySlideId: noopDispatch<Record<string, PptxElement[]>>(),
		mediaDataUrls: new Map<string, string>(),
		setCanvasSize: noopDispatch<CanvasSize>(),
		setHeaderFooter: noopDispatch<PptxHeaderFooter>(),
		setLayoutOptions: noopDispatch<Array<{ path: string; name: string }>>(),
		setSlideMasters: noopDispatch<PptxSlideMaster[]>(),
		setTheme,
		setTableStyleMap: noopDispatch<ParsedTableStyleMap | undefined>(),
		setThemeOptions: noopDispatch<PptxThemeOption[]>(),
		setCustomShows: noopDispatch<PptxCustomShow[]>(),
		setSections: noopDispatch<PptxSection[]>(),
		setPresentationProperties: noopDispatch<PptxPresentationProperties>(),
		setNotesMaster: noopDispatch<PptxNotesMaster | undefined>(),
		setHandoutMaster: noopDispatch<PptxHandoutMaster | undefined>(),
		setNotesCanvasSize: noopDispatch<CanvasSize | undefined>(),
		setCustomProperties: noopDispatch<PptxCustomProperty[]>(),
		setTagCollections: noopDispatch<PptxTagCollection[]>(),
		setCoreProperties: noopDispatch<PptxCoreProperties | undefined>(),
		setAppProperties: noopDispatch<PptxAppProperties | undefined>(),
		setEmbeddedFonts: noopDispatch<PptxEmbeddedFont[]>(),
		setActiveSlideIndex: noopDispatch<number>(),
		setHasMacros: noopDispatch<boolean>(),
		setHasDigitalSignatures: noopDispatch<boolean>(),
		setDigitalSignatureCount: noopDispatch<number>(),
		setGuides: noopDispatch<Array<{ id: string; axis: 'h' | 'v'; position: number }>>(),
		setLoading: noopDispatch<boolean>(),
		setError: noopDispatch<string | null>(),
		setIsDirty: noopDispatch<boolean>(),
		setIsEncrypted: noopDispatch<boolean>(),
		onContentApplied: () => {
			parseCountRef.current += 1;
		},
	});

	const serializeSlides = useCallback(async (): Promise<Uint8Array | null> => {
		const handler = handlerRef.current;
		if (!handler) {
			return null;
		}
		return handler.save(slides);
	}, [slides, handlerRef]);

	const themeHandlers = useThemeHandlers({
		handlerRef,
		serializeSlides,
		setContent,
		onContentChange: undefined,
		setTheme: setTheme as unknown as React.Dispatch<
			React.SetStateAction<Record<string, unknown> | null>
		>,
		setSlideMasters: noopDispatch<Array<Record<string, unknown>>>(),
		slideMasters: [],
		history: stubHistory,
		setSlides,
		theme,
		bumpHistory: () => {
			bumpCountRef.current += 1;
		},
	});

	api = {
		getParseCount: () => parseCountRef.current,
		getBumpCount: () => bumpCountRef.current,
		theme,
		applyColors: themeHandlers.handleUpdateThemeColorScheme,
	};

	return React.createElement('div');
}

async function flush(): Promise<void> {
	await act(async () => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	});
}

async function flushUntil(isDone: () => boolean, timeoutMs = 8000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await flush();
		if (isDone()) {
			return;
		}
	}
}

describe('theme colour apply does not freeze via a reparse loop', () => {
	it('re-colours in place without re-entering the load pipeline', async () => {
		const container = document.createElement('div');
		const root: Root = createRoot(container);
		await act(async () => {
			root.render(React.createElement(Harness, { initial: fixtureBytes }));
		});
		await flushUntil(() => (api?.getParseCount() ?? 0) >= 1);
		expect(api?.getParseCount()).toBe(1);

		const newScheme: PptxThemeColorScheme = {
			...(api?.theme?.colorScheme ?? ({} as PptxThemeColorScheme)),
			accent1: '#FF0000',
		};

		await act(async () => {
			await api?.applyColors(newScheme);
		});
		await flush();
		await flush();

		// The theme change must NOT trigger a re-parse (the old freeze path).
		expect(api?.getParseCount()).toBe(1);
		// It must land as a single undoable history entry.
		expect(api?.getBumpCount()).toBe(1);
		// And the new colour must actually be applied.
		expect(api?.theme?.colorScheme?.accent1).toBe('#FF0000');

		await act(async () => {
			root.unmount();
		});
	});

	it('survives a rapid burst of colour changes (picker drag) without a stampede', async () => {
		const container = document.createElement('div');
		const root: Root = createRoot(container);
		await act(async () => {
			root.render(React.createElement(Harness, { initial: fixtureBytes }));
		});
		await flushUntil(() => (api?.getParseCount() ?? 0) >= 1);

		const started = Date.now();
		await act(async () => {
			for (let i = 0; i < 25; i += 1) {
				const shade = i.toString(16).padStart(2, '0').toUpperCase();
				await api?.applyColors({
					...(api?.theme?.colorScheme ?? ({} as PptxThemeColorScheme)),
					accent1: `#${shade}0000`,
				});
			}
		});
		await flush();

		// 25 rapid changes must still never re-enter the load pipeline, and must
		// complete near-instantly rather than stampeding into a freeze.
		expect(api?.getParseCount()).toBe(1);
		expect(Date.now() - started).toBeLessThan(4000);

		await act(async () => {
			root.unmount();
		});
	});
});
