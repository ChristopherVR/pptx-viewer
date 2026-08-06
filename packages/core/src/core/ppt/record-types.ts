/**
 * Record type constants for the MS-PPT binary format and the embedded
 * OfficeArt (MS-ODRAW) drawing records.
 *
 * Values are verified against [MS-PPT] section 2.13.24 (RecordType) and
 * [MS-ODRAW] section 2.2 record definitions.
 *
 * @module ppt/record-types
 */

/** MS-PPT record types found in the PowerPoint Document stream. */
export const RT = {
	Document: 0x03e8,
	DocumentAtom: 0x03e9,
	EndDocumentAtom: 0x03ea,
	Slide: 0x03ee,
	SlideAtom: 0x03ef,
	Notes: 0x03f0,
	NotesAtom: 0x03f1,
	Environment: 0x03f2,
	SlidePersistAtom: 0x03f3,
	MainMaster: 0x03f8,
	SlideShowSlideInfoAtom: 0x03f9,
	SlideViewInfo: 0x03fa,
	ExternalObjectList: 0x0409,
	DrawingGroup: 0x040b,
	Drawing: 0x040c,
	List: 0x07d0,
	FontCollection: 0x07d5,
	SoundCollection: 0x07e4,
	Sound: 0x07e6,
	ColorSchemeAtom: 0x07f0,
	OEPlaceholderAtom: 0x0bc3,
	RoundTripSlideSyncInfo12: 0x0bc4,
	OutlineTextRefAtom: 0x0f9e,
	TextHeaderAtom: 0x0f9f,
	TextCharsAtom: 0x0fa0,
	StyleTextPropAtom: 0x0fa1,
	MasterTextPropAtom: 0x0fa2,
	TextMasterStyleAtom: 0x0fa3,
	TextBytesAtom: 0x0fa8,
	TextSpecInfoAtom: 0x0faa,
	SlideListWithText: 0x0ff0,
	UserEditAtom: 0x0ff5,
	CurrentUserAtom: 0x0ff6,
	FontEntityAtom: 0x0fb7,
	CryptSession10Container: 0x2f14,
	PersistDirectoryAtom: 0x1772,
	HeadersFooters: 0x0fd9,
	HeadersFootersAtom: 0x0fda,
	ProgTags: 0x1388,
	ProgBinaryTag: 0x138a,
	BinaryTagDataBlob: 0x138b,
	RoundTripCustomTableStyles12Atom: 0x428c,
} as const;

/** OfficeArt (Escher / MS-ODRAW) record types. */
export const OA = {
	DggContainer: 0xf000,
	BStoreContainer: 0xf001,
	DgContainer: 0xf002,
	SpgrContainer: 0xf003,
	SpContainer: 0xf004,
	SolverContainer: 0xf005,
	Dgg: 0xf006,
	FBSE: 0xf007,
	Dg: 0xf008,
	FSPGR: 0xf009,
	FSP: 0xf00a,
	FOPT: 0xf00b,
	ClientTextbox: 0xf00d,
	ChildAnchor: 0xf00f,
	ClientAnchor: 0xf010,
	ClientData: 0xf011,
	SplitMenuColors: 0xf11e,
	TertiaryFOPT: 0xf122,
	/** BLIP record type range within a BStore / Pictures stream. */
	BlipFirst: 0xf018,
	BlipLast: 0xf117,
	BlipEmf: 0xf01a,
	BlipWmf: 0xf01b,
	BlipPict: 0xf01c,
	BlipJpeg: 0xf01d,
	BlipPng: 0xf01e,
	BlipDib: 0xf01f,
	BlipTiff: 0xf029,
	BlipJpegCmyk: 0xf02a,
} as const;

/** TextHeaderAtom text types ([MS-PPT] 2.13.33 TextTypeEnum). */
export const TEXT_TYPE = {
	title: 0,
	body: 1,
	notes: 2,
	other: 4,
	centerBody: 5,
	centerTitle: 6,
	halfBody: 7,
	quarterBody: 8,
} as const;

/** CurrentUserAtom headerToken for a plaintext document. */
export const HEADER_TOKEN_PLAIN = 0xe391c05f;
/** CurrentUserAtom headerToken for an encrypted document. */
export const HEADER_TOKEN_ENCRYPTED = 0xf3d1c4df;

/** EMU per PowerPoint master unit (1/576 inch): 914400 / 576. */
export const EMU_PER_MASTER = 914400 / 576;

/** Convert master units to EMU (rounded). */
export function masterToEmu(mu: number): number {
	return Math.round(mu * EMU_PER_MASTER);
}
