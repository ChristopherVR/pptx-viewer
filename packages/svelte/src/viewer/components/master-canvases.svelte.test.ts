import type { PptxHandoutMaster, PptxNotesMaster } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import HandoutMasterCanvas from './HandoutMasterCanvas.svelte';
import NotesMasterCanvas from './NotesMasterCanvas.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountComponent(component: Parameters<typeof mount>[0], props: Record<string, unknown>) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('master page canvases', () => {
	it('renders notes-master placeholder regions with canonical test hooks', () => {
		const notesMaster: PptxNotesMaster = {
			path: 'notes.xml',
			backgroundColor: '#ffeecc',
			placeholders: [{ type: 'sldImg' }, { type: 'body' }, { type: 'sldNum' }],
		};
		const target = mountComponent(NotesMasterCanvas, {
			notesMaster,
			canvasSize: { width: 720, height: 960 },
		});
		expect(target.querySelector('[data-testid="notes-master-page"]')).not.toBeNull();
		expect(target.querySelectorAll('[data-region]')).toHaveLength(3);
		expect(target.textContent).toContain('Slide Image');
		expect(target.textContent).toContain('Body');
	});

	it('renders the selected number of handout slots', () => {
		const handoutMaster: PptxHandoutMaster = { path: 'handout.xml' };
		const target = mountComponent(HandoutMasterCanvas, {
			handoutMaster,
			canvasSize: { width: 720, height: 960 },
			slidesPerPage: 6,
		});
		expect(target.querySelector('[data-testid="handout-master-page"]')).not.toBeNull();
		expect(target.querySelectorAll('[data-testid="handout-slot"]')).toHaveLength(6);
		expect(target.textContent).toContain('Header');
		expect(target.textContent).toContain('Page Number');
	});

	it('shows explicit empty states when the source master is absent', () => {
		const target = mountComponent(NotesMasterCanvas, {
			notesMaster: undefined,
			canvasSize: { width: 720, height: 960 },
		});
		expect(target.querySelector('[data-testid="notes-master-empty"]')?.textContent).toBe(
			'No notes master',
		);
	});
});
