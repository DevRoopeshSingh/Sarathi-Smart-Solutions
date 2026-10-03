import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/digital-seva-kendra/route";

test("Seva HTML resolves public metadata independently of the CCTV layout and database", async () => {
  const previous = process.env.PUBLIC_SITE_URL;
  try {
    process.env.PUBLIC_SITE_URL = "https://seva.example";
    const response = await GET();
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    const html = await response.text();
    assert.match(html, /https:\/\/seva\.example\/digital-seva-kendra/);
    assert.doesNotMatch(html, /__SITE_URL__|AggregateOffer/);
    assert.match(html, /"name":\s*"Sarathi Digital Seva Kendra"/);
    for (const bad of [
      "javascript:alert(1)",
      "https://user:pass@example.com",
      "https://example.com/unexpected"
    ]) {
      process.env.PUBLIC_SITE_URL = bad;
      await assert.rejects(GET);
    }
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = previous;
  }
});
