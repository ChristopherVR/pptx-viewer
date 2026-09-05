// @vitest-environment happy-dom
/**
 * Does a deck authored to open into a custom show actually play it?
 *
 * "Set Up Slide Show > Custom show" writes `p:showPr/p:custShow/@id`, core
 * parses it into `showSlidesMode` + `showSlidesCustomShowId`, and the dialog
 * radio wrote it back. Nothing ever read it: playback ran off a separate,
 * viewer-only `activeCustomShowId` that only a manual pick could set, so the
 * radio was decorative and an authored deck presented in full.
 *
 * Driven through the REAL `useLoadContent` over a PowerPoint-authored fixture
 * (two custom shows, `p:showPr/p:custShow id="0"`), because the seeding has to
 * happen on the load path to be worth anything.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxElement,
	PptxEmbeddedFont,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxModernCommentAuthor,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
	PptxTheme,
	PptxThemeOption,
	PptxViewProperties,
	ParsedTableStyleMap,
} from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import type { EditorHistoryResult } from './useEditorHistory';
import { useLoadContent } from './useLoadContent';

// `import.meta.url` is an http URL under happy-dom, so resolve from dirname.
const FIXTURE = join(
	import.meta.dirname,
	'..',
	'..',
	'..',
	'..',
	'..',
	'e2e',
	'fixtures',
	'header-footer-shows.pptx',
);

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

interface Observed {
	activeCustomShowId: string | null;
	customShows: PptxCustomShow[];
	slideSizeEmu: SlideSizeEmu | undefined;
}

let observed: Observed = {
	activeCustomShowId: null,
	customShows: [],
	slideSizeEmu: undefined,
};

function Harness({ content }: { content: ArrayBuffer }): null {
	const [activeCustomShowId, setActiveCustomShowId] = useState<string | null>(null);
	const [customShows, setCustomShows] = useState<PptxCustomShow[]>([]);
	const [slideSizeEmu, setSlideSizeEmu] = useState<SlideSizeEmu | undefined>();
	const [, setLoaded] = useState(false);

	useLoadContent({
		content,
		clearSelection: () => {},
		history: stubHistory,
		setSlides: noopDispatch<PptxSlide[]>(),
		setTemplateElementsBySlideId: noopDispatch<Record<string, PptxElement[]>>(),
		mediaDataUrls: new Map<string, string>(),
		setCanvasSize: noopDispatch<CanvasSize>(),
		setSlideSizeEmu,
		setHeaderFooter: noopDispatch<PptxHeaderFooter>(),
		setLayoutOptions: noopDispatch<Array<{ path: string; name: string }>>(),
		setSlideMasters: noopDispatch<PptxSlideMaster[]>(),
		setModernCommentAuthors: noopDispatch<PptxModernCommentAuthor[]>(),
		setRecentColors: noopDispatch<string[]>(),
		setTheme: noopDispatch<PptxTheme | undefined>(),
		setTableStyleMap: noopDispatch<ParsedTableStyleMap | undefined>(),
		setTableStylesDefaultId: noopDispatch<string | undefined>(),
		setTableStylesToDelete: noopDispatch<string[]>(),
		setThemeOptions: noopDispatch<PptxThemeOption[]>(),
		setCustomShows,
		setActiveCustomShowId,
		setSections: noopDispatch<PptxSection[]>(),
		setPresentationProperties: noopDispatch<PptxPresentationProperties>(),
		setViewProperties: noopDispatch<PptxViewProperties | undefined>(),
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
		onContentApplied: () => setLoaded(true),
	});

	observed = { activeCustomShowId, customShows, slideSizeEmu };
	return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	host?.remove();
	root = null;
	host = null;
	observed = { activeCustomShowId: null, customShows: [], slideSizeEmu: undefined };
});

async function loadFixture(): Promise<void> {
	const bytes = readFileSync(FIXTURE);
	const content = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => {
		root?.render(<Harness content={content as ArrayBuffer} />);
	});
	// The load pipeline is async (unzip, parse, media resolution), so pump the
	// event loop until it has applied rather than guessing a fixed delay.
	for (let attempt = 0; attempt < 400 && observed.customShows.length === 0; attempt++) {
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 25);
			});
		});
	}
}

describe('loading a deck authored to open into a custom show', () => {
	it('seeds the running show from p:showPr/p:custShow/@id', async () => {
		await loadFixture();

		// The fixture names show id "0" ("Short Show").
		expect(observed.customShows.map((show) => show.id)).toContain('0');
		expect(observed.activeCustomShowId).toBe('0');
	}, 30_000);

	it('also seeds the EMU slide size a save has to write back', async () => {
		await loadFixture();

		expect(observed.slideSizeEmu).toStrictEqual({
			widthEmu: 12192000,
			heightEmu: 6858000,
			type: '',
		});
	}, 30_000);
});
