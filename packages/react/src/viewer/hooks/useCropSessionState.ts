/**
 * useCropSessionState: the on-canvas picture crop session, held with the rest
 * of the viewer state so the history hook's pointer-interaction gate can see
 * it.
 *
 * While a session is open the picture is updated LIVE by every handle / pan
 * drag, and the history hook must not turn those updates into undo entries:
 * crop mode commits as ONE undo step (or none on cancel). The gate in
 * `hasActivePointerInteraction` reads `cropSessionRef`, so history defers for
 * the whole session and then compares the committed picture against the
 * snapshot taken before crop mode opened.
 *
 * @module useCropSessionState
 */
import type { CropSession } from 'pptx-viewer-shared';
import { useCallback, useRef, useState } from 'react';

export interface CropSessionState {
	/** The open crop session, or null outside crop mode. */
	cropSession: CropSession | null;
	/** Mirror of `cropSession`, readable synchronously by the history gate. */
	cropSessionRef: React.MutableRefObject<CropSession | null>;
	/** Open or close the session; keeps the ref and the state in step. */
	setCropSession: (session: CropSession | null) => void;
}

export function useCropSessionState(): CropSessionState {
	const [cropSession, setCropSession] = useState<CropSession | null>(null);
	const cropSessionRef = useRef<CropSession | null>(null);
	const updateCropSession = useCallback((session: CropSession | null) => {
		cropSessionRef.current = session;
		setCropSession(session);
	}, []);
	return { cropSession, cropSessionRef, setCropSession: updateCropSession };
}
