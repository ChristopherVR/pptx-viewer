/**
 * The crop-mode overlay renders the shared descriptor (ghost, frame, eight
 * handles) and a handle drag crops the picture live through the service.
 */
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { CropOverlayComponent } from './crop-overlay.component';
import { EditorStateService } from './editor-state.service';
import { PictureCropService } from './picture-crop.service';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => {
	TestBed.resetTestingModule();
});

function picture(): PptxElement {
	return {
		type: 'picture',
		id: 'pic',
		x: 100,
		y: 50,
		width: 200,
		height: 100,
		imageData: 'data:image/png;base64,AAAA',
	} as PptxElement;
}

function pointer(type: string, clientX: number, clientY: number): PointerEvent {
	return new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX, clientY });
}

function mount(): {
	root: HTMLElement;
	editor: EditorStateService;
	crop: PictureCropService;
	detect: () => void;
} {
	TestBed.configureTestingModule({
		imports: [CropOverlayComponent],
		providers: [
			provideTranslateService({ fallbackLang: 'en' }),
			EditorStateService,
			PictureCropService,
		],
	});
	// This runner's JIT has no signal-input transform: register the inputs and
	// pass signals, as `animation-timeline.i18n.test.ts` does.
	TestBed.overrideComponent(CropOverlayComponent, {
		add: { inputs: ['element', 'zoom', 'mediaDataUrls'] },
	});
	const editor = TestBed.inject(EditorStateService);
	editor.setSlides([{ id: 's1', slideNumber: 1, elements: [picture()] } as PptxSlide]);
	const crop = TestBed.inject(PictureCropService);
	crop.enter(0, editor.slides()[0].elements[0]);
	const fixture = TestBed.createComponent(CropOverlayComponent);
	fixture.componentRef.setInput(
		'element',
		computed(() => editor.slides()[0].elements[0]),
	);
	fixture.componentRef.setInput('zoom', signal(1));
	fixture.componentRef.setInput('mediaDataUrls', signal(new Map<string, string>()));
	fixture.detectChanges();
	return {
		root: fixture.nativeElement as HTMLElement,
		editor,
		crop,
		detect: () => fixture.detectChanges(),
	};
}

describe('cropOverlayComponent', () => {
	it('renders the overlay over the picture box with a ghost, a frame and 8 handles', () => {
		const { root } = mount();
		const overlay = root.querySelector<HTMLElement>('[data-pptx-crop-overlay="true"]');
		expect(overlay).not.toBeNull();
		expect(overlay?.style.left).toBe('100px');
		expect(overlay?.style.width).toBe('200px');
		expect(root.querySelector('[data-pptx-crop-frame]')).not.toBeNull();
		expect(root.querySelector('[data-pptx-crop-ghost] img')).not.toBeNull();
		const handles = [...root.querySelectorAll('[data-pptx-crop-handle]')].map((el) =>
			el.getAttribute('data-pptx-crop-handle'),
		);
		expect(handles).toStrictEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
		expect(root.querySelector('[data-pptx-crop-handle="w"] path')?.getAttribute('fill')).toBe(
			'#000',
		);
	});

	it('a west-handle drag crops the picture live (cropLeft grows, x moves)', () => {
		const { root, editor, detect } = mount();
		const handle = root.querySelector('[data-pptx-crop-handle="w"]');
		handle?.dispatchEvent(pointer('pointerdown', 10, 10));
		document.dispatchEvent(pointer('pointermove', 50, 10));
		document.dispatchEvent(pointer('pointerup', 50, 10));
		detect();
		const el = editor.slides()[0].elements[0] as PptxElement & { cropLeft?: number };
		expect(el.cropLeft).toBeGreaterThan(0);
		expect(el.x).toBeCloseTo(140);
		expect(editor.canUndo()).toBeFalsy();
		const overlay = root.querySelector<HTMLElement>('[data-pptx-crop-overlay="true"]');
		expect(overlay?.style.left).toBe('140px');
	});

	it('a press outside the overlay commits the crop as one undo step', () => {
		const { root, editor, crop } = mount();
		root.querySelector('[data-pptx-crop-handle="w"]')?.dispatchEvent(pointer('pointerdown', 0, 0));
		document.dispatchEvent(pointer('pointermove', 30, 0));
		document.dispatchEvent(pointer('pointerup', 30, 0));
		document.body.dispatchEvent(pointer('pointerdown', 900, 900));
		expect(crop.state()).toBeNull();
		expect(editor.canUndo()).toBeTruthy();
	});
});
