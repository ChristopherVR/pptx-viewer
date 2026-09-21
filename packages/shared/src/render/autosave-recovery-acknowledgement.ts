/** Per-tab acknowledgements: reloads keep them, a fresh tab starts clean. */
const AUTOSAVE_RECOVERY_ACKNOWLEDGEMENTS_KEY = 'pptx-viewer-autosave-recovery-acknowledgements';

type AutosaveRecoveryAcknowledgement = readonly [filePath: string, timestamp: number];

function readAutosaveRecoveryAcknowledgements(): Map<string, number> {
	try {
		if (typeof sessionStorage === 'undefined') {
			return new Map();
		}
		const raw = sessionStorage.getItem(AUTOSAVE_RECOVERY_ACKNOWLEDGEMENTS_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) {
			return new Map();
		}
		const entries = parsed.filter(
			(value): value is AutosaveRecoveryAcknowledgement =>
				Array.isArray(value) &&
				value.length === 2 &&
				typeof value[0] === 'string' &&
				typeof value[1] === 'number' &&
				Number.isFinite(value[1]),
		);
		return new Map(entries);
	} catch {
		return new Map();
	}
}

/** The exact snapshot this tab has already loaded for `filePath`, if any. */
export function getAcknowledgedAutosaveRecoveryTimestamp(filePath: string): number | undefined {
	return readAutosaveRecoveryAcknowledgements().get(filePath);
}

/** Remember that this tab has loaded this exact snapshot without deleting it. */
export function acknowledgeAutosaveRecovery(record: { key: string; timestamp: number }): void {
	if (!record.key || !Number.isFinite(record.timestamp)) {
		return;
	}
	try {
		if (typeof sessionStorage === 'undefined') {
			return;
		}
		const acknowledgements = readAutosaveRecoveryAcknowledgements();
		acknowledgements.set(record.key, record.timestamp);
		sessionStorage.setItem(
			AUTOSAVE_RECOVERY_ACKNOWLEDGEMENTS_KEY,
			JSON.stringify([...acknowledgements]),
		);
	} catch {
		// A blocked sessionStorage must not prevent recovery from loading.
	}
}

/** Undo an acknowledgement when loading that exact snapshot failed. */
export function clearAutosaveRecoveryAcknowledgement(record: {
	key: string;
	timestamp: number;
}): void {
	try {
		if (typeof sessionStorage === 'undefined') {
			return;
		}
		const acknowledgements = readAutosaveRecoveryAcknowledgements();
		if (acknowledgements.get(record.key) !== record.timestamp) {
			return;
		}
		acknowledgements.delete(record.key);
		if (acknowledgements.size === 0) {
			sessionStorage.removeItem(AUTOSAVE_RECOVERY_ACKNOWLEDGEMENTS_KEY);
			return;
		}
		sessionStorage.setItem(
			AUTOSAVE_RECOVERY_ACKNOWLEDGEMENTS_KEY,
			JSON.stringify([...acknowledgements]),
		);
	} catch {
		// A blocked sessionStorage already behaves as if nothing was acknowledged.
	}
}
