/**
 * Legacy PowerPoint 97-2003 (.ppt) import.
 *
 * @module ppt
 */

export { EncryptedPptError, parseCurrentUserAtom, type CurrentUserAtom } from './current-user';
export { parseDeck, type PptStreams } from './document-parser';
export {
	buildPersistDirectory,
	parsePersistDirectoryAtom,
	parseUserEditAtom,
	type PersistDirectory,
	type UserEditAtom,
	type UserEditChain,
} from './persist-directory';
export { convertPptToPptx, isLegacyPpt } from './ppt-to-pptx';
export type {
	PptAnyShape,
	PptDeck,
	PptGroup,
	PptParagraph,
	PptPicture,
	PptPictureData,
	PptRun,
	PptShape,
	PptSlideModel,
	PptTextBody,
} from './ppt-model';
export {
	PptParseError,
	RECORD_HEADER_SIZE,
	findChild,
	findChildren,
	findDescendant,
	isContainer,
	iterateChildren,
	iterateRecords,
	readRecord,
	readRecordOrThrow,
	recordBytes,
	type PptRecord,
} from './record-stream';
export { OA, RT, TEXT_TYPE, masterToEmu } from './record-types';
