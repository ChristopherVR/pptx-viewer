/**
 * Core PPTX engine barrel export.
 *
 * Aggregates all framework-agnostic modules that make up the PPTX
 * handler: types, constants, colour utilities, geometry helpers,
 * XML builder APIs, runtime sub-system, services, and general
 * utilities. The top-level {@link PptxHandler} facade is also
 * re-exported from here.
 *
 * @module pptx-core
 */

export * from "./types";
export { PptxHandler } from "./PptxHandler";

// Core sub-modules - framework-agnostic logic
export * from "./constants";
export * from "./color";
export * from "./geometry";
export * from "./builders";
export * from "./core";
export * from "./services";
export * from "./utils";
