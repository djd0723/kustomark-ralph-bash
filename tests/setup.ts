/**
 * Test setup for Bun test runner
 * Configures the testing environment for React component tests
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register happy-dom as the DOM implementation
GlobalRegistrator.register();

// Critical: Setup IS_REACT_ACT_ENVIRONMENT for React Testing Library
// This tells React that we're in a testing environment and enables proper act() behavior
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Add custom matchers from @testing-library/jest-dom
import "@testing-library/jest-dom";

// Mock window.confirm for tests that need it
if (typeof global.confirm !== "function") {
  global.confirm = () => true;
}

// Mock window.alert for tests that need it
if (typeof global.alert !== "function") {
  global.alert = () => {};
}

// Ensure clean DOM state before each test
// This is especially important when running multiple tests
if (globalThis.document) {
  globalThis.document.body.innerHTML = "";
}
