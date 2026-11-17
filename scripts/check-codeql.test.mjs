import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blockingFindings } from "./check-codeql.mjs";

describe("CodeQL severity gate", () => {
  const report = (severity) => ({
    runs: [{
      tool: { driver: { rules: [{ id: "js/test", properties: { "security-severity": severity } }] } },
      results: [{ ruleId: "js/test" }]
    }]
  });

  it("blocks high and critical findings but permits moderate findings", () => {
    assert.equal(blockingFindings(report("9.8")).length, 1);
    assert.equal(blockingFindings(report("7.0")).length, 1);
    assert.equal(blockingFindings(report("6.9")).length, 0);
  });

  it("rejects missing reports, unmatched rules and invalid severities", () => {
    assert.throws(() => blockingFindings({}), /Missing/);
    assert.throws(() => blockingFindings({ runs: [{ results: [{ ruleId: "missing" }] }] }), /metadata/);
    assert.throws(() => blockingFindings(report("invalid")), /severity/);
  });
});
