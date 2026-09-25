import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryId,
} from 'pptx-viewer-shared';
import { applyRibbonGalleryItem } from 'pptx-viewer-shared';

/** A mounted gallery control the hub keeps in step with the selection. */
export interface RibbonGalleryView {
	refresh(ctx: RibbonGalleryContext, editable: boolean): void;
	close(): void;
}

/**
 * The one place the ribbon's galleries read their context from and send their
 * picks through. The ribbon pushes the selection-derived context in (push-style,
 * like every other Home tab control), and each gallery control registers
 * itself once at construction; that keeps the context out of every group's own
 * `update` signature.
 */
export interface RibbonGalleryHub {
	context(): RibbonGalleryContext;
	register(view: RibbonGalleryView): void;
	/** Rebuild every registered gallery when the selection, theme or editability changed. */
	sync(ctx: RibbonGalleryContext | undefined, editable: boolean): void;
	/** Resolve a tile pick through the shared registry and dispatch the result. */
	pick(gallery: RibbonGalleryId, itemId: string): void;
	closeAll(): void;
}

const EMPTY_CONTEXT: RibbonGalleryContext = { element: null };

export function createRibbonGalleryHub(
	dispatch: (result: RibbonGalleryApplyResult) => void,
): RibbonGalleryHub {
	const views: RibbonGalleryView[] = [];
	let ctx: RibbonGalleryContext = EMPTY_CONTEXT;
	let editable = false;
	let key: readonly unknown[] = [];

	const refreshAll = (): void => {
		for (const view of views) {
			view.refresh(ctx, editable);
		}
	};

	return {
		context: () => ctx,
		register(view) {
			views.push(view);
			view.refresh(ctx, editable);
		},
		sync(next, nextEditable) {
			const resolved = next ?? EMPTY_CONTEXT;
			// The chrome sync runs on every store change; building a gallery
			// serialises dozens of preview SVGs, so only rebuild when something a
			// descriptor reads actually changed.
			const nextKey = [
				resolved.element,
				resolved.theme?.colorScheme,
				resolved.theme?.fontScheme,
				resolved.theme?.name,
				resolved.resolveStyleMatrix !== undefined,
				nextEditable,
			];
			ctx = resolved;
			editable = nextEditable;
			if (nextKey.length === key.length && nextKey.every((value, index) => value === key[index])) {
				return;
			}
			key = nextKey;
			refreshAll();
		},
		pick(gallery, itemId) {
			const result = applyRibbonGalleryItem(gallery, itemId, ctx);
			if (result) {
				dispatch(result);
			}
		},
		closeAll() {
			for (const view of views) {
				view.close();
			}
		},
	};
}
