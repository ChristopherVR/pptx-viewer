// Import the dedicated module so tests mocking the shared barrel or core keep
// their own module setup. This file lives outside src and is test-only.
import { registerPptxWebControls } from '../shared/src/web-components';

registerPptxWebControls();
