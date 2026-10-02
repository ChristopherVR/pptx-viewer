import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import InsertSection from './InsertSection.vue';

vi.mock(import('vue-i18n'), () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));
beforeAll(registerPptxWebControls);

function mountInsert(overrides: Record<string, unknown> = {}) {
	const props = {
		canEdit: true,
		hasSelection: false,
		onOpenHyperlinkDialog: vi.fn(),
		newShapeType: 'rect',
		onSetNewShapeType: vi.fn(),
		onAddTextBox: vi.fn(),
		onAddShape: vi.fn(),
		onAddTable: vi.fn(),
		onAddChart: vi.fn(),
		onAddSmartArt: vi.fn(),
		onAddEquation: vi.fn(),
		onAddActionButton: vi.fn(),
		onInsertField: vi.fn(),
		onOpenHeaderFooter: vi.fn(),
		onOpenImagePicker: vi.fn(),
		onOpenMediaPicker: vi.fn(),
		...overrides,
	};
	return { props, wrapper: mount(InsertSection, { attachTo: document.body, props }) };
}
function button(root: Element, id: string): HTMLButtonElement {
	return root.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!.querySelector('button')!;
}

describe('insert section', () => {
	it('routes commands to the native handlers', () => {
		const { props, wrapper } = mountInsert({ hasSelection: true });
		for (const id of [
			'insert.text.textBox',
			'insert.tables.table',
			'insert.images.pictures',
			'insert.media.media',
			'insert.illustrations.smartArt',
			'insert.symbols.equation',
			'insert.links.link',
		]) {
			button(document.body, id).click();
		}
		expect(props.onAddTextBox).toHaveBeenCalledOnce();
		expect(props.onAddTable).toHaveBeenCalledOnce();
		expect(props.onOpenImagePicker).toHaveBeenCalledOnce();
		expect(props.onOpenMediaPicker).toHaveBeenCalledOnce();
		expect(props.onAddSmartArt).toHaveBeenCalledOnce();
		expect(props.onAddEquation).toHaveBeenCalledOnce();
		expect(props.onOpenHyperlinkDialog).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('routes the shape and chart pickers and the Action menu', () => {
		const { props, wrapper } = mountInsert();
		const [shape, chart] = [...document.body.querySelectorAll('pptx-ui-select')];
		shape.value = 'star5';
		shape.dispatchEvent(new Event('change'));
		chart.value = 'pie';
		chart.dispatchEvent(new Event('change'));
		expect(props.onSetNewShapeType).toHaveBeenCalledExactlyOnceWith('star5');
		document.body
			.querySelector<HTMLButtonElement>(
				'[data-ribbon-control="insert.illustrations.shapes"] .pick',
			)!
			.click();
		document.body
			.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.illustrations.chart"] .pick')!
			.click();
		expect(props.onAddShape).toHaveBeenCalledOnce();
		expect(props.onAddChart).toHaveBeenCalledOnce();
		document.body
			.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.links.action"] .trigger')!
			.click();
		document.body.querySelector<HTMLButtonElement>('[data-insert-item]')!.click();
		expect(props.onAddActionButton).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('inserts simple fields directly and opens the native Date/Time dialog', async () => {
		const { props, wrapper } = mountInsert();
		const trigger = () =>
			document.body.querySelector<HTMLButtonElement>(
				'[data-ribbon-control="insert.text.field"] .trigger',
			)!;
		trigger().click();
		document.body.querySelector<HTMLButtonElement>('[data-insert-item="footer"]')!.click();
		expect(props.onInsertField).toHaveBeenCalledExactlyOnceWith('footer');
		trigger().click();
		document.body.querySelector<HTMLButtonElement>('[data-insert-item="datetime"]')!.click();
		await wrapper.vm.$nextTick();
		expect(document.body.textContent).toContain('pptx.common.insert');
		[...document.body.querySelectorAll('button')]
			.find((el) => el.textContent?.trim() === 'pptx.common.insert')!
			.click();
		expect(props.onInsertField).toHaveBeenLastCalledWith('datetime', expect.any(String));
		wrapper.unmount();
	});

	it('reflects read-only and selection gating without invoking edit handlers', async () => {
		const { props, wrapper } = mountInsert({ canEdit: false, hasSelection: true });
		const textBox = button(document.body, 'insert.text.textBox');
		expect(textBox.disabled).toBeTruthy();
		textBox.click();
		expect(props.onAddTextBox).not.toHaveBeenCalled();
		expect(button(document.body, 'insert.links.link').disabled).toBeFalsy();
		await wrapper.setProps({ canEdit: true, hasSelection: false });
		expect(button(document.body, 'insert.text.textBox').disabled).toBeFalsy();
		expect(button(document.body, 'insert.links.link').disabled).toBeTruthy();
		wrapper.unmount();
	});

	it('hides controls the host does not support', () => {
		const { wrapper } = mountInsert({
			onAddChart: undefined,
			onInsertField: undefined,
			onOpenHeaderFooter: undefined,
		});
		const hidden = (selector: string) => document.body.querySelector<HTMLElement>(selector)!.hidden;
		expect(hidden('[data-ribbon-control="insert.illustrations.chart"]')).toBeTruthy();
		expect(hidden('[data-ribbon-control="insert.text.field"]')).toBeTruthy();
		wrapper.unmount();
	});
});
