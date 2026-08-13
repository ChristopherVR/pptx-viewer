import type { AutosaveRecord, AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import {
	acceptAutosaveRecovery,
	discardAutosaveRecovery,
	probeAutosaveRecovery,
	shouldProbeAutosaveRecovery,
} from 'pptx-viewer-shared';

/**
 * autosave-recovery.svelte.ts: offer the crash-recovery snapshot back.
 *
 * This binding has always WRITTEN recovery snapshots (see `autosave.svelte.ts`)
 * and never once offered one back, so the whole feature was invisible: the user
 * lost a tab mid-edit, reopened the deck, and silently got the pre-crash work
 * thrown away. Every decision (is it worth probing, is the snapshot fresh
 * enough, has this tab already taken delivery of it, what should the prompt
 * say) lives in `pptx-viewer-shared`'s `render/autosave-recovery` so all five
 * bindings ask the same questions in the same order; this class is only the
 * runes wiring plus the two actions.
 *
 * It registers its own probing `$effect` in the constructor, exactly like
 * {@link AutosaveController}, so a caller only has to construct it during
 * component initialisation and render `prompt` when it is non-null.
 */

export interface AutosaveRecoveryDeps {
	/** IndexedDB record key (host `filePath`). Nothing to look up without one. */
	getFilePath: () => string | undefined;
	/**
	 * Whether recovery snapshots are permitted at all, which is the HOST prop
	 * (`autosave !== false`) and not the user's toggle: someone who merely
	 * switched AutoSave off should still be offered the pre-crash snapshot that
	 * was written while it was on.
	 */
	getAutosaveAllowed: () => boolean;
	getLoading: () => boolean;
	getError: () => string | null;
	getSlideCount: () => number;
	/** Monotonic load counter: the probe runs once per loaded deck. */
	getLoadCount: () => number;
	/** The loader's own load path, the same one the backstage recent list uses. */
	load: (bytes: Uint8Array) => Promise<void> | void;
}

export class AutosaveRecoveryController {
	/** The prompt to render, or null when there is nothing to recover. */
	prompt = $state.raw<AutosaveRecoveryPrompt | null>(null);

	readonly #deps: AutosaveRecoveryDeps;
	#record: AutosaveRecord | null = null;
	/** `getLoadCount()` value the probe already ran for; -1 means "never". */
	#checkedLoadCount = -1;

	constructor(deps: AutosaveRecoveryDeps) {
		this.#deps = deps;
		$effect(() => {
			const loadCount = deps.getLoadCount();
			const filePath = deps.getFilePath();
			const probe = shouldProbeAutosaveRecovery({
				alreadyChecked: this.#checkedLoadCount === loadCount,
				filePath,
				loading: deps.getLoading(),
				error: deps.getError(),
				slideCount: deps.getSlideCount(),
				autosaveAllowed: deps.getAutosaveAllowed(),
			});
			if (!probe || !filePath) {
				return;
			}
			this.#checkedLoadCount = loadCount;
			void this.#probe(filePath, loadCount);
		});
	}

	async #probe(filePath: string, loadCount: number): Promise<void> {
		const offer = await probeAutosaveRecovery(filePath);
		// A newer load landed while IndexedDB was answering: its own probe owns
		// the prompt, so drop this (now stale) answer instead of overwriting it.
		if (this.#checkedLoadCount !== loadCount) {
			return;
		}
		this.prompt = offer?.prompt ?? null;
		this.#record = offer?.record ?? null;
	}

	/** Take the snapshot: mark it consumed, then load its bytes in place. */
	async restore(): Promise<void> {
		const record = this.#record;
		this.dismiss();
		if (!record) {
			return;
		}
		await this.#deps.load(acceptAutosaveRecovery(record));
	}

	/** Decline the snapshot: delete it, and never load it. */
	async discard(): Promise<void> {
		const record = this.#record;
		this.dismiss();
		if (!record) {
			return;
		}
		await discardAutosaveRecovery(record);
	}

	/** Close the prompt without touching the stored snapshot. */
	dismiss(): void {
		this.prompt = null;
		this.#record = null;
	}
}
