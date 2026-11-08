import { App, Tags } from "aws-cdk-lib";

// Empty CDK app for now: the hosting, cert and CI stacks come in a later ticket. No account or
// zone IDs in this repo; they will come from CDK context or env, as in App Connector.
const app = new App();
Tags.of(app).add("app", "christmas");
app.synth();
