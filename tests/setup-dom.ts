import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  // JSDOM has no layout; piece animations need a measurable square.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    width: 64, height: 64, top: 0, left: 0, right: 64, bottom: 64, x: 0, y: 0, toJSON: () => ({}),
  }));
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
});
