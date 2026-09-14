import type { PptxElement } from 'pptx-viewer-core';
import {
	attachInlineListController,
	bindInlineListParagraph,
	bindInlineListRun,
	createInlineListSeed,
	createInlineListModelObserver,
	inlineListBodyText,
	readEditableText,
	readListActivationSelection,
	restoreInlineListBodySelection,
} from 'pptx-viewer-shared';
import type { InlineTextEditSnapshot } from 'pptx-viewer-shared';
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { DEFAULT_TEXT_COLOR } from '../../constants';
import { renderTextSegments } from '../../utils';

/** List DOM stays native-owned, including after its last bullet is toggled off. */
export function useInlineListEditor(
	element: PptxElement,
	rootRef: RefObject<HTMLDivElement | null>,
	onChange: (text: string, snapshot?: InlineTextEditSnapshot) => void,
	onModelReplacement: () => void,
) {
	const initial = useRef<{
		seed: ReturnType<typeof createInlineListSeed>;
		children: React.ReactNode;
		activationSelection?: { start: number; end: number };
		model: ReturnType<typeof createInlineListModelObserver>;
	} | null>(null);
	let activationMismatch = false;
	if (!initial.current?.seed) {
		const liveRoot = initial.current ? rootRef.current : null;
		const modelBody = inlineListBodyText(
			'textSegments' in element ? element.textSegments : undefined,
		);
		const candidate = createInlineListSeed(element);
		activationMismatch = Boolean(candidate && liveRoot && readEditableText(liveRoot) !== modelBody);
		const seed = activationMismatch ? undefined : candidate;
		const activationSelection =
			initial.current && seed && rootRef.current
				? readListActivationSelection(
						rootRef.current,
						inlineListBodyText('textSegments' in element ? element.textSegments : undefined),
					)
				: undefined;
		if (!initial.current || seed) {
			initial.current = {
				seed,
				model: createInlineListModelObserver(element),
				activationSelection,
				children: seed
					? renderTextSegments(
							element,
							DEFAULT_TEXT_COLOR,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							seed,
						)
					: undefined,
			};
		}
	}
	const session = initial.current;
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onModelReplacementRef = useRef(onModelReplacement);
	onModelReplacementRef.current = onModelReplacement;
	const controllerRef = useRef<ReturnType<typeof attachInlineListController> | null>(null);
	const retiredRef = useRef(false);
	useLayoutEffect(() => {
		if (!activationMismatch) {
			return;
		}
		// The replacement model owns this body, as with Undo during an active list session.
		retiredRef.current = true;
		onModelReplacementRef.current();
	}, [activationMismatch]);
	useLayoutEffect(() => {
		const root = rootRef.current;
		const seed = session.seed;
		if (!root || !seed) {
			return;
		}
		retiredRef.current = false;
		for (const paragraph of seed.paragraphs) {
			const block = root.querySelector(`[data-pptx-list-paragraph="${paragraph.token}"]`);
			if (block) {
				bindInlineListParagraph(seed, block, paragraph.sourceIndex);
			}
			for (const run of paragraph.runs) {
				const node = block?.querySelector(`[data-pptx-list-run="${run.token}"]`);
				if (node) {
					bindInlineListRun(seed, node, run.segmentIndex);
				}
			}
		}
		let active = true;
		const controller = attachInlineListController(root, seed, {
			isCurrent: () => active && rootRef.current === root,
			onFormat: (snapshot) => session.model.expect(snapshot),
			onRead: (result) => {
				if (result.kind === 'supported') {
					onChangeRef.current(result.snapshot.text, result.snapshot);
				} else {
					onChangeRef.current(result.text);
				}
			},
		});
		controllerRef.current = controller;
		controller.refresh();
		if (session.activationSelection) {
			root.focus();
			restoreInlineListBodySelection(seed, root, session.activationSelection);
		}
		return () => {
			active = false;
			retiredRef.current = true;
			controller.dispose();
			controllerRef.current = null;
		};
	}, [rootRef, session]);
	useLayoutEffect(() => {
		const controller = controllerRef.current;
		if (!controller) {
			return;
		}
		const change = session.model.check(element, controller.read());
		if (change.kind === 'current') {
			return;
		}
		if (change.kind === 'format' && controller.format(change.snapshot).kind === 'supported') {
			return;
		}
		// Undo/external replacement owns the model. Never blur-commit the superseded DOM.
		retiredRef.current = true;
		controller.dispose();
		controllerRef.current = null;
		onModelReplacementRef.current();
	}, [element, session]);
	return {
		...session,
		canCommit: () => !retiredRef.current,
		retire: () => {
			retiredRef.current = true;
			controllerRef.current?.dispose();
			controllerRef.current = null;
		},
		publish: () => {
			if (retiredRef.current) {
				return true;
			}
			if (!controllerRef.current) {
				return false;
			}
			controllerRef.current.refresh();
			return true;
		},
	};
}
