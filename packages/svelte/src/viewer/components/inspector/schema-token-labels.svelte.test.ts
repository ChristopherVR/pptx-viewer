import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import {
	ARROWHEAD_LABEL_KEYS,
	BEVEL_PRESETS,
	FILL_PATTERN_LABEL_KEYS,
	MATERIAL_PRESETS,
	SMARTART_COLOR_SCHEME_LABEL_KEYS,
	SMARTART_STYLE_LABEL_KEYS,
	TEXT_WARP_PRESETS,
} from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ShapeSection from './ShapeSection.svelte';
import SmartArtSection from './SmartArtSection.svelte';
import TableCellSection from './TableCellSection.svelte';
import TextEffectsSection from './TextEffectsSection.svelte';

/**
 * Regression cover for the inspector selects that used to render OOXML wire
 * tokens as if they were English (`stealth`, `relaxedInset`, `ltDnDiag`,
 * `monochromatic1`). Every assertion checks the option TEXT and the option
 * VALUES together: the values are the parity contract with the other bindings
 * and must not move when the spelling does.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** Only the label's own text nodes, so nested option text is excluded. */
function ownText(element: Element): string {
	return Array.from(element.childNodes)
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent ?? '')
		.join('')
		.trim();
}

function selectFor(root: ParentNode, caption: string): HTMLSelectElement {
	for (const label of Array.from(root.querySelectorAll('label'))) {
		if (ownText(label) === caption) {
			const select = label.querySelector('select');
			if (select) {
				return select;
			}
		}
	}
	throw new Error(`no select captioned "${caption}"`);
}

function values(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.value);
}

function texts(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.textContent?.trim() ?? '');
}

function translated(keys: Readonly<Record<string, string>>, tokens: readonly string[]): string[] {
	return tokens.map((token) => translationsEn[keys[token]]);
}

/** Pick display labels out of a shared preset catalogue, in caller order. */
function presetLabels(
	presets: ReadonlyArray<{ value: string; label: string }>,
	tokens: readonly string[],
): string[] {
	return tokens.map(
		(token) => presets.find((preset) => preset.value === token)?.label ?? `missing:${token}`,
	);
}

function mountAt<Props extends Record<string, unknown>>(
	component: Parameters<typeof mount>[0],
	props: Props,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

function editorWith(element: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	return editor;
}

describe('shapeSection arrowhead selects', () => {
	const arrows = ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'];

	it('spells both connector arrowheads', () => {
		const element: PptxElement = {
			type: 'connector',
			id: 'k1',
			x: 0,
			y: 0,
			width: 100,
			height: 10,
			shapeStyle: { connectorStartArrow: 'none', connectorEndArrow: 'triangle' },
		} as PptxElement;
		const target = mountAt(ShapeSection, { editor: editorWith(element), el: element });

		for (const caption of ['Start arrow', 'End arrow']) {
			const select = selectFor(target, caption);
			expect(values(select)).toStrictEqual(arrows);
			expect(texts(select)).toStrictEqual(translated(ARROWHEAD_LABEL_KEYS, arrows));
		}
	});
});

describe('textEffectsSection preset selects', () => {
	const warps = [
		'archUp',
		'archDown',
		'circle',
		'wave1',
		'wave2',
		'inflate',
		'deflate',
		'fadeRight',
		'slantUp',
		'triangle',
	];
	const materials = ['matte', 'plastic', 'metal', 'warmMatte', 'softEdge', 'flat'];
	const bevels = ['none', 'circle', 'relaxedInset', 'coolSlant', 'angle', 'softRound', 'convex'];

	function textElement(): PptxElement {
		return {
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 200,
			height: 50,
			content: 'Hello',
			textStyle: {
				textWarpPreset: 'archUp',
				text3d: { presetMaterial: 'plastic', bevelTopType: 'circle' },
			},
		} as PptxElement;
	}

	it('labels warp, material and bevel from the shared preset catalogues', () => {
		const element = textElement();
		const target = mountAt(TextEffectsSection, { editor: editorWith(element), el: element });

		const warp = selectFor(target, 'Warp');
		// The 'none' sentinel stays first; only the ten preset rows are relabelled.
		expect(values(warp)).toStrictEqual(['none', ...warps]);
		expect(texts(warp)).toStrictEqual([
			'None',
			// The catalogue is keyed on the `text`-prefixed schema value even
			// though the panel stores (and still submits) the short form.
			...presetLabels(
				TEXT_WARP_PRESETS,
				warps.map((token) => `text${token[0].toUpperCase()}${token.slice(1)}`),
			),
		]);

		const material = selectFor(target, 'Material');
		expect(values(material)).toStrictEqual(materials);
		expect(texts(material)).toStrictEqual(presetLabels(MATERIAL_PRESETS, materials));

		const bevel = selectFor(target, 'Bevel');
		expect(values(bevel)).toStrictEqual(bevels);
		expect(texts(bevel)).toStrictEqual(presetLabels(BEVEL_PRESETS, bevels));
	});

	it('still stores the short warp token when a preset is picked', () => {
		const element = textElement();
		const editor = editorWith(element);
		const target = mountAt(TextEffectsSection, { editor, el: element });
		const warp = selectFor(target, 'Warp');
		warp.value = 'slantUp';
		warp.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const selected = editor.selectedElement;
		expect(
			selected && 'textStyle' in selected ? selected.textStyle?.textWarpPreset : undefined,
		).toBe('slantUp');
	});
});

describe('tableCellSection pattern and alignment selects', () => {
	const patterns = ['ltDnDiag', 'ltUpDiag', 'smGrid', 'lgGrid', 'pct20', 'pct50', 'zigZag'];

	function table(): PptxTableData {
		return {
			rows: [
				{ cells: [{ text: 'A', style: { fillMode: 'pattern', align: 'left', vAlign: 'top' } }] },
			],
			columnWidths: [1],
		};
	}

	it('spells the fill patterns without widening the select', () => {
		const target = mountAt(TableCellSection, { table: table(), onpatch: () => undefined });
		const select = selectFor(target, 'Pattern');

		expect(values(select)).toStrictEqual(patterns);
		expect(texts(select)).toStrictEqual(translated(FILL_PATTERN_LABEL_KEYS, patterns));
	});

	it('translates both alignment selects while keeping their wire values', () => {
		const target = mountAt(TableCellSection, { table: table(), onpatch: () => undefined });

		const horizontal = selectFor(target, 'Horizontal');
		expect(values(horizontal)).toStrictEqual(['left', 'center', 'right', 'justify']);
		expect(texts(horizontal)).toStrictEqual(['Left', 'Center', 'Right', 'Justify']);

		const vertical = selectFor(target, 'Vertical');
		expect(values(vertical)).toStrictEqual(['top', 'middle', 'bottom']);
		expect(texts(vertical)).toStrictEqual(['Top', 'Middle', 'Bottom']);
	});

	it('writes the wire value, not the label, when an alignment is picked', () => {
		let patched: Partial<PptxTableData> | undefined;
		const target = mountAt(TableCellSection, {
			table: table(),
			onpatch: (patch: Partial<PptxTableData>) => {
				patched = patch;
			},
		});
		const vertical = selectFor(target, 'Vertical');
		vertical.value = 'middle';
		vertical.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(patched?.rows?.[0]?.cells[0]?.style?.vAlign).toBe('middle');
	});
});

describe('smartArtSection variation selects', () => {
	const schemes = ['colorful1', 'colorful2', 'colorful3', 'monochromatic1', 'monochromatic2'];
	const styles = ['flat', 'moderate', 'intense'];

	function smartArt(): PptxElement {
		return {
			type: 'smartArt',
			id: 'sa1',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			smartArtData: {
				nodes: [{ id: 'n1', text: 'Alpha' }],
				colorScheme: 'colorful1',
				style: 'moderate',
			},
		} as PptxElement;
	}

	it('spells the colour scheme and diagram style tokens', () => {
		const element = smartArt();
		const target = mountAt(SmartArtSection, { editor: editorWith(element), el: element });

		const scheme = target.querySelector<HTMLSelectElement>('[data-testid="smartart-color-scheme"]');
		if (!scheme) {
			throw new Error('colour-scheme select missing');
		}
		expect(values(scheme)).toStrictEqual(schemes);
		expect(texts(scheme)).toStrictEqual(translated(SMARTART_COLOR_SCHEME_LABEL_KEYS, schemes));

		const selects = Array.from(target.querySelectorAll('select'));
		const style = selects.find((select) => values(select).join() === styles.join());
		if (!style) {
			throw new Error('diagram-style select missing');
		}
		expect(texts(style)).toStrictEqual(translated(SMARTART_STYLE_LABEL_KEYS, styles));
	});
});
