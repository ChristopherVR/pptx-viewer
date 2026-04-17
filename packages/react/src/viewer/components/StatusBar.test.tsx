import React from 'react';
/**
 * Comprehensive tests for the StatusBar component.
 *
 * Uses react-dom/server renderToStaticMarkup to render the component,
 * then validates the resulting HTML output.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import type { StatusBarProps } from './StatusBar';

// Mock react-i18next before importing the component
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string | ((o: Record<string, unknown>) => string)> = {
				'pptx.autosave.saving': 'Saving...',
				'pptx.autosave.error': 'Autosave error',
				'pptx.autosave.justNow': 'just now',
				'pptx.autosave.oneMinAgo': '1 minute ago',
				'pptx.autosave.minutesAgo': (o: Record<string, unknown>) => `${o.count} minutes ago`,
				'pptx.autosave.saved': (o: Record<string, unknown>) => `Saved ${o.time ?? ''}`,
				'pptx.statusBar.unsavedChanges': 'Unsaved changes',
				'pptx.statusBar.allSaved': 'All changes saved',
				'pptx.statusBar.slideOf': (o: Record<string, unknown>) =>
					`Slide ${o.current} of ${o.total}`,
				'pptx.statusBar.noSlides': 'No slides',
				'pptx.statusBar.language': 'English (U.S.)',
				'pptx.statusBar.toggleNotes': 'Toggle notes',
				'pptx.notes.title': 'Notes',
				'pptx.statusBar.normalView': 'Normal view',
				'pptx.statusBar.slideSorter': 'Slide sorter',
				'pptx.statusBar.slideShow': 'Slide show',
				'pptx.statusBar.zoomIn': 'Zoom in',
				'pptx.statusBar.zoomOut': 'Zoom out',
				'pptx.statusBar.zoomToFit': 'Zoom to fit',
			};
			const v = translations[key];
			if (typeof v === 'function') {
				return v(opts ?? {});
			}
			return v ?? key;
		},
	}),
}));

const { StatusBar } = await import('./StatusBar');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

function createMockStatusBarProps(overrides: Partial<StatusBarProps> = {}): StatusBarProps {
	return {
		slideCount: 10,
		activeSlideIndex: 2,
		isDirty: false,
		autosaveStatus: undefined,
		scale: 1.0,
		onZoomIn: vi.fn<() => void>(),
		onZoomOut: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		isNotesExpanded: false,
		onToggleNotes: vi.fn<() => void>(),
		mode: 'edit',
		onSetMode: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		...overrides,
	};
}

// ===========================================================================
// Slide count display
// ===========================================================================

describe('statusBar — slide count', () => {
	it('displays correct slide number and total', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ slideCount: 10, activeSlideIndex: 2 }),
			),
		);
		expect(html).toContain('Slide 3 of 10');
	});

	it('displays "Slide 1 of 1" for single slide', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ slideCount: 1, activeSlideIndex: 0 }),
			),
		);
		expect(html).toContain('Slide 1 of 1');
	});

	it('displays "No slides" when slideCount is 0', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ slideCount: 0, activeSlideIndex: 0 }),
			),
		);
		expect(html).toContain('No slides');
	});

	it('clamps slide number to slideCount when index exceeds count', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ slideCount: 5, activeSlideIndex: 9 }),
			),
		);
		expect(html).toContain('Slide 5 of 5');
	});
});

// ===========================================================================
// Language indicator
// ===========================================================================

describe('statusBar — language indicator', () => {
	it('shows language indicator', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		expect(html).toContain('English (U.S.)');
	});
});

// ===========================================================================
// Autosave status
// ===========================================================================

describe('statusBar — autosave status', () => {
	it('shows "Saving..." when autosave state is saving', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ autosaveStatus: { state: 'saving' } }),
			),
		);
		expect(html).toContain('Saving...');
	});

	it('shows saved status with timestamp', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({
					autosaveStatus: { state: 'saved', timestamp: Date.now() },
				}),
			),
		);
		expect(html).toContain('Saved');
		expect(html).toContain('just now');
	});

	it('shows error status', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({
					autosaveStatus: { state: 'error', message: 'Network error' },
				}),
			),
		);
		expect(html).toContain('Autosave error');
	});

	it('shows "Unsaved changes" when dirty and no autosave', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ isDirty: true, autosaveStatus: undefined }),
			),
		);
		expect(html).toContain('Unsaved changes');
	});

	it('shows "All changes saved" when not dirty and no autosave', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ isDirty: false, autosaveStatus: undefined }),
			),
		);
		expect(html).toContain('All changes saved');
	});

	it('error status has red text styling', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({
					autosaveStatus: { state: 'error', message: 'fail' },
				}),
			),
		);
		expect(html).toMatch(/text-red-400/);
	});

	it('saving status has yellow text styling', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ autosaveStatus: { state: 'saving' } }),
			),
		);
		expect(html).toMatch(/text-yellow-400/);
	});
});

// ===========================================================================
// Notes toggle
// ===========================================================================

describe('statusBar — notes toggle', () => {
	it('renders notes toggle button when handler is provided', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ onToggleNotes: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('aria-label="Toggle notes"');
	});

	it('does not render notes toggle when handler is undefined', () => {
		const html = render(
			React.createElement(StatusBar, createMockStatusBarProps({ onToggleNotes: undefined })),
		);
		expect(html).not.toContain('aria-label="Toggle notes"');
	});

	it('notes button shows "Notes" text', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ onToggleNotes: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('>Notes</span>');
	});

	it('notes button has primary text when expanded', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ onToggleNotes: vi.fn<() => void>(), isNotesExpanded: true }),
			),
		);
		expect(html).toMatch(/text-primary[^"]*"[^>]*title="Toggle notes"/);
	});
});

// ===========================================================================
// View mode buttons
// ===========================================================================

describe('statusBar — view mode buttons', () => {
	it('renders Normal view button', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		expect(html).toContain('aria-label="Normal view"');
	});

	it('renders Slide sorter button', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ onToggleSlideSorter: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('aria-label="Slide sorter"');
	});

	it('renders Slide show button', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		expect(html).toContain('aria-label="Slide show"');
	});

	it('normal view button has primary text when mode is edit', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps({ mode: 'edit' })));
		expect(html).toMatch(/text-primary[^"]*"[^>]*title="Normal view"/);
	});

	it('slide show button has primary text when mode is present', () => {
		const html = render(
			React.createElement(StatusBar, createMockStatusBarProps({ mode: 'present' })),
		);
		expect(html).toMatch(/text-primary[^"]*"[^>]*title="Slide show"/);
	});

	it('does not render view mode buttons when onSetMode is undefined', () => {
		const html = render(
			React.createElement(StatusBar, createMockStatusBarProps({ onSetMode: undefined })),
		);
		expect(html).not.toContain('aria-label="Normal view"');
	});
});

// ===========================================================================
// Zoom controls
// ===========================================================================

describe('statusBar — zoom controls', () => {
	it('renders zoom out button', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ scale: 1.0, onZoomOut: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('aria-label="Zoom out"');
	});

	it('renders zoom in button', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ scale: 1.0, onZoomIn: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('aria-label="Zoom in"');
	});

	it('displays zoom percentage correctly at 100%', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps({ scale: 1.0 })));
		expect(html).toContain('100%');
	});

	it('displays zoom percentage correctly at 75%', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps({ scale: 0.75 })));
		expect(html).toContain('75%');
	});

	it('displays zoom percentage correctly at 150%', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps({ scale: 1.5 })));
		expect(html).toContain('150%');
	});

	it('renders zoom to fit button with correct percentage', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps({ scale: 0.5 })));
		expect(html).toContain('title="Zoom to fit"');
		expect(html).toContain('50%');
	});

	it('does not render zoom controls when scale is undefined', () => {
		const html = render(
			React.createElement(StatusBar, createMockStatusBarProps({ scale: undefined })),
		);
		expect(html).not.toContain('aria-label="Zoom out"');
		expect(html).not.toContain('aria-label="Zoom in"');
	});

	it('does not render zoom in button when onZoomIn is undefined', () => {
		const html = render(
			React.createElement(StatusBar, createMockStatusBarProps({ scale: 1.0, onZoomIn: undefined })),
		);
		expect(html).not.toContain('aria-label="Zoom in"');
	});

	it('does not render zoom out button when onZoomOut is undefined', () => {
		const html = render(
			React.createElement(
				StatusBar,
				createMockStatusBarProps({ scale: 1.0, onZoomOut: undefined }),
			),
		);
		expect(html).not.toContain('aria-label="Zoom out"');
	});
});

// ===========================================================================
// Full width rendering
// ===========================================================================

describe('statusBar — layout', () => {
	it('has w-full class on the root element', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		expect(html).toMatch(/^<div class="[^"]*w-full/);
	});

	it('has border-t class for top border', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		expect(html).toMatch(/^<div class="[^"]*border-t/);
	});

	it('has flex layout', () => {
		const html = render(React.createElement(StatusBar, createMockStatusBarProps()));
		const rootClassMatch = html.match(/^<div class="([^"]*)"/);
		expect(rootClassMatch).not.toBeNull();
		const className = rootClassMatch![1];
		expect(className).toContain('flex');
		expect(className).toContain('items-center');
	});
});
