// @vitest-environment happy-dom
import type { PptxNotesMaster } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The body-placeholder schematic used to draw its font size from a fixed
 * `Math.max(8, Math.min(11, scaledWidth * 0.015))` clamp, unrelated to the
 * deck's authored `<p:notesStyle>`. It now resolves through the shared
 * `resolveNotesSchematicBodyFontSizePx` cascade, applying this canvas's own
 * page-to-preview `scale` on top of the resolved style.
 */

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key] ?? key;
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { NotesMasterCanvas } = await import('./NotesMasterCanvas');

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
});

const canvasSize = { width: 800, height: 600 };

// scale = min(800/720, 600/960, 1) * 0.85 = min(1.111, 0.625, 1) * 0.85 = 0.53125.
const SCALE = 0.53125;

function bodyFontSize(): number {
	const el = container.querySelector<HTMLElement>('[data-region="body"]');
	return el ? Number.parseFloat(el.style.fontSize) : Number.NaN;
}

describe('notesMasterCanvas body placeholder font size', () => {
	it('falls back to the 9pt default (scaled to the preview) with no authored notesStyle', () => {
		const master: PptxNotesMaster = { path: 'notes', placeholders: [{ type: 'body' }] };
		act(() => {
			root.render(<NotesMasterCanvas notesMaster={master} canvasSize={canvasSize} notesText='x' />);
		});
		// 9pt / 0.75 = 12px at 1:1, times the 0.53125 preview scale.
		expect(bodyFontSize()).toBeCloseTo(12 * SCALE, 3);
	});

	it("scales the deck's authored notesStyle level-0 font size instead of the fixed clamp", () => {
		const master: PptxNotesMaster = {
			path: 'notes',
			placeholders: [{ type: 'body' }],
			notesStyle: { 0: { fontSize: 64 } }, // 64px -> 48pt
		};
		act(() => {
			root.render(<NotesMasterCanvas notesMaster={master} canvasSize={canvasSize} notesText='x' />);
		});
		// 48pt / 0.75 = 64px at 1:1, times the 0.53125 preview scale.
		expect(bodyFontSize()).toBeCloseTo(64 * SCALE, 3);
	});
});
