import { describe, expect, it } from 'vitest';

import { EditorSelection } from './editor-selection.svelte';

/**
 * EditorSelection is a runes class (`.svelte.ts`); this suite is named
 * `.svelte.test.ts` so the module is compiled with the runes runtime.
 */

describe('editor selection', () => {
	it('starts empty', () => {
		const selection = new EditorSelection();
		expect(selection.ids).toStrictEqual([]);
		expect(selection.primary).toBeNull();
		expect(selection.size).toBe(0);
	});

	it('set replaces the selection with a single id', () => {
		const selection = new EditorSelection();
		selection.set('a');
		expect(selection.ids).toStrictEqual(['a']);
		expect(selection.primary).toBe('a');
		selection.set('b');
		expect(selection.ids).toStrictEqual(['b']);
	});

	it('set(null) clears the selection', () => {
		const selection = new EditorSelection();
		selection.set('a');
		selection.set(null);
		expect(selection.ids).toStrictEqual([]);
		expect(selection.primary).toBeNull();
	});

	it('setAll replaces the selection and treats the last id as primary', () => {
		const selection = new EditorSelection();
		selection.setAll(['a', 'b', 'c']);
		expect(selection.ids).toStrictEqual(['a', 'b', 'c']);
		expect(selection.primary).toBe('c');
		expect(selection.size).toBe(3);
	});

	it('toggle adds an unselected id and removes a selected one', () => {
		const selection = new EditorSelection();
		selection.toggle('a');
		expect(selection.ids).toStrictEqual(['a']);
		selection.toggle('b');
		expect(selection.ids).toStrictEqual(['a', 'b']);
		expect(selection.primary).toBe('b');
		selection.toggle('a');
		expect(selection.ids).toStrictEqual(['b']);
	});

	it('has reports membership', () => {
		const selection = new EditorSelection();
		selection.setAll(['a', 'b']);
		expect(selection.has('a')).toBeTruthy();
		expect(selection.has('z')).toBeFalsy();
	});

	it('clear empties the selection', () => {
		const selection = new EditorSelection();
		selection.setAll(['a', 'b']);
		selection.clear();
		expect(selection.ids).toStrictEqual([]);
	});

	it('prune drops ids that no longer exist', () => {
		const selection = new EditorSelection();
		selection.setAll(['a', 'b', 'c']);
		selection.prune((id) => id !== 'b');
		expect(selection.ids).toStrictEqual(['a', 'c']);
		expect(selection.primary).toBe('c');
	});

	it('prune is a no-op when every id still exists', () => {
		const selection = new EditorSelection();
		selection.setAll(['a', 'b']);
		selection.prune(() => true);
		expect(selection.ids).toStrictEqual(['a', 'b']);
	});
});
