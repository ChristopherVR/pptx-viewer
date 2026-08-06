import { SLIDE_TEMPLATES } from 'pptx-viewer-shared';
import { keyToLabel, translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? keyToLabel(key),
	}),
}));

const { SlideTemplateGalleryDialog } = await import('./SlideTemplateGalleryDialog');
const { SlidesGroup } = await import('./toolbar/SlidesGroup');

describe('slide template gallery dialog', () => {
	it('renders nothing when closed', () => {
		const html = renderToStaticMarkup(
			<SlideTemplateGalleryDialog isOpen={false} onClose={vi.fn()} onInsert={vi.fn()} />,
		);
		expect(html).toBe('');
	});

	it('renders a dialog with one option per catalog template', () => {
		const html = renderToStaticMarkup(
			<SlideTemplateGalleryDialog isOpen onClose={vi.fn()} onInsert={vi.fn()} />,
		);
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-label="Slide Templates"');
		const optionCount = (html.match(/role="option"/gu) ?? []).length;
		expect(optionCount).toBe(SLIDE_TEMPLATES.length);
		expect(html).toContain('aria-label="Title Slide"');
		expect(html).toContain('aria-label="Agenda"');
		expect(html).toContain('>Insert</button>');
		expect(html).toContain('>Cancel</button>');
	});

	it('renders live previews with the provided theme scheme colour', () => {
		const html = renderToStaticMarkup(
			<SlideTemplateGalleryDialog
				isOpen
				onClose={vi.fn()}
				onInsert={vi.fn()}
				scheme={{ accent1: '#ba0021' }}
			/>,
		);
		expect(html.toLowerCase()).toContain('#ba0021');
	});
});

describe('slides group template affordance', () => {
	const base = {
		canEdit: true,
		layoutOptions: [],
		onInsertSlideFromLayout: vi.fn<() => void>(),
	};

	it('shows the Slide Templates button when the insert handler is wired', () => {
		const html = renderToStaticMarkup(
			<SlidesGroup {...base} onInsertSlideFromTemplate={vi.fn()} />,
		);
		expect(html).toContain('title="Slide Templates"');
		expect(html).toContain('Slide Templates');
	});

	it('omits the button when no template handler is provided', () => {
		const html = renderToStaticMarkup(<SlidesGroup {...base} />);
		expect(html).not.toContain('title="Slide Templates"');
	});
});
