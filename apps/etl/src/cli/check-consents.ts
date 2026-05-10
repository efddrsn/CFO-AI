#!/usr/bin/env node
import "dotenv/config";
import { checkConsents } from "../jobs/check-consents";

(async () => {
  const summary = await checkConsents();
  console.log("Consent check:", summary);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
