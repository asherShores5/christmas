import { describe, expect, it } from "vitest";
import { precacheList, routeRequest, shellCacheName, shellVersion, staleCaches } from "./swShell";

const ORIGIN = "https://christmas.example";
const precached = ["/index.html", "/assets/index-abc123.js", "/icon-192.png"];
const req = (url: string, mode = "cors", method = "GET") => ({ url: new URL(url, ORIGIN).href, mode, method });

describe("routeRequest", () => {
  it("answers any same-origin page navigation with the app shell, so Christmas Swap opens offline", () => {
    expect(routeRequest(req("/", "navigate"), ORIGIN, precached)).toBe("shell");
    expect(routeRequest(req("/?source=homescreen", "navigate"), ORIGIN, precached)).toBe("shell");
  });

  it("serves build files and icons from the precache, ignoring the query string", () => {
    expect(routeRequest(req("/assets/index-abc123.js"), ORIGIN, precached)).toBe("precache");
    expect(routeRequest(req("/icon-192.png?v=2", "no-cors"), ORIGIN, precached)).toBe("precache");
  });

  it("leaves other origins, unknown files and non-GET requests to the network", () => {
    expect(routeRequest(req("https://elsewhere.example/", "navigate"), ORIGIN, precached)).toBe("passthrough");
    expect(routeRequest(req("/assets/index-old999.js"), ORIGIN, precached)).toBe("passthrough");
    expect(routeRequest(req("/assets/index-abc123.js", "cors", "POST"), ORIGIN, precached)).toBe("passthrough");
  });
});

describe("precacheList", () => {
  it("lists every build file as a root path, but not the worker itself or source maps", () => {
    const files = ["index.html", "assets/index-abc123.js", "assets/index-abc123.js.map", "sw.js", "icon-192.png", "icon-180.png", "manifest.webmanifest"];
    expect(precacheList(files)).toEqual([
      "/assets/index-abc123.js",
      "/icon-180.png",
      "/icon-192.png",
      "/index.html",
      "/manifest.webmanifest",
    ]);
  });
});

describe("shellVersion", () => {
  const build = [
    { name: "index.html", content: "<html>v1</html>" },
    { name: "assets/index-abc123.js", content: "console.log(1)" },
  ];

  it("is the same for the same build, whatever order the files come in", () => {
    expect(shellVersion(build)).toBe(shellVersion([...build].reverse()));
    expect(shellVersion(build)).toMatch(/^[0-9a-z]+$/);
  });

  it("changes when any file changes, even one with an unhashed name like an icon", () => {
    const before = [...build, { name: "icon-192.png", content: new Uint8Array([1]) }];
    const after = [...build, { name: "icon-192.png", content: new Uint8Array([2]) }];
    expect(shellVersion(after)).not.toBe(shellVersion(before));
  });

  it("changes when a file is renamed or added", () => {
    expect(shellVersion([build[0], { ...build[1], name: "assets/index-zzz999.js" }])).not.toBe(shellVersion(build));
    expect(shellVersion([...build, { name: "robots.txt", content: "x" }])).not.toBe(shellVersion(build));
  });
});

describe("shell caches", () => {
  it("names one cache per build", () => {
    expect(shellCacheName("k3x9")).toBe("christmas-shell-k3x9");
  });

  it("deletes older shell caches on activate, keeping the current one and caches it doesn't own", () => {
    const keys = ["christmas-shell-old1", "christmas-shell-new2", "christmas-shell-old3", "something-else"];
    expect(staleCaches(keys, "christmas-shell-new2")).toEqual(["christmas-shell-old1", "christmas-shell-old3"]);
  });
});
