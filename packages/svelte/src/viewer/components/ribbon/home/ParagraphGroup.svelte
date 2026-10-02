<script lang="ts">
	/**
	 * ParagraphGroup: the whole Home > Paragraph group as the shared
	 * `pptx-ui-ribbon-home-paragraph` element: Bullets and Numbering toggles with
	 * their library galleries, indent, alignment, line spacing, text direction and
	 * columns. List state comes from semantic paragraph bullets; other formatting
	 * uses the element's base text style. Every edit goes through
	 * `EditorState.patchSelected`; gallery picks go through the ribbon gallery host.
	 */
	import type { TextStyle } from 'pptx-viewer-core';
	import { hasTextProperties } from 'pptx-viewer-core';
	import {
		elementBulletKind,
		homeGalleryControls,
		homeSnapshotTranslator,
		paragraphHomeAction,
		paragraphHomeAlign,
		paragraphHomeControls,
		withHomeGalleries,
	} from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { refocusViewerRoot } from '../anchored-popup';
	import { useRibbonGalleryHost } from '../galleries/ribbon-gallery-host';
	import { homeGalleryId } from './home-adapter';
	import {
		adjustIndentPatch,
		setAlignPatch,
		setColumnCountPatch,
		setLineSpacingPatch,
		setTextDirectionPatch,
		toggleListTypePatch,
	} from '../../../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const host = useRibbonGalleryHost();

	const el = $derived(editor.selectedElement);
	const active = $derived(editor.editable && el !== undefined && hasTextProperties(el));
	const style = $derived<TextStyle>(el && hasTextProperties(el) ? (el.textStyle ?? {}) : {});
	const listKind = $derived(el && hasTextProperties(el) ? elementBulletKind(el) : 'none');

	const state = $derived({
		controls: withHomeGalleries(
			paragraphHomeControls({
				enabled: active,
				align: paragraphHomeAlign(style.align),
				list: listKind === 'bullet' || listKind === 'numbered' ? listKind : 'none',
				lineSpacing: style.lineSpacing,
				columns: style.columnCount,
				textDirection: style.textDirection,
			}),
			homeGalleryControls('paragraph', host?.context() ?? { element: el ?? null }, active),
			active,
		),
		translate: homeSnapshotTranslator(['paragraph'], t),
	});

	function request(event: RibbonHomeRequestEvent): void {
		const { id, value } = event.detail;
		if (!el) {
			return;
		}
		const apply = (patch: Parameters<EditorState['patchSelected']>[0]): void =>
			editor.patchSelected(patch);
		switch (id) {
			case 'home.paragraph.bullets':
			case 'home.paragraph.numbering': {
				if (value !== undefined) {
					const gallery = homeGalleryId('paragraph', id);
					refocusViewerRoot(event.currentTarget as HTMLElement);
					if (gallery) {
						void host?.apply(gallery, String(value));
					}
					return;
				}
				const kind = id === 'home.paragraph.bullets' ? 'bullet' : 'numbered';
				apply((current, snapshot) => toggleListTypePatch(current, kind, snapshot));
				return;
			}
			case 'home.paragraph.lineSpacing':
				apply((current) => setLineSpacingPatch(current, Number(value)));
				return;
			case 'home.paragraph.textDirection':
				apply((current) =>
					setTextDirectionPatch(current, value as TextStyle['textDirection']),
				);
				return;
			case 'home.paragraph.columns':
				apply((current) => setColumnCountPatch(current, Number(value)));
				return;
		}
		const action = paragraphHomeAction(id);
		if (action?.kind === 'indent') {
			apply((current) => adjustIndentPatch(current, action.delta > 0 ? 1 : -1));
		} else if (action) {
			apply((current) => setAlignPatch(current, action.align as TextStyle['align']));
		}
	}
</script>

<pptx-ui-ribbon-home-paragraph {state} onhome-request={request}></pptx-ui-ribbon-home-paragraph>
