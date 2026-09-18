import type { PptxElement } from 'pptx-viewer-core';
import {
	attachInlineListController,
	attachCollaborationInlineEditor,
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
import { useContext, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { DEFAULT_TEXT_COLOR } from '../../constants';
import { renderTextSegments } from '../../utils';
import { InlineCollaborationContext } from './InlineCollaborationContext';
import type { InlineCollaborationContextValue } from './InlineCollaborationContext';

/** List DOM stays native-owned, including after its last bullet is toggled off. */
export function useInlineListEditor(
	element: PptxElement,
	rootRef: RefObject<HTMLDivElement | null>,
	onChange: (text: string, snapshot?: InlineTextEditSnapshot) => void,
	onModelReplacement: () => void,
) {
	const collaboration = useContext(InlineCollaborationContext);
	const initial = useRef<{
		element: PptxElement;
		seed: ReturnType<typeof createInlineListSeed>;
		children: React.ReactNode;
		activationSelection?: { start: number; end: number };
		model: ReturnType<typeof createInlineListModelObserver>;
		collaboration?: InlineCollaborationContextValue;
	} | null>(null);
	let activationMismatch = false;
	if (!initial.current?.seed) {
		const liveRoot = initial.current ? rootRef.current : null;
		const modelBody = inlineListBodyText(
			'textSegments' in element ? element.textSegments : undefined,
		);
		const connected =
			collaboration?.elementIds.has(element.id) &&
			collaboration.patcher.isActive() &&
			collaboration.patcher.beginTextEdit
				? collaboration
				: undefined;
		const candidate = createInlineListSeed(element, { includePlain: Boolean(connected) });
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
				element,
				seed,
				collaboration: connected,
				model: createInlineListModelObserver(element),
				activationSelection,
				children:
					seed && !connected
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
	const controllerRef = useRef<
		| (ReturnType<typeof attachInlineListController> & {
				checkModel?: (model: PptxElement | undefined) => boolean;
				mutate?: (range: AbstractRange, apply: () => void) => boolean;
		  })
		| null
	>(null);
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
		if (session.collaboration) {
			const context = session.collaboration;
			const controller = attachCollaborationInlineEditor(root, session.element, {
				patcher: context.patcher,
				slideId: context.slideId,
				onSnapshot: (snapshot) => onChangeRef.current(snapshot.text, snapshot),
				onCancel: () => {
					retiredRef.current = true;
					onModelReplacementRef.current();
				},
			});
			if (!controller) {
				retiredRef.current = true;
				onModelReplacementRef.current();
				return;
			}
			controllerRef.current = controller;
			const releaseReader = context.registerReader?.(session.element.id, controller.read);
			return () => {
				retiredRef.current = true;
				const current = context.readReadOnlyElement?.(session.element.id);
				const accepted = current && controller.checkModel(current) && controller.readAccepted();
				if (accepted) {
					onChangeRef.current(accepted.text, accepted);
				}
				releaseReader?.();
				controller.dispose();
				if (controllerRef.current === controller) {
					controllerRef.current = null;
				}
			};
		}
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
		if (controller.checkModel) {
			const owner = session.collaboration;
			const sameOwner =
				owner?.patcher === collaboration?.patcher && owner?.slideId === collaboration?.slideId;
			controller.checkModel(sameOwner ? element : undefined);
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
	}, [element, session, collaboration?.patcher, collaboration?.slideId]);
	return {
		...session,
		connected: Boolean(session.collaboration),
		mutate: (range: AbstractRange, apply: () => void) =>
			controllerRef.current?.mutate?.(range, apply) ?? false,
		canCommit: () =>
			!retiredRef.current &&
			(!session.collaboration || controllerRef.current?.read().kind === 'supported'),
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
