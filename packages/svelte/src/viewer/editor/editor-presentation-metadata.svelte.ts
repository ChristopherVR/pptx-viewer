import type {
	PptxCustomShow,
	PptxHeaderFooter,
	PptxPresentationProperties,
} from 'pptx-viewer-core';

export interface PresentationMetadataHost {
	readonly editable: boolean;
	pushHistory(): void;
	commitChange(): void;
}

/** Owns presentation-level metadata and its undoable editor mutations. */
export class EditorPresentationMetadata {
	headerFooter = $state.raw<PptxHeaderFooter>({});
	presentationProperties = $state.raw<PptxPresentationProperties>({});
	customShows = $state.raw<PptxCustomShow[]>([]);

	constructor(private readonly host: PresentationMetadataHost) {}

	/**
	 * Deep-copy a value that may be a rune PROXY.
	 *
	 * The dialogs build their edits in `$state`, so what reaches these setters is
	 * a reactive proxy, and `structuredClone` throws `DataCloneError` on one. The
	 * Header & Footer panel hit exactly that: "Apply to All" threw before it ever
	 * assigned, so setting a footer silently did nothing and the canvas kept the
	 * string the deck was loaded with. `$state.snapshot` is a pass-through for a
	 * plain object, so this is safe for every caller.
	 */
	private static clone<T>(value: T): T {
		return structuredClone($state.snapshot(value)) as T;
	}

	set(
		headerFooter: PptxHeaderFooter = {},
		presentationProperties: PptxPresentationProperties = {},
		customShows: PptxCustomShow[] = [],
	): void {
		this.headerFooter = EditorPresentationMetadata.clone(headerFooter);
		this.presentationProperties = EditorPresentationMetadata.clone(presentationProperties);
		this.customShows = EditorPresentationMetadata.clone(customShows);
	}

	updatePresentationProperties(next: PptxPresentationProperties): void {
		this.commit(() => (this.presentationProperties = EditorPresentationMetadata.clone(next)));
	}

	updateHeaderFooter(next: PptxHeaderFooter): void {
		this.commit(() => (this.headerFooter = EditorPresentationMetadata.clone(next)));
	}

	updateCustomShows(next: PptxCustomShow[]): void {
		this.commit(() => (this.customShows = EditorPresentationMetadata.clone(next)));
	}

	private commit(update: () => void): void {
		if (!this.host.editable) {
			return;
		}
		this.host.pushHistory();
		update();
		this.host.commitChange();
	}
}
