import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ProposalStore } from '../../internal/shared-ai';
import type { PptxAiBridge } from '../../internal/shared-ai';
import { EditorStateService } from '../editor-state.service';
import { createAngularAiBridge } from './ai-bridge';

function textElement(id: string, text: string): PptxElement {
	return { type: 'text', id, name: '', x: 10, y: 20, width: 100, height: 50, text } as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

/** Mutable presentation-level deck state the fake bridge deps read/write. */
interface DeckState {
	canvas: { width: number; height: number };
	sections: readonly PptxSection[];
	presentationProperties: PptxPresentationProperties;
	customProperties: readonly PptxCustomProperty[];
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
}

/** Build a bridge over a real editor, tracking navigation/selection side effects. */
function setup(): {
	editor: EditorStateService;
	bridge: PptxAiBridge;
	nav: { index: number; selected: readonly string[] };
	deck: DeckState;
} {
	const editor = new EditorStateService();
	editor.setSlides([slide('s1', [textElement('a', 'Hello')])]);
	const nav = { index: 0, selected: [] as readonly string[] };
	const deck: DeckState = {
		canvas: { width: 960, height: 540 },
		sections: [],
		presentationProperties: {},
		customProperties: [],
		coreProperties: undefined,
		appProperties: undefined,
	};
	const bridge = createAngularAiBridge({
		getSlides: () => editor.slides(),
		getActiveSlideIndex: () => nav.index,
		getCanvasSize: () => deck.canvas,
		getTheme: () => undefined,
		getFileName: () => 'Deck.pptx',
		getHandler: () => undefined,
		goToSlide: (i) => {
			nav.index = i;
		},
		selectElements: (slideIndex, ids) => {
			nav.index = slideIndex;
			nav.selected = ids;
			editor.select([...ids]);
		},
		applySlides: (next, label) => editor.applyReplacement(next, label),
		applyTheme: () => {
			/* not exercised here */
		},
		getSections: () => deck.sections,
		getPresentationProperties: () => deck.presentationProperties,
		getCustomProperties: () => deck.customProperties,
		getCoreProperties: () => deck.coreProperties,
		getAppProperties: () => deck.appProperties,
		setCanvasSize: (size) => {
			deck.canvas = size;
			editor.dirty.set(true);
		},
		setSections: (sections) => {
			deck.sections = sections;
			editor.dirty.set(true);
		},
		setPresentationProperties: (props) => {
			deck.presentationProperties = props;
			editor.dirty.set(true);
		},
		setCustomProperties: (props) => {
			deck.customProperties = props;
			editor.dirty.set(true);
		},
		setCoreProperties: (props) => {
			deck.coreProperties = props;
			editor.dirty.set(true);
		},
		setAppProperties: (props) => {
			deck.appProperties = props;
			editor.dirty.set(true);
		},
	});
	return { editor, bridge, nav, deck };
}

describe('createAngularAiBridge', () => {
	it('exposes deck meta and slides from the live editor', () => {
		const { bridge } = setup();
		const meta = bridge.getDeckMeta();
		expect(meta.slideCount).toBe(1);
		expect(meta.activeSlideIndex).toBe(0);
		expect(meta.title).toBe('Deck.pptx');
		expect(meta.width).toBe(960);
		expect(bridge.getSlides()).toHaveLength(1);
	});

	it('commits applySlidesUpdate as one undoable history entry', () => {
		const { editor, bridge } = setup();
		expect(editor.canUndo()).toBeFalsy();

		bridge.applySlidesUpdate((slides) => {
			slides[0].elements.push(textElement('b', 'Added'));
			return slides;
		}, 'Add element');

		expect(editor.slides()[0].elements).toHaveLength(2);
		expect(editor.dirty()).toBeTruthy();
		expect(editor.canUndo()).toBeTruthy();

		editor.undo();
		expect(editor.slides()[0].elements).toHaveLength(1);
	});

	it('applies field updates through updateElement and stays undoable', () => {
		const { editor, bridge } = setup();
		bridge.updateElement(0, 'a', { x: 200, text: 'Updated' });

		const el = editor.slides()[0].elements[0] as PptxElement & { text?: string };
		expect(el.x).toBe(200);
		expect(el.text).toBe('Updated');
		expect(editor.canUndo()).toBeTruthy();
	});

	it('routes a staged proposal Accept through the bridge to the undoable editor', () => {
		const { editor, bridge } = setup();
		const store = new ProposalStore(bridge);

		const staged = store.stage('Rename element', (slides) => {
			const el = slides[0].elements[0] as PptxElement & { text?: string };
			el.text = 'From proposal';
			return slides;
		});
		// Staging must NOT touch the live deck yet.
		expect((editor.slides()[0].elements[0] as { text?: string }).text).toBe('Hello');

		const applied = store.apply(staged.id);
		expect(applied).toBeTruthy();
		expect((editor.slides()[0].elements[0] as { text?: string }).text).toBe('From proposal');
		expect(editor.canUndo()).toBeTruthy();
		expect(store.size).toBe(0);
	});

	it('selectElements updates the editor selection and active slide index', () => {
		const { editor, bridge, nav } = setup();
		bridge.selectElements(0, ['a']);
		expect(nav.index).toBe(0);
		expect([...editor.selectedIds()]).toStrictEqual(['a']);
	});

	it('getDeckData surfaces the live slides + tracked presentation-level state', () => {
		const { bridge } = setup();
		const data = bridge.getDeckData?.();
		expect(data).toBeDefined();
		expect(data?.slides).toHaveLength(1);
		expect(data?.width).toBe(960);
		expect(data?.height).toBe(540);
		expect(data?.sections).toStrictEqual([]);
		expect(data?.customProperties).toStrictEqual([]);
	});

	it('applyDeckData routes slide edits through the undoable editor', () => {
		const { editor, bridge } = setup();
		bridge.applyDeckData?.((data) => {
			data.slides[0].elements.push(textElement('b', 'Added'));
			return data;
		}, 'AI deck edit');

		expect(editor.slides()[0].elements).toHaveLength(2);
		expect(editor.canUndo()).toBeTruthy();
		editor.undo();
		expect(editor.slides()[0].elements).toHaveLength(1);
	});

	it('applyDeckData fans changed deck fields to their setters and marks dirty', () => {
		const { editor, bridge, deck } = setup();
		bridge.applyDeckData?.((data) => {
			data.width = 1280;
			data.height = 720;
			data.sections = [{ id: 'sec1', name: 'Intro', slideIds: ['s1'] } as PptxSection];
			data.coreProperties = { title: 'From AI' };
			return data;
		}, 'AI deck metadata');

		expect(deck.canvas).toStrictEqual({ width: 1280, height: 720 });
		expect(deck.sections).toStrictEqual([{ id: 'sec1', name: 'Intro', slideIds: ['s1'] }]);
		expect(deck.coreProperties).toStrictEqual({ title: 'From AI' });
		expect(editor.dirty()).toBeTruthy();
	});
});
