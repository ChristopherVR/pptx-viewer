import type { PptxHandler } from 'pptx-viewer-core';
import type {
	AutosaveActivation,
	AutosaveRecord,
	AutosaveRecoveryOffer,
	DeckSaveIntent,
} from 'pptx-viewer-shared';
import {
	acceptAutosaveRecovery,
	discardAutosaveRecovery,
	resolveAutosaveActivation,
	resolveAutosaveIntervalMs,
	shouldShowAutosaveRecoveryPrompt,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { AutosaveController, AutosaveStatus } from './autosave-controller';
import { createAutosaveController } from './autosave-controller';
import { openAutosaveRecoveryDialog } from './autosave-recovery-dialog';

/**
 * One viewer's recovery-autosave session: the shared activation policy, the
 * shared cadence, the debounced controller and the crash-recovery prompt, wired
 * together so `session-controllers` only has to forward calls.
 *
 * ## The rule (identical in all five bindings)
 *
 * The host's `autosave` option is a POLICY CEILING and the title-bar AutoSave
 * switch is the user's PREFERENCE inside it: `autosave: false` turns recovery
 * autosave off AND makes the switch inert, while `true` (or omitting it)
 * permits autosave and lets the switch decide, defaulting to ON. Editing being
 * possible at all and a `filePath` to key the snapshot are non-negotiable gates
 * on top. See `pptx-viewer-shared/render/autosave-policy`.
 *
 * ## Cadence
 *
 * An explicit `autosaveIntervalMs` option wins; otherwise the user's
 * File > Options > Save > "Save AutoRecover information every N minutes";
 * otherwise the shared two-minute default. It is re-read every time the
 * debounce timer is armed, so an Options change applies without a re-mount.
 */
export interface AutosaveSessionDeps {
	doc: Document;
	store: Store<ViewerState>;
	getHandler: () => PptxHandler | null;
	getTranslator: () => Translator;
	/** The host's `autosave` option: the policy ceiling (`undefined` = permitted). */
	hostAutosave: boolean | undefined;
	/** The host's explicit `autosaveIntervalMs` option, when it passed one. */
	hostIntervalMs: number | undefined;
	/** IndexedDB key for the recovery snapshot. */
	filePath: string;
	/** Protect-Presentation state, forwarded to the shared save decision. */
	getSaveIntent(): DeckSaveIntent;
	onStatus(status: AutosaveStatus): void;
	/** The host's `onAutosaveRecovery` hook; the prompt is additional, not a replacement. */
	onRecovery?: (record: AutosaveRecord) => void;
	/** Load restored bytes through the viewer's normal load path. */
	loadFile(bytes: Uint8Array): Promise<void>;
}

export interface AutosaveSession {
	/** Force an immediate snapshot (no-op when autosave is not active). */
	saveNow(): Promise<void>;
	/** What actually runs right now (the shared verdict's `active`). */
	isEnabled(): boolean;
	/** The user's AutoSave preference, i.e. what the title-bar switch shows. */
	isPreferred(): boolean;
	/** The full shared verdict (`active` / `toggleAvailable` / `reason`). */
	getActivation(): AutosaveActivation;
	/**
	 * Apply the user's toggle. Returns whether it was applied: `false` when the
	 * host forbade autosave (the switch is inert then, because a preference can
	 * never exceed the policy) or when nothing changed.
	 */
	setEnabled(enabled: boolean): boolean;
	/** File > Options > Save AutoRecover cadence in ms (`undefined` = unset). */
	setOptionsIntervalMs(ms: number | undefined): void;
	destroy(): void;
}

export function createAutosaveSession(deps: AutosaveSessionDeps): AutosaveSession {
	// The preference starts ON wherever the host permits autosave: crash
	// recovery that is off by default is crash recovery nobody has.
	let userEnabled = deps.hostAutosave ?? true;
	let optionsIntervalSeconds: number | undefined;

	const activation = (): AutosaveActivation =>
		resolveAutosaveActivation({
			hostAutosave: deps.hostAutosave,
			userEnabled,
			canEdit: deps.store.get().editable,
			filePath: deps.filePath,
		});

	// A running slide show has no editor chrome, and this prompt is modal: left
	// mounted it puts a full-area backdrop over the stage that swallows
	// action-button clicks. So an offer that arrives mid-show is HELD, and opened
	// when the show ends. Deferred, not dropped: the snapshot is not going
	// anywhere, and interrupting someone's presentation with a modal about crash
	// recovery is the worse outcome.
	let pendingOffer: AutosaveRecoveryOffer | null = null;
	let dialogOpen = false;

	const offerRecovery = async (offer: AutosaveRecoveryOffer): Promise<void> => {
		dialogOpen = true;
		try {
			const choice = await openAutosaveRecoveryDialog(deps.doc, deps.getTranslator(), offer.prompt);
			if (choice === 'restore') {
				await deps.loadFile(acceptAutosaveRecovery(offer.record));
			} else if (choice === 'discard') {
				await discardAutosaveRecovery(offer.record);
			}
		} finally {
			dialogOpen = false;
		}
	};

	/** Open the held offer if the moment is right; otherwise keep holding it. */
	const flushRecoveryOffer = (): void => {
		const offer = pendingOffer;
		if (
			!offer ||
			dialogOpen ||
			!shouldShowAutosaveRecoveryPrompt({
				prompt: offer.prompt,
				presenting: deps.store.get().presenting,
			})
		) {
			return;
		}
		pendingOffer = null;
		void offerRecovery(offer);
	};

	// The only transition that can unblock a held offer.
	const unsubscribePresenting = deps.store.subscribe((state, previous) => {
		if (previous.presenting && !state.presenting) {
			flushRecoveryOffer();
		}
	});

	const controller: AutosaveController = createAutosaveController({
		store: deps.store,
		getHandler: deps.getHandler,
		filePath: deps.filePath,
		getIntervalMs: () =>
			resolveAutosaveIntervalMs({
				hostIntervalMs: deps.hostIntervalMs,
				optionsIntervalSeconds,
			}),
		getSaveIntent: deps.getSaveIntent,
		onStatus: deps.onStatus,
		getActivation: activation,
		// The ceiling alone: a user who merely switched the toggle off should
		// still be asked about work a crash left behind.
		isRecoveryAllowed: () => deps.hostAutosave !== false,
		onRecovery: deps.onRecovery,
		onRecoveryOffer: (offer) => {
			pendingOffer = offer;
			flushRecoveryOffer();
		},
	});

	return {
		saveNow: () => controller.saveNow(),
		isEnabled: () => controller.isEnabled(),
		isPreferred: () => activation().toggleAvailable && userEnabled,
		getActivation: activation,
		setEnabled(enabled) {
			if (!activation().toggleAvailable || userEnabled === enabled) {
				return false;
			}
			userEnabled = enabled;
			controller.refresh();
			return true;
		},
		setOptionsIntervalMs(ms) {
			optionsIntervalSeconds =
				typeof ms === 'number' && Number.isFinite(ms) ? ms / 1000 : undefined;
		},
		destroy: () => {
			unsubscribePresenting();
			controller.destroy();
		},
	};
}
