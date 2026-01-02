/**
 * Test setup for React component tests
 * Sets up happy-dom and testing-library/jest-dom
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import "@testing-library/jest-dom";

// Register happy-dom globals (only if not already registered)
if (!globalThis.window || !globalThis.document) {
  GlobalRegistrator.register();
}

// Add custom matchers from @testing-library/jest-dom
// These are automatically added via the import above
