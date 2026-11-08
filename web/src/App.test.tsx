import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("is titled Christmas Swap", () => {
    expect(renderToStaticMarkup(<App />)).toMatch(/<h1[^>]*>Christmas Swap<\/h1>/);
  });
});
