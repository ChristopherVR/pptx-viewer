import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createArrangeGroup } from './arrange-group';

function handlers() {
	return {
		bringForward: vi.fn(),
		sendBackward: vi.fn(),
		bringToFront: vi.fn(),
		sendToBack: vi.fn(),
		alignElements: vi.fn(),
		distributeElements: vi.fn(),
		flipHorizontal: vi.fn(),
		flipVertical: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		setStrokeWidth: vi.fn(),
		toggleFormatPainter: vi.fn(),
		duplicate: vi.fn(),
		delete: vi.fn(),
	};
}

function shape(shapeStyle?: { strokeWidth?: number }): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeStyle,
	} as PptxElement;
}

function button(group: ReturnType<typeof createArrangeGroup>, label: string): HTMLButtonElement {
	const match = [...group.el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing arrange button: ${label}`);
	}
	return match;
}

function field(group: ReturnType<typeof createArrangeGroup>, label: string): HTMLInputElement {
	const match = [...group.el.querySelectorAll<HTMLInputElement>('input')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing arrange field: ${label}`);
	}
	return match;
}

const selected = {
	editable: true,
	hasSelection: true,
	formatPainterActive: false,
	selectedCount: 1,
	selectedElement: shape(),
};

describe('createArrangeGroup', () => {
	it('names the horizontal-centre align button after its direction, not its edge id', () => {
		const t = createTranslator();
		const group = createArrangeGroup(document, t, handlers());
		// "Align centerH" leaked this binding's AlignEdge value into the UI.
		expect(button(group, 'Align center')).toBeTruthy();
		expect(
			[...group.el.querySelectorAll('button')].some((b) =>
				b.getAttribute('aria-label')?.includes('centerH'),
			),
		).toBeFalsy();
	});

	it('still aligns to the centerH edge when the centre button is clicked', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		group.update(selected);
		button(group, 'Align center').click();
		expect(actions.alignElements).toHaveBeenCalledWith('centerH');
	});

	it('offers the format painter but no second clipboard trio', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		group.update(selected);
		button(group, t('pptx.arrange.format')).click();
		expect(actions.toggleFormatPainter).toHaveBeenCalledOnce();
		// PowerPoint has one Clipboard group, and so does this ribbon: Cut / Copy
		// / Paste live there and nowhere else on the Home tab.
		for (const label of [t('pptx.arrange.copy'), t('pptx.arrange.cut'), t('pptx.arrange.paste')]) {
			expect(() => button(group, label)).toThrow();
		}
	});

	it('groups from two elements and ungroups only a group element', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		const groupBtn = button(group, t('pptx.contextMenu.group'));
		const ungroupBtn = button(group, t('pptx.contextMenu.ungroup'));

		group.update(selected);
		expect(groupBtn.disabled).toBeTruthy();
		expect(ungroupBtn.disabled).toBeTruthy();

		group.update({ ...selected, selectedCount: 2 });
		expect(groupBtn.disabled).toBeFalsy();
		groupBtn.click();
		expect(actions.groupSelected).toHaveBeenCalledOnce();

		group.update({
			...selected,
			selectedElement: { ...shape(), type: 'group' } as PptxElement,
		});
		expect(ungroupBtn.disabled).toBeFalsy();
		ungroupBtn.click();
		expect(actions.ungroupSelected).toHaveBeenCalledOnce();

		group.update({ ...selected, editable: false, selectedCount: 2 });
		expect(groupBtn.disabled).toBeTruthy();
	});

	it('reflects and commits the selected shape stroke width', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		const stroke = field(group, t('pptx.ribbon.strokeWidth'));
		expect(stroke.min).toBe('0');
		expect(stroke.max).toBe('120');
		expect(stroke.step).toBe('0.5');

		// No shape properties on the selection: nothing to restyle.
		group.update({ ...selected, selectedElement: undefined });
		expect(stroke.disabled).toBeTruthy();

		group.update({ ...selected, selectedElement: shape({ strokeWidth: 4 }) });
		expect(stroke.disabled).toBeFalsy();
		expect(stroke.value).toBe('4');

		// A shape that declares no outline reads as the renderer's own default.
		group.update(selected);
		expect(stroke.value).toBe('1');

		stroke.value = '2.5';
		stroke.dispatchEvent(new Event('change'));
		expect(actions.setStrokeWidth).toHaveBeenCalledWith(2.5);
	});

	it('labels the z-order edge commands Back and Front, as every other binding does', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		group.update(selected);
		const back = button(group, t('pptx.arrange.back'));
		const front = button(group, t('pptx.arrange.front'));
		expect(back.title).toBe(t('pptx.arrange.sendToBack'));
		expect(front.title).toBe(t('pptx.arrange.bringToFront'));
		back.click();
		front.click();
		expect(actions.sendToBack).toHaveBeenCalledOnce();
		expect(actions.bringToFront).toHaveBeenCalledOnce();
	});

	it('enables distribution only from three selected elements', () => {
		const t = createTranslator();
		const group = createArrangeGroup(document, t, handlers());
		const distribute = button(group, t('pptx.arrange.distributeHorizontal'));

		group.update({ ...selected, selectedCount: 2 });
		expect(distribute.disabled).toBeTruthy();

		group.update({ ...selected, selectedCount: 3 });
		expect(distribute.disabled).toBeFalsy();
	});

	it('gates the format painter on an editable deck with a selection', () => {
		const t = createTranslator();
		const group = createArrangeGroup(document, t, handlers());
		const painter = button(group, t('pptx.arrange.format'));

		group.update({ ...selected, hasSelection: false });
		expect(painter.disabled).toBeTruthy();

		group.update({ ...selected, editable: false });
		expect(painter.disabled).toBeTruthy();

		group.update(selected);
		expect(painter.disabled).toBeFalsy();
	});
});
