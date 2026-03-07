/**
 * Public type re-exports for the PowerPoint viewer/editor plugin.
 *
 * Core data-model types (shapes, slides, canvas, etc.) are defined in
 * `./types-core`, while UI/interaction-specific types live in `./types-ui`.
 * This barrel module re-exports both so consumers can import from a
 * single location.
 */
export * from "./types-core";
export * from "./types-ui";
