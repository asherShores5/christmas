import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DEPLOY_BRANCH, DEPLOY_ENVIRONMENT, DEPLOY_ROLE_NAME } from "../lib/ci";

const workflow = readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "ci.yml"), "utf8");
const infraPkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
/** The text of one top-level job, from its `  name:` line to the next job. */
const job = (name: string) => workflow.split(/^(?= {2}\S+:$)/m).find((b) => b.startsWith(`  ${name}:\n`)) ?? "";

describe("CI workflow", () => {
  it("has the test and infra-test jobs that branch protection requires", () => {
    expect(job("test")).not.toBe("");
    expect(job("infra-test")).not.toBe("");
  });

  it("checks web tests, typecheck and build, and infra tests, typecheck and synth", () => {
    for (const step of ["npm test -w web", "npm run typecheck -w web", "npm run build:web"]) expect(job("test")).toContain(`- run: ${step}\n`);
    for (const step of ["npm test -w infra", "npm run typecheck -w infra", "npm run synth"]) expect(job("infra-test")).toContain(`- run: ${step}\n`);
  });

  it("pins every action to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u, u).toMatch(/@[0-9a-f]{40}$/);
  });

  it("assumes the role CiStack creates, with the account from a secret (never a literal ID)", () => {
    expect(job("deploy")).toContain(`arn:aws:iam::\${{ secrets.AWS_ACCOUNT_ID }}:role/${DEPLOY_ROLE_NAME}`);
    expect(workflow).not.toMatch(/\b\d{12}\b/);
  });

  it("deploys only on pushes to the prod branch, after both check jobs pass", () => {
    const deploy = job("deploy");
    expect(deploy).toContain(`if: github.event_name == 'push' && github.ref == 'refs/heads/${DEPLOY_BRANCH}'`);
    expect(deploy).toContain("needs: [test, infra-test]");
  });

  it("runs the deploy job in the approval-gated environment the role trusts, with OIDC and nothing more", () => {
    const deploy = job("deploy");
    expect(deploy).toContain(`    environment: ${DEPLOY_ENVIRONMENT}\n`);
    expect(deploy).toContain("id-token: write");
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it("the deploy step requires the hosting config, so a missing variable fails instead of deploying without the domain", () => {
    expect(job("deploy")).toContain("- run: npm run deploy -w infra\n");
    expect(infraPkg.scripts.deploy).toContain("-c requireHosting=true");
  });
});
