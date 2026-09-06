import { test } from "node:test";
import { crew } from "./expedition-test-helpers.ts";
import { feedingSetup } from "./expedition-equipment-helpers.ts";

test("ordinary equipment transport and a replenished tin earn a rabbit feeding setup", (t) => {
  const run = crew(23);
  const result = feedingSetup(run);
  t.diagnostic(
    JSON.stringify({
      seed: 23,
      tick: run.tick,
      credits: result.verdict.credits,
    }),
  );
});
