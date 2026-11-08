import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("is titled Christmas Swap with the year shown", () => {
    const html = renderToStaticMarkup(<App search="?year=2027" now={new Date(2026, 10, 8)} />);
    expect(html).toMatch(/<h1[^>]*>Christmas Swap <span[^>]*>2027<\/span><\/h1>/);
  });

  it("shows 9999, the last year, with → disabled instead of linking to 10000", () => {
    const html = renderToStaticMarkup(<App search="?year=9999" now={new Date(2026, 10, 8)} />);
    expect(html).toMatch(/<span[^>]*>9999<\/span><\/h1>/);
    expect(html).not.toContain("?year=10000");
    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*>\s*→\s*<\/span>/);
  });
});
