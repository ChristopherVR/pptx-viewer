import React from 'react';
/**
 * Comprehensive end-to-end tests for the Toolbar component.
 *
 * Uses react-dom/server renderToStaticMarkup to render components with hooks,
 * then validates the resulting HTML output.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import type { ToolbarProps } from './toolbar-types';

// Mock react-i18next since some sub-components use useTranslation
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string | ((o: Record<string, unknown>) => string)> = {
				// ToolbarPrimaryRow
				'pptx.toolbar.toggleSlidesPanel': 'Toggle slides panel',
				'pptx.toolbar.undo': 'Undo',
				'pptx.toolbar.undoAction': (o: Record<string, unknown>) => `Undo: ${o.action}`,
				'pptx.toolbar.redo': 'Redo',
				'pptx.toolbar.redoAction': (o: Record<string, unknown>) => `Redo: ${o.action}`,
				'pptx.findReplace.title': 'Find and Replace',
				'pptx.toolbar.comments': 'Comments',
				'pptx.toolbar.share': 'Share',
				'pptx.toolbar.sharingUsers': (o: Record<string, unknown>) =>
					`Sharing with ${o.count} users`,
				'pptx.toolbar.sharingCount': (o: Record<string, unknown>) => `${o.count}`,
				'pptx.toolbar.toggleInspector': 'Toggle inspector panel',
				'pptx.toolbar.settingsShortcuts': 'Settings & Shortcuts',
				'pptx.toolbar.settings': 'Settings',
				'pptx.toolbar.readOnly': 'Read-only',
				// AnimationsSection
				'pptx.animations.previewTooltip': 'Preview animation on selected element',
				'pptx.animations.preview': 'Preview',
				'pptx.animations.addTooltip': 'Add animation to selected element',
				'pptx.animations.addAnimation': 'Add Animation',
				'pptx.animations.removeTooltip': 'Remove animation from selected element',
				'pptx.animations.remove': 'Remove',
				'pptx.animations.openPanelTooltip': 'Open Animation Panel in Inspector',
				'pptx.animations.animationPanel': 'Animation Panel',
				'pptx.animations.applyAnimation': (o: Record<string, unknown>) =>
					`Apply ${o.name} animation`,
				'pptx.animations.group.entrance': 'Entrance',
				'pptx.animations.group.emphasis': 'Emphasis',
				'pptx.animations.group.exit': 'Exit',
				'pptx.animations.preset.appear': 'Appear',
				'pptx.animations.preset.fadeIn': 'Fade In',
				'pptx.animations.preset.flyIn': 'Fly In',
				'pptx.animations.preset.pulse': 'Pulse',
				'pptx.animations.preset.spin': 'Spin',
				'pptx.animations.preset.disappear': 'Disappear',
				'pptx.animations.preset.fadeOut': 'Fade Out',
				// ArrangeSection
				'pptx.arrange.align': (o: Record<string, unknown>) => `Align ${o.direction}`,
				'pptx.arrange.copy': 'Copy',
				'pptx.arrange.cut': 'Cut',
				'pptx.arrange.paste': 'Paste',
				'pptx.arrange.formatPainter': 'Format Painter',
				'pptx.arrange.format': 'Format',
				'pptx.arrange.flipHorizontally': 'Flip horizontally',
				'pptx.arrange.flipH': 'Flip H',
				'pptx.arrange.flipVertically': 'Flip vertically',
				'pptx.arrange.flipV': 'Flip V',
				'pptx.arrange.sendBackward': 'Send backward',
				'pptx.arrange.bringForward': 'Bring forward',
				'pptx.arrange.sendToBack': 'Send to back',
				'pptx.arrange.back': 'Back',
				'pptx.arrange.bringToFront': 'Bring to front',
				'pptx.arrange.front': 'Front',
				'pptx.arrange.duplicate': 'Duplicate',
				'pptx.arrange.delete': 'Delete',
			};
			const v = translations[key];
			if (typeof v === 'function') {
				return v(opts ?? {});
			}
			return v ?? key;
		},
	}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a React element to HTML and return it for assertion. */
function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

// ---------------------------------------------------------------------------
// Mock ToolbarProps factory
// ---------------------------------------------------------------------------

function createMockToolbarProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
	return {
		mode: 'edit',
		canEdit: true,
		isNarrowViewport: false,
		isSidebarCollapsed: false,
		isInspectorPaneOpen: false,
		isCompactToolbarOpen: false,
		toolbarSection: 'home',
		scale: 1,
		canUndo: false,
		canRedo: false,
		undoLabel: undefined,
		redoLabel: undefined,
		findReplaceOpen: false,
		selectedElement: null,
		editTemplateMode: false,
		newShapeType: 'rect',
		activeTool: 'select',
		drawingColor: '#000000',
		drawingWidth: 2,
		clipboardPayload: null,
		onSetMode: vi.fn<() => void>(),
		onToggleSidebar: vi.fn<() => void>(),
		onToggleInspector: vi.fn<() => void>(),
		onToggleCompactToolbar: vi.fn<() => void>(),
		onSetToolbarSection: vi.fn<() => void>(),
		onZoomIn: vi.fn<() => void>(),
		onZoomOut: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		onUndo: vi.fn<() => void>(),
		onRedo: vi.fn<() => void>(),
		onToggleFindReplace: vi.fn<() => void>(),
		onSetNewShapeType: vi.fn<() => void>(),
		onAddTextBox: vi.fn<() => void>(),
		onAddShape: vi.fn<() => void>(),
		onAddTable: vi.fn<() => void>(),
		onAddSmartArt: vi.fn<() => void>(),
		onAddEquation: vi.fn<() => void>(),
		onAddActionButton: vi.fn<() => void>(),
		onInsertField: vi.fn<() => void>(),
		onOpenImagePicker: vi.fn<() => void>(),
		onOpenMediaPicker: vi.fn<() => void>(),
		onSetActiveTool: vi.fn<() => void>(),
		onSetDrawingColor: vi.fn<() => void>(),
		onSetDrawingWidth: vi.fn<() => void>(),
		onSetEditTemplateMode: vi.fn<() => void>(),
		spellCheckEnabled: false,
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: false,
		onSetSpellCheckEnabled: vi.fn<() => void>(),
		onSetShowGrid: vi.fn<() => void>(),
		onSetShowRulers: vi.fn<() => void>(),
		onSetSnapToGrid: vi.fn<() => void>(),
		onSetSnapToShape: vi.fn<() => void>(),
		onAddGuide: vi.fn<() => void>(),
		onAlignElements: vi.fn<() => void>(),
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onFlip: vi.fn<() => void>(),
		onMoveLayer: vi.fn<() => void>(),
		onMoveLayerToEdge: vi.fn<() => void>(),
		onDuplicate: vi.fn<() => void>(),
		onDelete: vi.fn<() => void>(),
		onExportPng: vi.fn<() => void>(),
		onExportPdf: vi.fn<() => void>(),
		onExportVideo: vi.fn<() => void>(),
		onExportGif: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		onSaveAsPptx: vi.fn<() => void>(),
		onSaveAsPpsx: vi.fn<() => void>(),
		onSaveAsPptm: vi.fn<() => void>(),
		hasMacros: false,
		onCopySlideAsImage: vi.fn<() => void>(),
		onPrint: vi.fn<() => void>(),
		onToggleShortcuts: vi.fn<() => void>(),
		onRunAccessibilityCheck: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		onUpdateTextStyle: vi.fn<() => void>(),
		isOverflowMenuOpen: false,
		onSetOverflowMenuOpen: vi.fn<() => void>(),
		layoutOptions: [{ path: 'layout1', name: 'Title Slide' }],
		onInsertSlideFromLayout: vi.fn<() => void>(),
		customShows: [],
		activeCustomShowId: null,
		onSetActiveCustomShowId: vi.fn<() => void>(),
		onCreateCustomShow: vi.fn<() => void>(),
		onRenameActiveCustomShow: vi.fn<() => void>(),
		onDeleteActiveCustomShow: vi.fn<() => void>(),
		onToggleCurrentSlideInActiveShow: vi.fn<() => void>(),
		isCurrentSlideInActiveShow: false,
		onToggleVersionHistory: vi.fn<() => void>(),
		onOpenPasswordProtection: vi.fn<() => void>(),
		onOpenDocumentProperties: vi.fn<() => void>(),
		onOpenFontEmbedding: vi.fn<() => void>(),
		onOpenDigitalSignatures: vi.fn<() => void>(),
		onEnterMasterView: vi.fn<() => void>(),
		onCloseMasterView: vi.fn<() => void>(),
		onEnterPresenterView: vi.fn<() => void>(),
		onEnterRehearsalMode: vi.fn<() => void>(),
		onToggleThemeEditor: vi.fn<() => void>(),
		isThemeEditorOpen: false,
		onToggleThemeGallery: vi.fn<() => void>(),
		isThemeGalleryOpen: false,
		onCompare: vi.fn<() => void>(),
		onToggleComments: vi.fn<() => void>(),
		isCommentsPanelOpen: false,
		spellCheckActive: false,
		slideCommentCount: 0,
		formatPainterActive: false,
		onToggleFormatPainter: vi.fn<() => void>(),
		isSelectionPaneOpen: false,
		onToggleSelectionPane: vi.fn<() => void>(),
		eyedropperActive: false,
		onToggleEyedropper: vi.fn<() => void>(),
		onOpenSetUpSlideShow: vi.fn<() => void>(),
		onOpenBroadcastDialog: vi.fn<() => void>(),
		onToggleSubtitles: vi.fn<() => void>(),
		showSubtitles: false,
		...overrides,
	};
}

// Lazy-import the components after mocking
const { Toolbar } = await import('../Toolbar');
const { HomeSection } = await import('./HomeSection');
const { FileSection } = await import('./FileSection');
const { InsertSection } = await import('./InsertSection');
const { DrawSection } = await import('./DrawSection');
const { DesignSection, TransitionsSection, ReviewSection } =
	await import('./DesignTransitionsReviewSection');
const { AnimationsSection } = await import('./AnimationsSection');
const { SlideShowSection } = await import('./SlideShowSection');
const { TextSection } = await import('./TextSection');
const { ViewSection } = await import('./ViewSection');
const { ToolbarPrimaryRow } = await import('./ToolbarPrimaryRow');
const { ArrangeSection } = await import('./ArrangeSection');

// ===========================================================================
// 1. Tab Navigation Tests
// ===========================================================================

describe('toolbar — tab navigation', () => {
	it('renders the toolbar with role="toolbar"', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		expect(html).toContain('role="toolbar"');
		expect(html).toContain('aria-label="Presentation toolbar"');
	});

	it('renders all 12 tab buttons when mode is edit', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'edit' })));
		const expectedLabels = [
			'File',
			'Home',
			'Insert',
			'Text',
			'Draw',
			'Arrange',
			'Design',
			'Transitions',
			'Animations',
			'Slide Show',
			'Review',
			'View',
		];
		for (const label of expectedLabels) {
			expect(html, `Tab "${label}" should be rendered`).toContain(`>${label}</button>`);
		}
		expect(expectedLabels).toHaveLength(12);
	});

	it('does not render tabs when mode is present', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'present' })));
		// In present mode, the ribbon tab bar should not render
		expect(html).not.toContain('>Home</button>');
		expect(html).not.toContain('>Insert</button>');
		expect(html).not.toContain('>Design</button>');
	});

	it('renders tabs when mode is master', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps({ mode: 'master' })));
		expect(html).toContain('>Home</button>');
		expect(html).toContain('>View</button>');
	});

	it('file tab has special primary styling', () => {
		const html = render(React.createElement(Toolbar, createMockToolbarProps()));
		// File tab should have bg-primary in its class
		expect(html).toMatch(/bg-primary[^"]*">File<\/button>/);
	});

	it('active tab has the after pseudo-element indicator class', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'insert' })),
		);
		// Active tab (Insert) should have after:bg-primary
		expect(html).toMatch(/after:bg-primary[^"]*">Insert<\/button>/);
	});

	it('inactive tabs have muted text styling', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		// Draw tab (not active) should have text-muted-foreground
		expect(html).toMatch(/text-muted-foreground[^"]*">Draw<\/button>/);
	});
});

// ===========================================================================
// 2. Home Tab Tests
// ===========================================================================

describe('toolbar — Home tab', () => {
	it('renders clipboard group with Paste, Cut, Copy, Format Painter', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				formatPainterActive: false,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				onToggleFormatPainter: vi.fn<() => void>(),
				layoutOptions: [{ path: 'l1', name: 'Title' }],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Paste"');
		expect(html).toContain('title="Cut"');
		expect(html).toContain('title="Copy"');
		expect(html).toContain('title="Format Painter"');
	});

	it('renders Clipboard group label', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Clipboard');
	});

	it('renders New Slide button', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [{ path: 'l1', name: 'Title' }],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="New Slide"');
		expect(html).toContain('New Slide');
	});

	it('font family display shows default value', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Segoe UI');
	});

	it('font size display shows default value', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>24</span>');
	});

	it('paste is disabled when no clipboard payload', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/disabled[^>]*title="Paste"/);
	});

	it('font group label is present', () => {
		const html = render(
			React.createElement(HomeSection, {
				canEdit: true,
				clipboardPayload: null,
				onCopy: vi.fn<() => void>(),
				onCut: vi.fn<() => void>(),
				onPaste: vi.fn<() => void>(),
				layoutOptions: [],
				onInsertSlideFromLayout: vi.fn<() => void>(),
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('>Font</span>');
	});
});

// ===========================================================================
// 3. File Tab Tests
// ===========================================================================

describe('toolbar — File tab', () => {
	const createFileProps = (overrides = {}) => ({
		onExportPng: vi.fn<() => void>(),
		onExportPdf: vi.fn<() => void>(),
		onExportVideo: vi.fn<() => void>(),
		onExportGif: vi.fn<() => void>(),
		onPackageForSharing: vi.fn<() => void>(),
		onSaveAsPpsx: vi.fn<() => void>(),
		onSaveAsPptm: vi.fn<() => void>(),
		hasMacros: false,
		onCopySlideAsImage: vi.fn<() => void>(),
		onPrint: vi.fn<() => void>(),
		onOpenDocumentProperties: vi.fn<() => void>(),
		onOpenPasswordProtection: vi.fn<() => void>(),
		onOpenFontEmbedding: vi.fn<() => void>(),
		onOpenDigitalSignatures: vi.fn<() => void>(),
		...overrides,
	});

	it('renders export buttons (PNG, PDF, Video, GIF)', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Export as PNG"');
		expect(html).toContain('title="Export as PDF"');
		expect(html).toContain('title="Export as Video"');
		expect(html).toContain('title="Export as GIF"');
	});

	it('renders Save .ppsx button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Save as Slide Show (.ppsx)"');
		expect(html).toContain('Save .ppsx');
	});

	it('renders Save .pptm button when hasMacros is true', () => {
		const html = render(React.createElement(FileSection, createFileProps({ hasMacros: true })));
		expect(html).toContain('title="Save as Macro-Enabled (.pptm)"');
		expect(html).toContain('Save .pptm');
	});

	it('does not render Save .pptm when hasMacros is false', () => {
		const html = render(React.createElement(FileSection, createFileProps({ hasMacros: false })));
		expect(html).not.toContain('Save .pptm');
	});

	it('renders Print button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Print"');
	});

	it('renders Properties button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Document Properties"');
		expect(html).toContain('Properties');
	});

	it('renders Protect button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Protect Presentation"');
		expect(html).toContain('Protect');
	});

	it('renders Fonts and Signatures buttons', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Embed Fonts"');
		expect(html).toContain('title="Digital Signatures"');
	});

	it('does not render Properties when handler is undefined', () => {
		const html = render(
			React.createElement(FileSection, createFileProps({ onOpenDocumentProperties: undefined })),
		);
		expect(html).not.toContain('title="Document Properties"');
	});

	it('renders Copy Slide as Image button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Copy Slide as Image"');
	});

	it('renders Package for Sharing button', () => {
		const html = render(React.createElement(FileSection, createFileProps()));
		expect(html).toContain('title="Package for Sharing"');
	});
});

// ===========================================================================
// 4. Insert Tab Tests
// ===========================================================================

describe('toolbar — Insert tab', () => {
	const createInsertProps = (overrides = {}) => ({
		canEdit: true,
		newShapeType: 'rect' as const,
		onSetNewShapeType: vi.fn<() => void>(),
		onAddTextBox: vi.fn<() => void>(),
		onAddShape: vi.fn<() => void>(),
		onAddTable: vi.fn<() => void>(),
		onAddSmartArt: vi.fn<() => void>(),
		onAddEquation: vi.fn<() => void>(),
		onAddActionButton: vi.fn<() => void>(),
		onInsertField: vi.fn<() => void>(),
		onOpenImagePicker: vi.fn<() => void>(),
		onOpenMediaPicker: vi.fn<() => void>(),
		...overrides,
	});

	it('renders Text, Shape, Image, Media, Table buttons', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Add text box"');
		expect(html).toContain('title="Add shape"');
		expect(html).toContain('title="Insert image"');
		expect(html).toContain('title="Insert audio or video"');
		expect(html).toContain('title="Insert table"');
	});

	it('renders SmartArt and Equation buttons', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Insert SmartArt"');
		expect(html).toContain('title="Insert Equation"');
	});

	it('renders Action button', () => {
		const html = render(React.createElement(InsertSection, createInsertProps()));
		expect(html).toContain('title="Insert action button"');
		expect(html).toContain('>Action');
	});

	it('renders Field button when onInsertField is provided', () => {
		const html = render(
			React.createElement(InsertSection, createInsertProps({ onInsertField: vi.fn<() => void>() })),
		);
		// The field button title uses the i18n key
		expect(html).toContain('pptx.field.insertField');
	});

	it('does not render Field button when onInsertField is undefined', () => {
		const html = render(
			React.createElement(InsertSection, createInsertProps({ onInsertField: undefined })),
		);
		expect(html).not.toContain('pptx.field.insertField');
	});

	it('buttons are disabled when canEdit is false', () => {
		const html = render(React.createElement(InsertSection, createInsertProps({ canEdit: false })));
		expect(html).toMatch(/disabled[^>]*title="Add text box"/);
	});
});

// ===========================================================================
// 5. Draw Tab Tests
// ===========================================================================

describe('toolbar — Draw tab', () => {
	it('renders five drawing tool buttons (Select, Pen, Highlighter, Eraser, Freeform)', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Select"');
		expect(html).toContain('title="Pen"');
		expect(html).toContain('title="Highlighter"');
		expect(html).toContain('title="Eraser"');
		expect(html).toContain('title="Freeform"');
	});

	it('active tool has highlight styling', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'pen',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		// The pen button should have bg-accent class since pen is active
		expect(html).toMatch(/bg-accent[^"]*"[^>]*title="Pen"/);
	});

	it('renders color picker input', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#ff0000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('type="color"');
		expect(html).toContain('value="#ff0000"');
	});

	it('renders width range control', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 5,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('type="range"');
		expect(html).toContain('value="5"');
	});

	it('renders Colour and Width labels', () => {
		const html = render(
			React.createElement(DrawSection, {
				activeTool: 'select',
				drawingColor: '#000000',
				drawingWidth: 2,
				onSetActiveTool: vi.fn<() => void>(),
				onSetDrawingColor: vi.fn<() => void>(),
				onSetDrawingWidth: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Colour');
		expect(html).toContain('Width');
	});
});

// ===========================================================================
// 6. Design Tab Tests
// ===========================================================================

describe('toolbar — Design tab', () => {
	it('renders Browse Themes button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onOpenDocumentProperties: vi.fn<() => void>(),
				onToggleInspector: vi.fn<() => void>(),
				isInspectorPaneOpen: false,
			}),
		);
		expect(html).toContain('Browse Themes');
	});

	it('renders Edit Theme button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		expect(html).toContain('Edit Theme');
	});

	it('renders Slide Size button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onOpenDocumentProperties: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Slide Size');
	});

	it('renders Format Background button', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
				onToggleInspector: vi.fn<() => void>(),
				isInspectorPaneOpen: false,
			}),
		);
		expect(html).toContain('Format Background');
	});

	it('theme gallery button has active styling when open', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: true,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		// The browse themes button should have bg-primary
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Browse and apply built-in themes"/);
	});

	it('does not render Slide Size when handler is undefined', () => {
		const html = render(
			React.createElement(DesignSection, {
				canEdit: true,
				onToggleThemeGallery: vi.fn<() => void>(),
				isThemeGalleryOpen: false,
				onToggleThemeEditor: vi.fn<() => void>(),
				isThemeEditorOpen: false,
			}),
		);
		expect(html).not.toContain('Slide Size');
	});
});

// ===========================================================================
// 7. Transitions Tab Tests
// ===========================================================================

describe('toolbar — Transitions tab', () => {
	it('renders Preview button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Preview transition"');
		expect(html).toContain('>Preview</button>');
	});

	it('renders transition presets (None, Fade, Push, Wipe, etc.)', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		const presets = ['None', 'Fade', 'Push', 'Wipe', 'Split', 'Reveal', 'Cut', 'Cover', 'Uncover'];
		for (const preset of presets) {
			expect(html, `Preset "${preset}" should be rendered`).toContain(`>${preset}</button>`);
		}
		expect(presets).toHaveLength(9);
	});

	it('renders Duration input', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Duration:');
		expect(html).toContain('title="Transition duration in seconds"');
	});

	it('renders Apply to All button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Apply transition to all slides"');
		expect(html).toContain('Apply to All');
	});

	it('renders Inspector button', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Open Inspector for full transition options"');
		expect(html).toContain('>Inspector</button>');
	});

	it('inspector button has active styling when pane is open', () => {
		const html = render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: true,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Open Inspector for full transition options"/);
	});
});

// ===========================================================================
// 8. Animations Tab Tests
// ===========================================================================

describe('toolbar — Animations tab', () => {
	it('renders Preview button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Preview animation on selected element"');
		expect(html).toContain('>Preview</button>');
	});

	it('renders Add Animation dropdown', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Add animation to selected element"');
		expect(html).toContain('Add Animation');
	});

	it('renders Remove button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Remove animation from selected element"');
		expect(html).toContain('>Remove</button>');
	});

	it('renders Animation Panel button', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Open Animation Panel in Inspector"');
		expect(html).toContain('Animation Panel');
	});

	it('buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/disabled[^>]*title="Preview animation on selected element"/);
		expect(html).toMatch(/disabled[^>]*title="Add animation to selected element"/);
		expect(html).toMatch(/disabled[^>]*title="Remove animation from selected element"/);
	});

	it('animation Panel button shows active state when inspector is open', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: true,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Open Animation Panel in Inspector"/);
	});

	it('animation presets list includes Entrance, Emphasis, and Exit groups', () => {
		const html = render(
			React.createElement(AnimationsSection, {
				canEdit: true,
				selectedElement: null,
				isInspectorPaneOpen: false,
				onToggleInspector: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('Entrance');
		expect(html).toContain('Emphasis');
		expect(html).toContain('Exit');
	});
});

// ===========================================================================
// 9. Slide Show Tab Tests
// ===========================================================================

describe('toolbar — Slide Show tab', () => {
	const createSlideShowProps = () => ({
		onPresent: vi.fn<() => void>(),
		onSetMode: vi.fn<() => void>() as (mode: 'edit' | 'present' | 'preview' | 'master') => void,
		onEnterPresenterView: vi.fn<() => void>(),
		onEnterRehearsalMode: vi.fn<() => void>(),
		onOpenSetUpSlideShow: vi.fn<() => void>(),
		onOpenBroadcastDialog: vi.fn<() => void>(),
		onToggleSubtitles: vi.fn<() => void>(),
		showSubtitles: false,
	});

	it('renders From Beginning button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Start slide show from beginning"');
		expect(html).toContain('From Beginning');
	});

	it('renders From Current Slide button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Start slide show from current slide"');
		expect(html).toContain('From Current Slide');
	});

	it('renders Presenter View button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Presenter view"');
		expect(html).toContain('Presenter View');
	});

	it('renders Rehearse Timings button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Rehearse timings"');
		expect(html).toContain('Rehearse Timings');
	});

	it('renders Set Up Slide Show button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Set up slide show"');
		expect(html).toContain('Set Up Slide Show');
	});

	it('renders Broadcast button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Broadcast slide show"');
		expect(html).toContain('Broadcast');
	});

	it('renders Subtitles button', () => {
		const html = render(React.createElement(SlideShowSection, createSlideShowProps()));
		expect(html).toContain('title="Toggle subtitles"');
		expect(html).toContain('Subtitles');
	});

	it('subtitles button has active styling when showSubtitles is true', () => {
		const props = createSlideShowProps();
		props.showSubtitles = true;
		const html = render(React.createElement(SlideShowSection, props));
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Toggle subtitles"/);
	});
});

// ===========================================================================
// 10. Review Tab Tests
// ===========================================================================

describe('toolbar — Review tab', () => {
	it('renders Comments button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 0,
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Toggle comments panel"');
		expect(html).toContain('Comments');
	});

	it('renders Spelling button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Toggle spell check"');
		expect(html).toContain('Spelling');
	});

	it('renders Compare button', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onCompare: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Compare with another presentation"');
		expect(html).toContain('Compare');
	});

	it('shows comment count badge when > 0', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 5,
			}),
		);
		expect(html).toContain('>5</span>');
	});

	it('does not render comment badge when count is 0', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: false,
				slideCommentCount: 0,
			}),
		);
		// No badge with rounded-full class should exist
		expect(html).not.toMatch(/rounded-full[^"]*"[^>]*>[0-9]+<\/span>/);
	});

	it('comments button has active styling when panel is open', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
				onToggleComments: vi.fn<() => void>(),
				isCommentsPanelOpen: true,
			}),
		);
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Toggle comments panel"/);
	});

	it('spelling button has active styling when enabled', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: true,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="Toggle spell check"/);
	});

	it('does not render Comments if onToggleComments is undefined', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).not.toContain('title="Toggle comments panel"');
	});

	it('does not render Compare if onCompare is undefined', () => {
		const html = render(
			React.createElement(ReviewSection, {
				canEdit: true,
				spellCheckEnabled: false,
				onSetSpellCheckEnabled: vi.fn<() => void>(),
			}),
		);
		expect(html).not.toContain('title="Compare with another presentation"');
	});
});

// ===========================================================================
// 11. View Tab Tests
// ===========================================================================

describe('toolbar — View tab', () => {
	const createViewProps = (overrides = {}) => ({
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn<() => void>(),
		spellCheckEnabled: false,
		onSetSpellCheckEnabled: vi.fn<() => void>(),
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: false,
		onSetShowGrid: vi.fn<() => void>(),
		onSetShowRulers: vi.fn<() => void>(),
		onSetSnapToGrid: vi.fn<() => void>(),
		onSetSnapToShape: vi.fn<() => void>(),
		onAddGuide: vi.fn<() => void>(),
		onEnterMasterView: vi.fn<() => void>(),
		isSelectionPaneOpen: false,
		onToggleSelectionPane: vi.fn<() => void>(),
		eyedropperActive: false,
		onToggleEyedropper: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		...overrides,
	});

	it('renders Presentation Views group (Normal, Slide Sorter, Reading View)', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Normal view"');
		expect(html).toContain('title="Slide Sorter view"');
		expect(html).toContain('title="Reading View"');
		expect(html).toContain('Presentation Views');
	});

	it('renders Master Views group (Slide Master)', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Edit slide masters and layouts"');
		expect(html).toContain('Slide Master');
		expect(html).toContain('Master Views');
	});

	it('renders Grid button', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('pptx.grid.grid');
	});

	it('renders Rulers button', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('pptx.ruler.rulers');
	});

	it('renders Snap controls', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('pptx.grid.snapToGrid');
		expect(html).toContain('pptx.grid.snapToShape');
	});

	it('renders guide buttons', () => {
		const html = render(React.createElement(ViewSection, createViewProps()));
		expect(html).toContain('title="Add horizontal guide"');
		expect(html).toContain('title="Add vertical guide"');
	});

	it('grid button has active styling when showGrid is true', () => {
		const html = render(React.createElement(ViewSection, createViewProps({ showGrid: true })));
		expect(html).toMatch(/bg-primary[^"]*"[^>]*title="pptx.grid.toggleGrid"/);
	});

	it('renders Selection pane button', () => {
		const html = render(
			React.createElement(
				ViewSection,
				createViewProps({ onToggleSelectionPane: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('title="Selection Pane"');
		expect(html).toContain('Selection');
	});

	it('renders Eyedropper button', () => {
		const html = render(
			React.createElement(
				ViewSection,
				createViewProps({ onToggleEyedropper: vi.fn<() => void>() }),
			),
		);
		expect(html).toContain('Eyedropper');
	});

	it('renders Zoom to Fit button', () => {
		const html = render(
			React.createElement(ViewSection, createViewProps({ onZoomToFit: vi.fn<() => void>() })),
		);
		expect(html).toContain('Zoom to Fit');
	});

	it('slide Master is disabled when canEdit is false', () => {
		const html = render(React.createElement(ViewSection, createViewProps({ canEdit: false })));
		expect(html).toMatch(/disabled[^>]*title="Edit slide masters and layouts"/);
	});
});

// ===========================================================================
// 12. Quick Access Bar (ToolbarPrimaryRow) Tests
// ===========================================================================

describe('toolbar — Quick Access Bar (ToolbarPrimaryRow)', () => {
	it('renders Undo and Redo buttons', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Undo"');
		expect(html).toContain('aria-label="Redo"');
	});

	it('undo button is disabled when canUndo is false', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canUndo: false })),
		);
		expect(html).toMatch(/disabled[^>]*aria-label="Undo"/);
	});

	it('redo button is disabled when canRedo is false', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canRedo: false })),
		);
		expect(html).toMatch(/disabled[^>]*aria-label="Redo"/);
	});

	it('renders sidebar toggle button', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Toggle slides panel"');
	});

	it('renders inspector toggle button', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Toggle inspector panel"');
	});

	it('renders Find and Replace button', () => {
		const html = render(React.createElement(ToolbarPrimaryRow, createMockToolbarProps()));
		expect(html).toContain('aria-label="Find and Replace"');
	});

	it('find and Replace button has foreground text when open', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ findReplaceOpen: true })),
		);
		expect(html).toMatch(/text-foreground[^"]*"[^>]*aria-label="Find and Replace"/);
	});

	it('shows Read-only badge when canEdit is false', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canEdit: false })),
		);
		expect(html).toContain('Read-only');
	});

	it('does not show Read-only badge when canEdit is true', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ canEdit: true })),
		);
		expect(html).not.toContain('Read-only');
	});

	it('undo button title shows label when provided', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ undoLabel: 'Delete shape' })),
		);
		expect(html).toContain('title="Undo: Delete shape"');
	});

	it('redo button title shows label when provided', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ redoLabel: 'Add text' })),
		);
		expect(html).toContain('title="Redo: Add text"');
	});

	it('does not render sidebar toggle in present mode', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ mode: 'present' })),
		);
		expect(html).not.toContain('aria-label="Toggle slides panel"');
	});

	it('does not render inspector toggle in present mode', () => {
		const html = render(
			React.createElement(ToolbarPrimaryRow, createMockToolbarProps({ mode: 'present' })),
		);
		expect(html).not.toContain('aria-label="Toggle inspector panel"');
	});
});

// ===========================================================================
// Arrange Tab Tests
// ===========================================================================

describe('toolbar — Arrange tab', () => {
	const createArrangeProps = (overrides = {}) => ({
		canEdit: true,
		selectedElement: { type: 'shape', id: 'test', x: 0, y: 0, width: 100, height: 100 } as never,
		clipboardPayload: null,
		onAlignElements: vi.fn<() => void>(),
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onFlip: vi.fn<() => void>(),
		onMoveLayer: vi.fn<() => void>(),
		onMoveLayerToEdge: vi.fn<() => void>(),
		onDuplicate: vi.fn<() => void>(),
		onDelete: vi.fn<() => void>(),
		formatPainterActive: false,
		onToggleFormatPainter: vi.fn<() => void>(),
		...overrides,
	});

	it('renders alignment buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Align left"');
		expect(html).toContain('title="Align center"');
		expect(html).toContain('title="Align right"');
		expect(html).toContain('title="Align top"');
		expect(html).toContain('title="Align middle"');
		expect(html).toContain('title="Align bottom"');
	});

	it('renders Copy, Cut, Paste buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Copy"');
		expect(html).toContain('title="Cut"');
		expect(html).toContain('title="Paste"');
	});

	it('renders Flip H and Flip V buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Flip horizontally"');
		expect(html).toContain('title="Flip vertically"');
	});

	it('renders layer ordering buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Send backward"');
		expect(html).toContain('title="Bring forward"');
		expect(html).toContain('title="Send to back"');
		expect(html).toContain('title="Bring to front"');
	});

	it('renders Duplicate and Delete buttons', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Duplicate"');
		expect(html).toContain('title="Delete"');
	});

	it('renders Format Painter button', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toContain('title="Format Painter"');
	});

	it('alignment buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(ArrangeSection, createArrangeProps({ selectedElement: null })),
		);
		expect(html).toMatch(/disabled[^>]*title="Align left"/);
	});

	it('delete button has red styling', () => {
		const html = render(React.createElement(ArrangeSection, createArrangeProps()));
		expect(html).toMatch(/bg-red[^"]*"[^>]*title="Delete"/);
	});
});

// ===========================================================================
// Text Tab Tests
// ===========================================================================

describe('toolbar — Text tab', () => {
	it('renders formatting buttons (Bold, Italic, Underline, Strikethrough)', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Italic"');
		expect(html).toContain('title="Underline"');
		expect(html).toContain('title="Strikethrough"');
	});

	it('renders text alignment buttons', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Align left"');
		expect(html).toContain('title="Align center"');
		expect(html).toContain('title="Align right"');
		expect(html).toContain('title="Justify"');
	});

	it('renders Font color button', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toContain('title="Font Color"');
	});

	it('formatting buttons are disabled when no element is selected', () => {
		const html = render(
			React.createElement(TextSection, {
				canEdit: true,
				selectedElement: null,
				onUpdateTextStyle: vi.fn<() => void>(),
			}),
		);
		expect(html).toMatch(/disabled[^>]*title="Bold"/);
	});
});

// ===========================================================================
// Main Toolbar integration: section rendering
// ===========================================================================

describe('toolbar — section content rendering', () => {
	it('renders HomeSection content when toolbarSection is home', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		expect(html).toContain('New Slide');
		expect(html).toContain('Clipboard');
	});

	it('renders FileSection content when toolbarSection is file', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'file' })),
		);
		expect(html).toContain('Save .ppsx');
		expect(html).toContain('>PNG</button>');
	});

	it('renders InsertSection content when toolbarSection is insert', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'insert' })),
		);
		expect(html).toContain('SmartArt');
		expect(html).toContain('Equation');
	});

	it('renders DrawSection content when toolbarSection is draw', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'draw' })),
		);
		expect(html).toContain('Colour');
		expect(html).toContain('type="range"');
	});

	it('renders DesignSection content when toolbarSection is design', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'design' })),
		);
		expect(html).toContain('Browse Themes');
		expect(html).toContain('Edit Theme');
	});

	it('renders TransitionsSection content when toolbarSection is transitions', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'transitions' })),
		);
		expect(html).toContain('>Preview</button>');
		expect(html).toContain('Apply to All');
	});

	it('renders AnimationsSection content when toolbarSection is animations', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'animations' })),
		);
		expect(html).toContain('Add Animation');
		expect(html).toContain('Animation Panel');
	});

	it('renders SlideShowSection when toolbarSection is slideShow', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'slideShow' })),
		);
		expect(html).toContain('From Beginning');
		expect(html).toContain('From Current Slide');
	});

	it('renders ReviewSection when toolbarSection is review', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'review' })),
		);
		expect(html).toContain('Spelling');
	});

	it('renders ViewSection when toolbarSection is view', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'view' })),
		);
		expect(html).toContain('Normal');
		expect(html).toContain('Slide Master');
	});

	it('home section also renders TextSection content (B/I/U/S)', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'home' })),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Italic"');
	});

	it('text section renders TextSection content', () => {
		const html = render(
			React.createElement(Toolbar, createMockToolbarProps({ toolbarSection: 'text' })),
		);
		expect(html).toContain('title="Bold"');
		expect(html).toContain('title="Underline"');
	});

	// Narrow-viewport rendering moved to <MobileToolbar /> (see Toolbar.tsx
	// short-circuit at the top of the component). The expand/collapse button
	// was part of the old in-Toolbar compact mode and no longer exists.
	// MobileToolbar has its own test coverage for the mobile-first UI.
});
