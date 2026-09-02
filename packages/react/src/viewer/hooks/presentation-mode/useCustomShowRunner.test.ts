import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createCustomShowRunner } from './useCustomShowRunner';
import type { CustomShowDescriptor, CustomShowRunnerDeps } from './useCustomShowRunner';

function slide(rId: string): PptxSlide {
	return { id: rId, rId, elements: [] } as unknown as PptxSlide;
}

const SLIDES: PptxSlide[] = [slide('rId1'), slide('rId2'), slide('rId3'), slide('rId4')];

const SHOWS: CustomShowDescriptor[] = [
	{ id: 'showA', slideRIds: ['rId1', 'rId2'] },
	{ id: 'showB', slideRIds: ['rId3', 'rId4'] },
];

function makeDeps(overrides?: Partial<CustomShowRunnerDeps>): {
	deps: CustomShowRunnerDeps;
	setActiveCustomShowId: ReturnType<typeof vi.fn>;
	navigateToSlide: ReturnType<typeof vi.fn>;
} {
	const setActiveCustomShowId = vi.fn();
	const navigateToSlide = vi.fn();
	const deps: CustomShowRunnerDeps = {
		getSlides: () => SLIDES,
		getCustomShows: () => SHOWS,
		getActiveCustomShowId: () => null,
		setActiveCustomShowId,
		navigateToSlide,
		getPresentationSlideIndex: () => 0,
		...overrides,
	};
	return { deps, setActiveCustomShowId, navigateToSlide };
}

describe('createCustomShowRunner', () => {
	it('switches to the target show and jumps to its first slide', () => {
		const { deps, setActiveCustomShowId, navigateToSlide } = makeDeps();
		const runner = createCustomShowRunner(deps);

		runner.runCustomShow('showB', false);

		expect(setActiveCustomShowId).toHaveBeenCalledWith('showB');
		expect(navigateToSlide).toHaveBeenCalledWith(2);
	});

	it('ignores an id that names no surviving custom show', () => {
		const { deps, setActiveCustomShowId, navigateToSlide } = makeDeps();
		const runner = createCustomShowRunner(deps);

		runner.runCustomShow('doesNotExist', false);

		expect(setActiveCustomShowId).not.toHaveBeenCalled();
		expect(navigateToSlide).not.toHaveBeenCalled();
	});

	it('returnAfter returns to the origin show and slide when the sub-show ends', () => {
		const { deps, setActiveCustomShowId, navigateToSlide } = makeDeps({
			getActiveCustomShowId: () => 'showA',
			getPresentationSlideIndex: () => 1,
		});
		const runner = createCustomShowRunner(deps);

		runner.runCustomShow('showB', true);
		setActiveCustomShowId.mockClear();
		navigateToSlide.mockClear();

		const returned = runner.tryReturnFromCustomShow();

		expect(returned).toBeTruthy();
		expect(setActiveCustomShowId).toHaveBeenCalledWith('showA');
		expect(navigateToSlide).toHaveBeenCalledWith(1);
	});

	it('a second return call is a no-op once the origin has been consumed', () => {
		const { deps } = makeDeps({ getActiveCustomShowId: () => 'showA' });
		const runner = createCustomShowRunner(deps);
		runner.runCustomShow('showB', true);
		expect(runner.tryReturnFromCustomShow()).toBeTruthy();
		expect(runner.tryReturnFromCustomShow()).toBeFalsy();
	});

	it('no return is armed when returnAfter is false', () => {
		const { deps } = makeDeps();
		const runner = createCustomShowRunner(deps);
		runner.runCustomShow('showB', false);
		expect(runner.tryReturnFromCustomShow()).toBeFalsy();
	});
});
