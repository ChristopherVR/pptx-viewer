/**
 * useContentSource: which bytes the viewer is currently showing.
 *
 * The host's `content` prop is the source of truth, but the built-in
 * File > Open / File > Recent actions have to be able to swap the deck in place
 * without a host round-trip. `internalContent` holds that in-place override and
 * is cleared whenever the host supplies a fresh `content`, so an external reload
 * always wins over a locally-opened file.
 */
import { openPptxFile, readBackstageRecentFile } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref, watch } from 'vue';

export interface UseContentSourceOptions {
	/** Getter for the host's `content` prop (a getter, so host updates are tracked). */
	content: () => Uint8Array | ArrayBuffer;
	/** Getter for the host's `onOpenFile` override, read at click time. */
	onOpenFile: () => (() => void) | undefined;
}

export interface UseContentSourceResult {
	/** In-place override set by the built-in open pickers; null when the host owns the deck. */
	internalContent: Ref<Uint8Array | ArrayBuffer | null>;
	/** The bytes actually loaded: the in-place override if any, else the host's prop. */
	activeContent: ComputedRef<Uint8Array | ArrayBuffer>;
	/** File > Open: host override takes precedence, else a built-in native picker. */
	handleOpenFile: () => void;
	/** File > Recent: load a previously-opened deck back out of the backstage store. */
	handleOpenRecentFile: (key: string) => void;
}

export function useContentSource(options: UseContentSourceOptions): UseContentSourceResult {
	const internalContent = ref<Uint8Array | ArrayBuffer | null>(null);
	watch(options.content, () => {
		internalContent.value = null;
	});
	const activeContent = computed(() => internalContent.value ?? options.content());

	function handleOpenFile(): void {
		const override = options.onOpenFile();
		if (override) {
			override();
			return;
		}
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				internalContent.value = new Uint8Array(picked.buffer);
			}
		})();
	}

	function handleOpenRecentFile(key: string): void {
		void (async () => {
			const bytes = await readBackstageRecentFile(key);
			if (bytes) {
				internalContent.value = bytes;
			}
		})();
	}

	return { internalContent, activeContent, handleOpenFile, handleOpenRecentFile };
}
