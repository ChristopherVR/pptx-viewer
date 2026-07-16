/** Compatibility barrel for shared live-caption helpers and structural types. */
export {
	captionDisplayText,
	getSpeechRecognitionCtor,
	mergeCaptionResults,
} from '../internal/shared';
export type {
	SpeechAlternative,
	SpeechRecognitionCtor,
	SpeechRecognitionEventLite,
	SpeechRecognitionLite,
	SpeechResult,
	SpeechResultList,
	SpeechSupportState,
} from '../internal/shared';
