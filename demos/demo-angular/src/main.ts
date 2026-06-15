import 'zone.js';
// Ensure the JIT compiler is available. Under the Vite dev server the Analog
// plugin does not always AOT-compile local components, so Angular falls back to
// JIT at runtime — without this import that fallback throws "'@angular/compiler'
// is not available" and the demo never boots.
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app.component';

bootstrapApplication(AppComponent).catch((err) => console.error(err));
