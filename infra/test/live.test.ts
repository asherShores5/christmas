import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "../lib/app";
import { CiStack } from "../lib/ci";

// Placeholder values only: real IDs never go in this repo.
const HOSTING = { account: "111111111111", hostedZoneId: "Z0000000PLACEHOLDER", zoneName: "ashershores.com" };

let built: BuiltApp;
let web: Template, cert: Template, ci: Template;
beforeAll(() => {
  const webDist = mkdtempSync(path.join(tmpdir(), "christmas-web-"));
  writeFileSync(path.join(webDist, "index.html"), "<!doctype html>");
  built = buildApp(new App(), { region: "us-west-1", hosting: HOSTING, webDist });
  web = Template.fromStack(built.web);
  cert = Template.fromStack(built.cert!);
  ci = Template.fromStack(built.ci!);
}, 120_000);

describe("live at christmas.ashershores.com", () => {
  it("issues the certificate in us-east-1, DNS-validated in the configured zone", () => {
    expect(built.cert!.region).toBe("us-east-1");
    cert.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "christmas.ashershores.com",
      ValidationMethod: "DNS",
      DomainValidationOptions: [{ DomainName: "christmas.ashershores.com", HostedZoneId: HOSTING.hostedZoneId }],
    });
  });

  it("CloudFront answers on the domain with that certificate, and the site stays in us-west-1", () => {
    expect(built.web.region).toBe("us-west-1");
    web.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: ["christmas.ashershores.com"],
        ViewerCertificate: Match.objectLike({ AcmCertificateArn: Match.anyValue(), SslSupportMethod: "sni-only" }),
      }),
    });
  });

  it("points the domain at CloudFront in the configured zone (A and AAAA)", () => {
    for (const Type of ["A", "AAAA"]) {
      web.hasResourceProperties("AWS::Route53::RecordSet", {
        HostedZoneId: HOSTING.hostedZoneId,
        Name: "christmas.ashershores.com.",
        Type,
        AliasTarget: Match.objectLike({ DNSName: Match.anyValue() }),
      });
    }
    web.resourceCountIs("AWS::Route53::RecordSet", 2);
  });

  it("the bucket is still only readable through CloudFront (OAC)", () => {
    web.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
    web.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  });
});

describe("cost guardrail", () => {
  it("a $1 monthly budget on this app's tag emails at 80% actual and 100% forecast", () => {
    web.resourceCountIs("AWS::Budgets::Budget", 1);
    web.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 1, Unit: "USD" },
        CostFilters: { TagKeyValue: ["user:app$christmas"] },
      }),
      NotificationsWithSubscribers: [
        {
          Notification: { NotificationType: "ACTUAL", ComparisonOperator: "GREATER_THAN", Threshold: 80 },
          Subscribers: [{ SubscriptionType: "EMAIL", Address: "asher.shores5@gmail.com" }],
        },
        {
          Notification: { NotificationType: "FORECASTED", ComparisonOperator: "GREATER_THAN", Threshold: 100 },
          Subscribers: [{ SubscriptionType: "EMAIL", Address: "asher.shores5@gmail.com" }],
        },
      ],
    });
  });

  it("is named christmas-monthly", () => {
    web.hasResourceProperties("AWS::Budgets::Budget", { Budget: Match.objectLike({ BudgetName: "christmas-monthly" }) });
  });

  it("tags the billable resources in every stack app=christmas, so the budget sees them", () => {
    const tag = Match.arrayWith([{ Key: "app", Value: "christmas" }]);
    web.hasResourceProperties("AWS::S3::Bucket", { Tags: tag });
    web.hasResourceProperties("AWS::CloudFront::Distribution", { Tags: tag });
    cert.hasResourceProperties("AWS::CertificateManager::Certificate", { Tags: tag });
    ci.hasResourceProperties("AWS::IAM::Role", { Tags: tag });
  });

  it("no other stack carries a budget, so there is exactly one", () => {
    cert.resourceCountIs("AWS::Budgets::Budget", 0);
    ci.resourceCountIs("AWS::Budgets::Budget", 0);
  });
});

describe("deploy CI (GitHub OIDC)", () => {
  const trust = () => {
    const roles = Object.values(ci.findResources("AWS::IAM::Role"));
    expect(roles).toHaveLength(1);
    const [stmt] = roles[0].Properties.AssumeRolePolicyDocument.Statement;
    return stmt;
  };

  it("reuses the account's existing GitHub OIDC provider instead of creating a second one", () => {
    ci.resourceCountIs("Custom::AWSCDKOpenIdConnectProvider", 0);
    ci.resourceCountIs("AWS::IAM::OIDCProvider", 0);
    expect(JSON.stringify(trust().Principal)).toContain("oidc-provider/token.actions.githubusercontent.com");
  });

  it("only the production environment of asherShores5/christmas can assume the deploy role", () => {
    const s = trust();
    expect(s.Action).toBe("sts:AssumeRoleWithWebIdentity");
    expect(s.Condition).toEqual({
      StringEquals: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": ["repo:asherShores5/christmas:environment:production"],
      },
    });
    ci.hasResourceProperties("AWS::IAM::Role", { RoleName: "christmas-github-deploy" });
  });

  it("adds the immutable-ID subject form when the repo ID is given, still prod only", () => {
    const stack = new CiStack(new App(), "Ci", { env: { account: HOSTING.account, region: "us-west-1" }, githubRepoId: "987654321" });
    const [s] = Object.values(Template.fromStack(stack).findResources("AWS::IAM::Role"))[0].Properties.AssumeRolePolicyDocument.Statement;
    expect(s.Condition.StringEquals["token.actions.githubusercontent.com:sub"]).toEqual([
      "repo:asherShores5/christmas:environment:production",
      "repo:asherShores5@71547146/christmas@987654321:environment:production",
    ]);
  });

  it("rejects a repo ID that isn't a plain number (no wildcards into the trust policy)", () => {
    expect(() => new CiStack(new App(), "Ci", { env: { account: HOSTING.account, region: "us-west-1" }, githubRepoId: "*" })).toThrow(/githubRepoId/);
  });

  it("the role can only assume the CDK bootstrap roles", () => {
    ci.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [{ Action: "sts:AssumeRole", Effect: "Allow", Resource: "arn:aws:iam::111111111111:role/cdk-hnb659fds-*" }],
        Version: "2012-10-17",
      },
    });
  });
});

describe("without hosting config", () => {
  it("builds only the web stack, on its CloudFront address", () => {
    const webDist = mkdtempSync(path.join(tmpdir(), "christmas-web-"));
    writeFileSync(path.join(webDist, "index.html"), "<!doctype html>");
    const b = buildApp(new App(), { region: "us-west-1", webDist });
    expect([b.cert, b.ci]).toEqual([undefined, undefined]);
    Template.fromStack(b.web).resourceCountIs("AWS::Route53::RecordSet", 0);
  });
});
