// These are Vue composables (Composition API), not React hooks; the react-hooks
// rule misfires on the `useX` naming when invoked inside a test `setup` fn.
// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref, shallowRef } from 'vue';

import { translationsEn } from '../../../i18n';
import { useEditorHistory } from '../../composables/useEditorHistory';
import { useEditorOperations } from '../../composables/useEditorOperations';
import ConnectorArrowsPanel from './ConnectorArrowsPanel.vue';

function connector(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		type: 'connector',
		id: 'conn-1',
		x: 0,
		y: 0,
		width: 200,
		height: 60,
		shapeType: 'straightConnector1',
		shapeStyle,
	} as PptxElement;
}

/** Label text, then the select, for each rendered control. */
function readControls(wrapper: ReturnType<typeof mount>): { label: string; value: string }[] {
	return wrapper.findAll('label.pptx-vue-connector-arrow-field').map((field) => ({
		label: field.get('span').text(),
		value: (field.get('select').element as HTMLSelectElement).value,
	}));
}

describe('connectorArrowsPanel', () => {
	it('offers the six controls React shows, under React accessible names', () => {
		const wrapper = mount(ConnectorArrowsPanel, { props: { element: connector() } });
		expect(readControls(wrapper).map((c) => c.label)).toStrictEqual([
			'Start Arrow',
			'End Arrow',
			'Start Width',
			'Start Length',
			'End Width',
			'End Length',
		]);
	});

	it('spells every label from the dictionary, never via the keyToLabel fallback', () => {
		// The package test setup routes a MISSING key through `keyToLabel`, which
		// invents plausible-looking text, so a rendered label alone cannot prove
		// the key exists. Assert the dictionary itself carries each one.
		const keys = [
			'pptx.connectorArrows.startArrow',
			'pptx.connectorArrows.endArrow',
			'pptx.connectorArrows.startWidth',
			'pptx.connectorArrows.startLength',
			'pptx.connectorArrows.endWidth',
			'pptx.connectorArrows.endLength',
			'pptx.arrowhead.none',
			'pptx.arrowhead.triangle',
			'pptx.arrowhead.stealth',
			'pptx.arrowhead.diamond',
			'pptx.arrowhead.oval',
			'pptx.arrowhead.openArrow',
			'pptx.connectorOptions.sizeSmall',
			'pptx.connectorOptions.sizeMedium',
			'pptx.connectorOptions.sizeLarge',
			'pptx.elementType.connector',
		];
		expect(keys.filter((key) => !translationsEn[key])).toStrictEqual([]);
	});

	it('spells arrowhead options as PowerPoint does, with no raw schema token', () => {
		const wrapper = mount(ConnectorArrowsPanel, { props: { element: connector() } });
		const arrowOptions = wrapper
			.findAll('label.pptx-vue-connector-arrow-field')[0]!
			.findAll('option')
			.map((o) => `${(o.element as HTMLOptionElement).value}=${o.text()}`);
		expect(arrowOptions).toStrictEqual([
			'none=None',
			'triangle=Triangle',
			'stealth=Stealth',
			'diamond=Diamond',
			'oval=Oval',
			// `arrow` is PowerPoint's "Open Arrow"; the raw token must never show.
			'arrow=Open Arrow',
		]);
		const sizeOptions = wrapper
			.findAll('label.pptx-vue-connector-arrow-field')[2]!
			.findAll('option')
			.map((o) => o.text());
		expect(sizeOptions).toStrictEqual(['Small', 'Medium', 'Large']);
	});

	it('reads the head types and sizes a deck authored', () => {
		const wrapper = mount(ConnectorArrowsPanel, {
			props: {
				element: connector({
					connectorStartArrow: 'oval',
					connectorStartArrowWidth: 'lg',
					connectorStartArrowLength: 'sm',
					connectorEndArrow: 'triangle',
					connectorEndArrowWidth: 'sm',
					connectorEndArrowLength: 'lg',
				}),
			},
		});
		expect(readControls(wrapper).map((c) => c.value)).toStrictEqual([
			'oval',
			'triangle',
			'lg',
			'sm',
			'sm',
			'lg',
		]);
	});

	it('falls back to no arrowhead and a medium size when the deck is silent', () => {
		const wrapper = mount(ConnectorArrowsPanel, { props: { element: connector() } });
		expect(readControls(wrapper).map((c) => c.value)).toStrictEqual([
			'none',
			'none',
			'med',
			'med',
			'med',
			'med',
		]);
	});

	it.each([
		[0, 'stealth', 'connectorStartArrow'],
		[1, 'diamond', 'connectorEndArrow'],
		[2, 'lg', 'connectorStartArrowWidth'],
		[3, 'sm', 'connectorStartArrowLength'],
		[4, 'lg', 'connectorEndArrowWidth'],
		[5, 'sm', 'connectorEndArrowLength'],
	])('control %i writes %s to the OOXML-backed %s', async (index, value, styleKey) => {
		const wrapper = mount(ConnectorArrowsPanel, {
			props: { element: connector({ strokeColor: '#ff0000' }) },
		});
		const select = wrapper.findAll('label.pptx-vue-connector-arrow-field')[index]!.get('select');
		await select.setValue(value);
		const patch = wrapper.emitted('update')?.[0]?.[0] as { shapeStyle: ShapeStyle };
		expect(patch.shapeStyle[styleKey as keyof ShapeStyle]).toBe(value);
		// The patch carries the MERGED style, so unrelated line properties survive.
		expect(patch.shapeStyle.strokeColor).toBe('#ff0000');
	});

	it('disables every dropdown when the viewer is not editable', () => {
		const wrapper = mount(ConnectorArrowsPanel, {
			props: { element: connector(), canEdit: false },
		});
		const selects = wrapper.findAll('select');
		expect(selects).toHaveLength(6);
		expect(selects.every((s) => (s.element as HTMLSelectElement).disabled)).toBeTruthy();
	});

	// G9 (OpenXML parity audit, D3): a:cxnSpLocks/@noChangeArrowheads already
	// computed `arrowheadsChangeable` in element-locks.ts but nothing here
	// consulted it.
	it('disables every dropdown when the connector locks noChangeArrowheads', () => {
		const wrapper = mount(ConnectorArrowsPanel, {
			props: {
				element: { ...connector(), locks: { noChangeArrowheads: true } } as PptxElement,
			},
		});
		const selects = wrapper.findAll('select');
		expect(selects).toHaveLength(6);
		expect(selects.every((s) => (s.element as HTMLSelectElement).disabled)).toBeTruthy();
	});

	it('ignores a change event on a locked connector (defence in depth)', async () => {
		const wrapper = mount(ConnectorArrowsPanel, {
			props: {
				element: { ...connector(), locks: { noChangeArrowheads: true } } as PptxElement,
			},
		});
		await wrapper
			.findAll('label.pptx-vue-connector-arrow-field')[0]!
			.get('select')
			.setValue('oval');
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('survives an edit / undo round trip through the real editor operations', async () => {
		const element = connector({ connectorStartArrow: 'oval' });
		const slides = shallowRef<PptxSlide[]>([
			{ id: 's1', rId: 'rId-s1', slideNumber: 1, elements: [element] },
		]);
		const history = useEditorHistory(slides);
		const ops = useEditorOperations({
			slides,
			activeSlideIndex: ref(0),
			pushHistory: history.pushHistory,
		});

		const wrapper = mount(ConnectorArrowsPanel, { props: { element } });
		await wrapper
			.findAll('label.pptx-vue-connector-arrow-field')[0]!
			.get('select')
			.setValue('arrow');
		const patch = wrapper.emitted('update')?.[0]?.[0] as Partial<PptxElement>;
		ops.updateElement('conn-1', patch);

		const styleOf = () =>
			(slides.value[0]!.elements[0] as { shapeStyle?: ShapeStyle }).shapeStyle ?? {};
		expect(styleOf().connectorStartArrow).toBe('arrow');
		expect(history.canUndo.value).toBeTruthy();

		history.undo();
		expect(styleOf().connectorStartArrow).toBe('oval');
	});
});
