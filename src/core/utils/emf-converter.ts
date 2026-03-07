/**
 * EMF/WMF converter — thin re-export from the modular implementation.
 *
 * All logic now lives in the `emf/` subdirectory.  This file is kept so
 * existing import paths (`../../utils/emf-converter`) continue to work.
 */
export { convertEmfToDataUrl, convertWmfToDataUrl } from "./emf/index";
