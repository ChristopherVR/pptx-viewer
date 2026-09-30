import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { PRESET_THEMES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { applyThemeEditorEdit } from './theme-editor-apply';
import type { UseThemeHandlersInput } from './useThemeHandlers';

describe('staged theme commit', () => {
	it('writes the archive once and records one slide edit without reloading content', async () => {
		const old = PRESET_THEMES[0];
		const shape = {
			type: 'shape',
			id: 'shape',
			x: 0,
			y: 0,
			width: 20,
			height: 20,
			shapeStyle: { fillColor: old.colorScheme.accent1 },
			textStyle: { fontFamily: 'Calibri', latinFontThemeToken: '+mn-lt' },
		} as Extract<PptxElement, { type: 'shape' }>;
		let slides = [{ id: 'slide', slideNumber: 1, elements: [shape] }] as PptxSlide[];
		let templates = { slide: [shape] };
		const applyTheme = vi.fn().mockResolvedValue(undefined);
		const input: UseThemeHandlersInput = {
			handlerRef: { current: { applyTheme } as unknown as PptxHandler },
			theme: { colorScheme: old.colorScheme, fontScheme: { minorFont: { latin: 'Calibri' } } },
			setSlides: vi.fn((update) => {
				slides = typeof update === 'function' ? update(slides) : update;
			}),
			templateElementsBySlideId: templates,
			setTemplateElementsBySlideId: vi.fn((update) => {
				templates = typeof update === 'function' ? update(templates) : update;
			}),
			bumpHistory: vi.fn(),
			history: { markDirty: vi.fn() } as unknown as UseThemeHandlersInput['history'],
			setTheme: vi.fn(),
			serializeSlides: vi.fn(),
			setContent: vi.fn(),
			onContentChange: vi.fn(),
			slideMasters: [],
			setSlideMasters: vi.fn(),
		};
		const edit = {
			name: 'New theme',
			colorScheme: { ...old.colorScheme, accent1: '#123456' },
			fontScheme: { majorFont: { latin: 'Georgia' }, minorFont: { latin: 'Verdana' } },
		};
		await applyThemeEditorEdit(input, edit);
		expect(applyTheme).toHaveBeenCalledExactlyOnceWith(
			edit.colorScheme,
			edit.fontScheme,
			edit.name,
		);
		expect(input.bumpHistory).toHaveBeenCalledOnce();
		expect(input.history.markDirty).toHaveBeenCalledOnce();
		expect((slides[0].elements[0] as typeof shape).shapeStyle?.fillColor).toBe('#123456');
		expect((templates.slide[0] as typeof shape).shapeStyle?.fillColor).toBe('#123456');
		expect((templates.slide[0] as typeof shape).textStyle?.fontFamily).toBe('Verdana');
		expect(input.serializeSlides).not.toHaveBeenCalled();
		expect(input.setContent).not.toHaveBeenCalled();
		expect(input.onContentChange).not.toHaveBeenCalled();
	});
});
