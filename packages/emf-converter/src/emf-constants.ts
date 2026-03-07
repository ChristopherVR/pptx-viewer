/**
 * EMF / EMF+ / WMF record-type constants and related numeric definitions.
 *
 * These constants mirror the record-type identifiers defined in the
 * Microsoft EMF (MS-EMF), EMF+ (MS-EMFPLUS), and WMF (MS-WMF) specifications.
 * They are used by the record-replay loops to dispatch each record to the
 * correct handler function.
 *
 * @module emf-constants
 */

// ---------------------------------------------------------------------------
// EMF record type constants (32-bit, from [MS-EMF] section 2.1.1)
// ---------------------------------------------------------------------------

/** EMR_HEADER — the mandatory first record of every EMF file. */
export const EMR_HEADER = 1;
export const EMR_POLYBEZIER = 2;
export const EMR_POLYGON = 3;
export const EMR_POLYLINE = 4;
export const EMR_POLYBEZIERTO = 5;
export const EMR_POLYLINETO = 6;
export const EMR_POLYPOLYLINE = 7;
export const EMR_POLYPOLYGON = 8;
export const EMR_SETWINDOWEXTEX = 9;
export const EMR_SETWINDOWORGEX = 10;
export const EMR_SETVIEWPORTEXTEX = 11;
export const EMR_SETVIEWPORTORGEX = 12;
export const EMR_SETBRUSHORGEX = 13;
export const EMR_EOF = 14;
export const EMR_SETPIXELV = 15;
export const EMR_SETMAPMODE = 17;
export const EMR_SETBKMODE = 18;
export const EMR_SETPOLYFILLMODE = 19;
export const EMR_SETROP2 = 20;
export const EMR_SETSTRETCHBLTMODE = 21;
export const EMR_SETTEXTALIGN = 22;
export const EMR_SETTEXTCOLOR = 24;
export const EMR_SETBKCOLOR = 25;
export const EMR_OFFSETCLIPRGN = 26;
export const EMR_MOVETOEX = 27;
export const EMR_SETMETARGN = 28;
export const EMR_EXCLUDECLIPRECT = 29;
export const EMR_INTERSECTCLIPRECT = 30;
export const EMR_SCALEVIEWPORTEXTEX = 31;
export const EMR_SCALEWINDOWEXTEX = 32;
export const EMR_SAVEDC = 33;
export const EMR_RESTOREDC = 34;
export const EMR_SETWORLDTRANSFORM = 35;
export const EMR_MODIFYWORLDTRANSFORM = 36;
export const EMR_SELECTOBJECT = 37;
export const EMR_CREATEPEN = 38;
export const EMR_CREATEBRUSHINDIRECT = 39;
export const EMR_DELETEOBJECT = 40;
export const EMR_ELLIPSE = 42;
export const EMR_RECTANGLE = 43;
export const EMR_ROUNDRECT = 44;
export const EMR_ARC = 45;
export const EMR_CHORD = 46;
export const EMR_PIE = 47;
export const EMR_LINETO = 54;
export const EMR_ARCTO = 55;
export const EMR_SETMITERLIMIT = 58;
export const EMR_BEGINPATH = 59;
export const EMR_ENDPATH = 60;
export const EMR_CLOSEFIGURE = 61;
export const EMR_FILLPATH = 62;
export const EMR_STROKEANDFILLPATH = 63;
export const EMR_STROKEPATH = 64;
export const EMR_SELECTCLIPPATH = 67;
export const EMR_COMMENT = 70;
export const EMR_EXTSELECTCLIPRGN = 75;
export const EMR_BITBLT = 76;
export const EMR_STRETCHDIBITS = 81;
export const EMR_EXTCREATEFONTINDIRECTW = 82;
export const EMR_EXTTEXTOUTW = 84;
export const EMR_POLYBEZIER16 = 85;
export const EMR_POLYGON16 = 86;
export const EMR_POLYLINE16 = 87;
export const EMR_POLYBEZIERTO16 = 88;
export const EMR_POLYLINETO16 = 89;
export const EMR_POLYPOLYGON16 = 91;
export const EMR_EXTCREATEPEN = 95;
export const EMR_SETICMMODE = 98;
export const EMR_SETLAYOUT = 115;

/**
 * Base index for GDI stock objects. Object handles >= this value refer to
 * built-in stock objects (WHITE_BRUSH, BLACK_PEN, etc.) rather than
 * user-created objects in the metafile's object table.
 */
export const STOCK_OBJECT_BASE = 0x80000000;

/**
 * Magic signature found at the start of EMF+ data inside an EMR_COMMENT
 * record payload. The bytes spell "EMF+" in ASCII (little-endian: 0x2B464D45).
 */
export const EMFPLUS_SIGNATURE = 0x2b464d45;

/** Signature for EMR_COMMENT_PUBLIC records. */
export const EMR_COMMENT_PUBLIC_SIGNATURE = 0x43494447; // "GDIC" in ASCII

/** Signature found in EMR_COMMENT_EMFSPOOL records. */
export const EMR_COMMENT_EMFSPOOL_SIGNATURE = 0x00000000;

/** Identifier for EMR_COMMENT_WINDOWS_METAFILE records. */
export const EMR_COMMENT_BEGINGROUP = 0x00000002;
export const EMR_COMMENT_ENDGROUP = 0x00000003;
export const EMR_COMMENT_MULTIFORMATS = 0x40000004;
export const EMR_COMMENT_UNICODE_STRING = 0x00000040;
export const EMR_COMMENT_UNICODE_END = 0x00000080;

// ---------------------------------------------------------------------------
// EMF+ record type constants
// ---------------------------------------------------------------------------

export const EMFPLUS_HEADER = 0x4001;
export const EMFPLUS_ENDOFFILE = 0x4002;
export const EMFPLUS_GETDC = 0x4004;
export const EMFPLUS_OBJECT = 0x4008;
export const EMFPLUS_FILLRECTS = 0x400a;
export const EMFPLUS_DRAWRECTS = 0x400b;
export const EMFPLUS_FILLPOLYGON = 0x400c;
export const EMFPLUS_DRAWLINES = 0x400d;
export const EMFPLUS_FILLELLIPSE = 0x400e;
export const EMFPLUS_DRAWELLIPSE = 0x400f;
export const EMFPLUS_FILLPIE = 0x4010;
export const EMFPLUS_DRAWPIE = 0x4011;
export const EMFPLUS_DRAWARC = 0x4012;
export const EMFPLUS_FILLPATH = 0x4014;
export const EMFPLUS_DRAWPATH = 0x4015;
export const EMFPLUS_DRAWIMAGE = 0x401a;
export const EMFPLUS_DRAWIMAGEPOINTS = 0x401b;
export const EMFPLUS_DRAWSTRING = 0x401c;
export const EMFPLUS_SETANTIALIASMODE = 0x401e;
export const EMFPLUS_SETTEXTRENDERINGHINT = 0x401f;
export const EMFPLUS_SETINTERPOLATIONMODE = 0x4021;
export const EMFPLUS_SETPIXELOFFSETMODE = 0x4022;
export const EMFPLUS_SETCOMPOSITINGQUALITY = 0x4024;
export const EMFPLUS_SAVE = 0x4025;
export const EMFPLUS_RESTORE = 0x4026;
export const EMFPLUS_BEGINCONTAINERNOPARAMS = 0x4028;
export const EMFPLUS_ENDCONTAINER = 0x4029;
export const EMFPLUS_SETWORLDTRANSFORM = 0x402a;
export const EMFPLUS_RESETWORLDTRANSFORM = 0x402b;
export const EMFPLUS_MULTIPLYWORLDTRANSFORM = 0x402c;
export const EMFPLUS_TRANSLATEWORLDTRANSFORM = 0x402d;
export const EMFPLUS_SCALEWORLDTRANSFORM = 0x402e;
export const EMFPLUS_ROTATEWORLDTRANSFORM = 0x402f;
export const EMFPLUS_SETPAGETRANSFORM = 0x4030;
export const EMFPLUS_RESETCLIP = 0x4031;
export const EMFPLUS_SETCLIPRECT = 0x4032;
export const EMFPLUS_SETCLIPPATH = 0x4033;
export const EMFPLUS_SETCLIPREGION = 0x4034;
export const EMFPLUS_DRAWDRIVERSTRING = 0x4036;
export const EMFPLUS_OFFSETCLIP = 0x4035;
export const EMFPLUS_FILLCLOSEDCURVE = 0x4016;
export const EMFPLUS_DRAWCLOSEDCURVE = 0x4017;
export const EMFPLUS_DRAWCURVE = 0x4018;
export const EMFPLUS_DRAWBEZIERS = 0x4019;
export const EMFPLUS_BEGINCONTAINER = 0x4027;
export const EMFPLUS_COMMENT = 0x4003;

// EMF+ object types (used in EMFPLUS_OBJECT record)
export const EMFPLUS_OBJECTTYPE_BRUSH = 0x01;
export const EMFPLUS_OBJECTTYPE_PEN = 0x02;
export const EMFPLUS_OBJECTTYPE_PATH = 0x03;
export const EMFPLUS_OBJECTTYPE_IMAGEATTRIBUTES = 0x04;
export const EMFPLUS_OBJECTTYPE_IMAGE = 0x05;
export const EMFPLUS_OBJECTTYPE_FONT = 0x06;
export const EMFPLUS_OBJECTTYPE_STRINGFORMAT = 0x07;
export const EMFPLUS_OBJECTTYPE_REGION = 0x08;
export const EMFPLUS_OBJECTTYPE_CUSTOMLINECAP = 0x09;

// EMF+ brush types
export const EMFPLUS_BRUSHTYPE_SOLID = 0;
export const EMFPLUS_BRUSHTYPE_HATCHFILL = 1;
export const EMFPLUS_BRUSHTYPE_PATHGRADIENT = 3;
export const EMFPLUS_BRUSHTYPE_LINEARGRADIENT = 4;

// ---------------------------------------------------------------------------
// WMF record type constants (16-bit)
// ---------------------------------------------------------------------------

export const META_EOF = 0x0000;
export const META_SETBKCOLOR = 0x0201;
export const META_SETBKMODE = 0x0102;
export const META_SETROP2 = 0x0104;
export const META_SETPOLYFILLMODE = 0x0106;
export const META_SETTEXTCOLOR = 0x0209;
export const META_SETTEXTALIGN = 0x012e;
export const META_SETWINDOWORG = 0x020b;
export const META_SETWINDOWEXT = 0x020c;
export const META_MOVETO = 0x0214;
export const META_LINETO = 0x0213;
export const META_RECTANGLE = 0x041b;
export const META_ROUNDRECT = 0x061c;
export const META_ELLIPSE = 0x0418;
export const META_ARC = 0x0817;
export const META_PIE = 0x081a;
export const META_CHORD = 0x0830;
export const META_POLYGON = 0x0324;
export const META_POLYLINE = 0x0325;
export const META_SELECTOBJECT = 0x012d;
export const META_DELETEOBJECT = 0x01f0;
export const META_CREATEPENINDIRECT = 0x02fa;
export const META_CREATEBRUSHINDIRECT = 0x02fc;
export const META_CREATEFONTINDIRECT = 0x02fb;
export const META_TEXTOUT = 0x0521;
export const META_EXTTEXTOUT = 0x0a32;
export const META_SAVEDC = 0x001e;
export const META_RESTOREDC = 0x0127;
export const META_POLYPOLYGON = 0x0538;
