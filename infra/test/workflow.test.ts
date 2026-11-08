import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "ci.yml"), "utf8");

describe("CI workflow", () => {
  it("has the test and infra-test jobs that branch protection requires", () => {
    expect(workflow).toMatch(/^ {2}test:$/m);
    expect(workflow).toMatch(/^ {2}infra-test:$/m);
  });

  it("checks web tests, typecheck and build, and infra tests and typecheck", () => {
    for (const step of ["npm test -w web", "npm run typecheck -w web", "npm run build:web", "npm test -w infra", "npm run typecheck -w infra"]) {
      expect(workflow).toContain(`- run: ${step}\n`);
    }
  });

  it("pins every action to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u, u).toMatch(/@[0-9a-f]{40}$/);
  });

  it("has no deploy job yet and no AWS account IDs", () => {
    expect(workflow).not.toMatch(/deploy/i);
    expect(workflow).not.toMatch(/\b\d{12}\b/);
  });
});
