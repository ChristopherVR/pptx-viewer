/**
 * Constants shared by `generate-run-program-fixture.ts` (which builds the
 * deck) and `e2e/run-program-notice.spec.ts` (which asserts on it).
 *
 * Kept in a module that imports NOTHING so the spec can read them without
 * pulling `pptx-viewer-core` into its module graph: the generator needs core
 * to build the deck, but a Playwright worker evaluating the spec should not
 * fail to even start just because `packages/core/dist` is mid-rebuild.
 */

/** Where the run-program shape sits on the slide, in slide pixels. */
export const RUN_PROGRAM_SHAPE_X = 120;
export const RUN_PROGRAM_SHAPE_Y = 180;
export const RUN_PROGRAM_SHAPE_SIZE = 200;

/**
 * The exact command string authored on the shape's Action Settings: path and
 * arguments as ONE opaque string, exactly as PowerPoint stores "Program to
 * run:" (OOXML has no separate arguments field).
 */
export const RUN_PROGRAM_COMMAND = 'notepad.exe C:\\temp\\notes.txt';

/** The action shape is added first on its slide, so it is `-shape-0`. */
export const RUN_PROGRAM_SHAPE_ID = 'ppt/slides/slide1.xml-shape-0';
