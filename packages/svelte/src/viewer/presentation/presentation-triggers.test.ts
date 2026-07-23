import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attachPresentationTriggerListeners } from './presentation-triggers';
import type { TriggerController } from './presentation-triggers';

function makeController(overrides: Partial<TriggerController> = {}): TriggerController {
	return {
		interactiveTriggerShapeIds: new Set<string>(),
		hoverTriggerShapeIds: new Set<string>(),
		handleInteractiveShapeClick: vi.fn<(id: string) => boolean>(() => true),
		handleHoverStart: vi.fn<(id: string) => boolean>(() => true),
		handleHoverEnd: vi.fn<(id: string) => void>(),
		...overrides,
	};
}

/** Build a stage root holding one `[data-element-id]` shape and return both. */
function makeStage(elementId: string): { root: HTMLElement; shape: HTMLElement } {
	const root = document.createElement('div');
	const shape = document.createElement('div');
	shape.dataset.elementId = elementId;
	root.appendChild(shape);
	document.body.appendChild(root);
	return { root, shape };
}

describe('attachPresentationTriggerListeners', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('plays an interactive shape sequence and suppresses tap-to-advance', () => {
		const controller = makeController({ interactiveTriggerShapeIds: new Set(['el-1']) });
		const { root, shape } = makeStage('el-1');
		const holderClick = vi.fn<() => void>();
		root.parentElement?.addEventListener('click', holderClick);
		attachPresentationTriggerListeners(root, controller);

		shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(controller.handleInteractiveShapeClick).toHaveBeenCalledWith('el-1');
		// stopPropagation kept the click from reaching the tap-to-advance holder.
		expect(holderClick).not.toHaveBeenCalled();
	});

	it('lets a non-trigger click bubble to the tap-to-advance holder', () => {
		const controller = makeController();
		const { root, shape } = makeStage('el-plain');
		const holderClick = vi.fn<() => void>();
		root.parentElement?.addEventListener('click', holderClick);
		attachPresentationTriggerListeners(root, controller);

		shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(controller.handleInteractiveShapeClick).not.toHaveBeenCalled();
		expect(holderClick).toHaveBeenCalledOnce();
	});

	it('fires hover start on shape entry and end on leaving the stage', () => {
		const controller = makeController({ hoverTriggerShapeIds: new Set(['el-h']) });
		const { root, shape } = makeStage('el-h');
		attachPresentationTriggerListeners(root, controller);

		shape.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(controller.handleHoverStart).toHaveBeenCalledWith('el-h');

		// Leaving the stage subtree (relatedTarget outside root) ends the sequence.
		root.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
		expect(controller.handleHoverEnd).toHaveBeenCalledWith('el-h');
	});

	it('removes its listeners on cleanup', () => {
		const controller = makeController({ interactiveTriggerShapeIds: new Set(['el-1']) });
		const { root, shape } = makeStage('el-1');
		const cleanup = attachPresentationTriggerListeners(root, controller);

		cleanup();
		shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(controller.handleInteractiveShapeClick).not.toHaveBeenCalled();
	});
});
