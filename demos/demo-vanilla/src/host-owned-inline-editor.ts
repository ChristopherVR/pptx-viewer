import {
	buildInlineTextCommitPatch,
	openInlineEditor,
	overlayInlineTextSnapshot,
} from 'pptx-vanilla-viewer';
import type {
	CollaborationLivePatcher,
	InlineEditorSession,
	PptxElement,
	Store,
	ViewerState,
} from 'pptx-vanilla-viewer';

/** Host UI lifecycle only; the library owns native input, merge and rich-text snapshots. */
export function createHostOwnedInlineEditor(options: {
	root: HTMLElement;
	store: Store<ViewerState>;
	patcher: CollaborationLivePatcher;
	getScale(): number;
	onChange(): void;
}) {
	const { store } = options;
	let session: InlineEditorSession | undefined;
	let target: { slideId: string; elementId: string } | undefined;
	const element = (): PptxElement | undefined => {
		const state = store.get();
		const slide = state.slides[state.currentSlide];
		return slide?.id === target?.slideId
			? slide.elements.find((item) => item.id === target?.elementId)
			: undefined;
	};
	const commit = (): boolean => {
		session?.commit();
		return !session;
	};
	const cancel = (): void => {
		session?.cancel();
	};
	const sync = (): void => {
		if (!session) return;
		const current = element();
		if (!current || (session.checkModel && !session.checkModel(current))) {
			cancel();
			return;
		}
		if (!store.get().editable) {
			const accepted = session.readAccepted?.();
			const slideId = target?.slideId;
			if (session.readAccepted) {
				cancel();
				if (accepted) {
					store.set({
						slides: store
							.get()
							.slides.map((slide) =>
								slide.id === slideId
									? { ...slide, elements: [...overlayInlineTextSnapshot(slide.elements, accepted)] }
									: slide,
							),
					});
				}
			} else {
				commit();
			}
		}
	};
	return {
		commit,
		cancel,
		sync,
		get elementId() {
			return target?.elementId;
		},
		readSlides() {
			sync();
			if (!session?.checkModel) {
				commit();
				return store.get().slides;
			}
			const read = session.readList();
			if (read?.kind === 'unsupported') {
				if (read.reason === 'composition-active' || read.reason === 'input-active') {
					throw new Error('Finish the current text input before saving.');
				}
				cancel();
				return store.get().slides;
			}
			return store
				.get()
				.slides.map((slide) =>
					slide.id === target?.slideId && read?.kind === 'supported'
						? { ...slide, elements: [...overlayInlineTextSnapshot(slide.elements, read.snapshot)] }
						: slide,
				);
		},
		open(current: PptxElement): void {
			if (!store.get().editable || !commit()) return;
			const slide = store.get().slides[store.get().currentSlide];
			const source = slide?.elements.find((item) => item.id === current.id);
			if (!slide || !source) return;
			target = { slideId: slide.id, elementId: current.id };
			const opened = openInlineEditor({
				doc: options.root.ownerDocument,
				overlayRoot: options.root,
				element: source,
				scale: options.getScale(),
				box: { ...source, rotation: source.rotation ?? 0 },
				collaboration: options.patcher.isActive()
					? { patcher: options.patcher, slideId: slide.id }
					: undefined,
				onCommit(text, snapshot) {
					const source = element();
					const patch = buildInlineTextCommitPatch(source, text, snapshot);
					if (source && patch) {
						store.set({
							slides: store.get().slides.map((item) =>
								item.id === target?.slideId
									? {
											...item,
											elements: item.elements.map((value) =>
												value === source ? ({ ...value, ...patch } as PptxElement) : value,
											),
										}
									: item,
							),
						});
					}
				},
				onClose() {
					session = undefined;
					target = undefined;
					options.onChange();
				},
			});
			if (opened.el.isConnected) {
				session = opened;
				opened.el.style.pointerEvents = 'auto';
			}
			options.onChange();
		},
	};
}
