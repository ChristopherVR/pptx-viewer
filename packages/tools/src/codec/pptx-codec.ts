// Compatibility exports: all document operations are owned by OOXML core.
import { apiCodecPptxCodec as operations } from 'ooxml-core/pptx/automation';
export const ORIGIN_FILE_LOAD = operations.ORIGIN_FILE_LOAD;
export type FormatCodec = operations.FormatCodec;
export const SCALAR_ELEMENT_KEYS = operations.SCALAR_ELEMENT_KEYS;
export const COMPLEX_FIELD_MAP = operations.COMPLEX_FIELD_MAP;
export const SCALAR_SLIDE_KEYS = operations.SCALAR_SLIDE_KEYS;
export const COMPLEX_SLIDE_FIELD_MAP = operations.COMPLEX_SLIDE_FIELD_MAP;
export const PptxCodec = operations.PptxCodec;
export type PptxCodec = operations.PptxCodec;
