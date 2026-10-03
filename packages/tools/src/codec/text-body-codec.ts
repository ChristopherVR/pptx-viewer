// Compatibility exports: all document operations are owned by OOXML core.
import { apiCodecTextBodyCodec as operations } from 'ooxml-core/pptx/automation';
export const encodeTextBodyToYText = operations.encodeTextBodyToYText;
export const decodeTextBodyFromYText = operations.decodeTextBodyFromYText;
