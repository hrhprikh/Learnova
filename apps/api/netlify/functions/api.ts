import serverless from "serverless-http";
import { app } from "../../src/app";

// Netlify invokes functions under '/.netlify/functions/<name>',
// so we strip that prefix before Express route matching.
export const handler = serverless(app, {
  basePath: "/.netlify/functions/api"
});
