import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "../lib/app";

let built: BuiltApp;
let web: Template;
beforeAll(() => {
  delete process.env.CDK_DEFAULT_ACCOUNT; // synth as a fresh checkout would, with no credentials
  const webDist = mkdtempSync(path.join(tmpdir(), "christmas-web-"));
  writeFileSync(path.join(webDist, "index.html"), "<!doctype html>");
  built = buildApp(new App(), { region: "us-west-1", webDist });
  web = Template.fromStack(built.web);
}, 120_000);

const headersConfig = () => {
  const policies = Object.values(web.findResources("AWS::CloudFront::ResponseHeadersPolicy"));
  expect(policies).toHaveLength(1);
  return policies[0].Properties.ResponseHeadersPolicyConfig;
};
const customHeader = (name: string) =>
  headersConfig().CustomHeadersConfig.Items.find((h: { Header: string }) => h.Header === name);

describe("web hosting", () => {
  it("lives in us-west-1", () => {
    expect(built.web.region).toBe("us-west-1");
  });

  it("the bucket blocks all public access and only CloudFront (via OAC) may read it", () => {
    web.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
    web.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    web.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        Origins: [Match.objectLike({ OriginAccessControlId: Match.anyValue(), S3OriginConfig: { OriginAccessIdentity: "" } })],
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: "redirect-to-https" }),
      }),
    });
  });

  it("no bucket policy statement allows an anonymous or unconditioned CloudFront principal", () => {
    const policies = Object.values(web.findResources("AWS::S3::BucketPolicy"));
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      for (const s of p.Properties.PolicyDocument.Statement) {
        if (s.Effect !== "Allow") continue;
        expect(s.Principal).not.toBe("*");
        expect(JSON.stringify(s.Principal)).not.toContain('"AWS":"*"');
        if (s.Principal?.Service === "cloudfront.amazonaws.com") expect(s.Condition?.StringEquals?.["AWS:SourceArn"]).toBeDefined();
      }
    }
  });

  it("the CSP loads nothing from other origins and the site can't be framed", () => {
    const csp: string = headersConfig().SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/https?:|\*|'unsafe-/);
  });

  it("sends HSTS, nosniff, frame DENY and a same-origin referrer policy, overriding the origin", () => {
    expect(headersConfig().SecurityHeadersConfig).toMatchObject({
      StrictTransportSecurity: { Override: true, AccessControlMaxAgeSec: 31536000 },
      ContentTypeOptions: { Override: true },
      FrameOptions: { Override: true, FrameOption: "DENY" },
      ReferrerPolicy: { Override: true, ReferrerPolicy: "same-origin" },
    });
  });

  it("keeps family names out of search with X-Robots-Tag: noindex", () => {
    expect(customHeader("X-Robots-Tag")).toEqual({ Header: "X-Robots-Tag", Value: "noindex", Override: true });
  });

  it("isolates the browsing context (COOP) and turns off powerful browser features", () => {
    expect(customHeader("Cross-Origin-Opener-Policy")).toEqual({ Header: "Cross-Origin-Opener-Policy", Value: "same-origin", Override: true });
    const pp = customHeader("Permissions-Policy");
    expect(pp.Override).toBe(true);
    for (const f of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) expect(pp.Value).toContain(f);
  });

  it("refuses to build without a web build, instead of deploying an empty site", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "christmas-empty-"));
    expect(() => buildApp(new App(), { region: "us-west-1", webDist: empty })).toThrow(/npm run build:web/);
  });

  it("puts no AWS account ID in the template when synthesised without one", () => {
    expect(JSON.stringify(web.toJSON())).not.toMatch(/\b\d{12}\b/);
  });
});
