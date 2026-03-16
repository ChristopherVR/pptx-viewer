/**
 * Public types for the template engine.
 *
 * @module sdk/template-engine-types
 */

/**
 * Data record for template substitution.
 *
 * Values can be primitives, nested objects, or arrays (for loop blocks).
 */
export interface TemplateData {
	[key: string]: string | number | boolean | TemplateData | TemplateData[];
}
