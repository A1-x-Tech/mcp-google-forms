import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuestionItem, GoogleFormsClient } from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleFormsConfig } from "./types.js";

const BASE = "https://forms.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; auth: unknown; body: string | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleFormsConfig> = {}): GoogleFormsConfig {
  return { accessToken: "STATIC", apiBase: BASE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleFormsConfig> = {}): GoogleFormsConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      body: typeof i.body === "string" ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.getForm("abc"),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The historical startup error, verbatim — the message is the product.
        assert.ok(
          err.message.startsWith(
            "Google OAuth credentials are required: set GOOGLE_FORMS_CLIENT_ID + " +
              "GOOGLE_FORMS_CLIENT_SECRET + GOOGLE_FORMS_REFRESH_TOKEN (recommended), " +
              "or GOOGLE_FORMS_ACCESS_TOKEN with a short-lived access token.",
          ),
          "the message must open with the historical startup error, verbatim",
        );
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleFormsClient(staticConfig()).getForm("abc");
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms/abc`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(refreshConfig());
    await client.getForm("abc");
    await client.getForm("def");

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(tokenCalls[0].body);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleFormsClient(refreshConfig()).getForm("abc");
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(refreshConfig()).getForm("abc"),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(refreshConfig()).getForm("abc"),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Endpoint mapping ----

test("createForm posts only info.title/documentTitle", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleFormsClient(staticConfig()).createForm({ title: "Survey", documentTitle: "Doc" });
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms`);
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { info: { title: "Survey", documentTitle: "Doc" } });
  } finally {
    mock.restore();
  }
});

test("createForm with publish chains setPublishSettings and merges the result", async () => {
  const mock = mockFetch((url) => {
    if (url.endsWith("/v1/forms")) return okJson({ formId: "f-1", responderUri: "https://x" });
    return okJson({ formId: "f-1", publishSettings: { publishState: { isPublished: true } } });
  });
  try {
    const result = (await new GoogleFormsClient(staticConfig()).createForm({
      title: "Survey",
      publish: true,
    })) as Record<string, unknown>;
    assert.equal(mock.calls.length, 2);
    assert.equal(mock.calls[1].url, `${BASE}/v1/forms/f-1:setPublishSettings`);
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } },
    });
    assert.equal(result.formId, "f-1");
    assert.deepEqual(result.publishSettings, { publishState: { isPublished: true } });
  } finally {
    mock.restore();
  }
});

test("createForm keeps the formId when the chained publish fails", async () => {
  const mock = mockFetch((url) => {
    if (url.endsWith("/v1/forms")) return okJson({ formId: "f-1", responderUri: "https://x" });
    return new Response("unavailable", { status: 503 });
  });
  try {
    const result = (await new GoogleFormsClient(staticConfig()).createForm({
      title: "Survey",
      publish: true,
    })) as Record<string, unknown>;
    assert.equal(result.formId, "f-1", "the created form must survive the publish failure");
    assert.equal(result.published, false);
    assert.match(String(result.publish_error), /HTTP 503/);
    assert.match(String(result.next_step), /set_publish_settings/);
  } finally {
    mock.restore();
  }
});

test("updateFormInfo computes the updateMask from the provided fields", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(staticConfig());
    await client.updateFormInfo({ formId: "f", title: "T", description: "D" });
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms/f:batchUpdate`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      requests: [{ updateFormInfo: { info: { title: "T", description: "D" }, updateMask: "title,description" } }],
    });
    await assert.rejects(() => client.updateFormInfo({ formId: "f" }), /At least one of/);
  } finally {
    mock.restore();
  }
});

test("updateFormSettings maps is_quiz/email collection with the right mask", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(staticConfig());
    await client.updateFormSettings({ formId: "f", isQuiz: true, emailCollectionType: "VERIFIED" });
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      requests: [
        {
          updateSettings: {
            settings: { quizSettings: { isQuiz: true }, emailCollectionType: "VERIFIED" },
            updateMask: "quizSettings.isQuiz,emailCollectionType",
          },
        },
      ],
    });
    await assert.rejects(() => client.updateFormSettings({ formId: "f" }), /At least one of/);
  } finally {
    mock.restore();
  }
});

test("setPublishSettings defaults isAcceptingResponses to isPublished", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(staticConfig());
    await client.setPublishSettings({ formId: "f", isPublished: false });
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      publishSettings: { publishState: { isPublished: false, isAcceptingResponses: false } },
    });
    await client.setPublishSettings({ formId: "f", isPublished: true, isAcceptingResponses: false });
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      publishSettings: { publishState: { isPublished: true, isAcceptingResponses: false } },
    });
  } finally {
    mock.restore();
  }
});

test("addQuestion with an explicit index sends a single createItem", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleFormsClient(staticConfig()).addQuestion({
      formId: "f",
      title: "Pick one",
      type: "radio",
      options: ["A", "B"],
      required: true,
      index: 2,
    });
    assert.equal(mock.calls.length, 1, "no extra read when the index is given");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      requests: [
        {
          createItem: {
            item: {
              title: "Pick one",
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: { type: "RADIO", options: [{ value: "A" }, { value: "B" }] },
                },
              },
            },
            location: { index: 2 },
          },
        },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("addQuestion without an index fetches the form and appends after the last item", async () => {
  const mock = mockFetch((url) => {
    if (url === `${BASE}/v1/forms/f`) return okJson({ formId: "f", items: [{}, {}, {}] });
    return okJson({ replies: [] });
  });
  try {
    await new GoogleFormsClient(staticConfig()).addQuestion({ formId: "f", title: "Q", type: "text" });
    assert.equal(mock.calls.length, 2);
    assert.equal(mock.calls[0].method, "GET");
    const body = JSON.parse(mock.calls[1].body!);
    assert.equal(body.requests[0].createItem.location.index, 3);
  } finally {
    mock.restore();
  }
});

test("deleteItem and moveItem build the right batchUpdate requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(staticConfig());
    await client.deleteItem("f", 4);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      requests: [{ deleteItem: { location: { index: 4 } } }],
    });
    await client.moveItem("f", 0, 5);
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      requests: [{ moveItem: { originalLocation: { index: 0 }, newLocation: { index: 5 } } }],
    });
  } finally {
    mock.restore();
  }
});

test("listResponses builds the timestamp filter and pagination query", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleFormsClient(staticConfig()).listResponses({
      formId: "f",
      submittedAfter: "2026-08-01T00:00:00Z",
      pageSize: 100,
      pageToken: "tok",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/forms/f/responses");
    assert.equal(url.searchParams.get("filter"), "timestamp > 2026-08-01T00:00:00Z");
    assert.equal(url.searchParams.get("pageSize"), "100");
    assert.equal(url.searchParams.get("pageToken"), "tok");
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].body, undefined);
  } finally {
    mock.restore();
  }
});

test("getResponse hits the response path", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleFormsClient(staticConfig()).getResponse("f", "resp-1");
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms/f/responses/resp-1`);
  } finally {
    mock.restore();
  }
});

test("watch methods map to create/list/delete/renew", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleFormsClient(staticConfig());
    await client.createWatch({
      formId: "f",
      eventType: "RESPONSES",
      topicName: "projects/p/topics/t",
      watchId: "my-watch",
    });
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms/f/watches`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), {
      watch: { eventType: "RESPONSES", target: { topic: { topicName: "projects/p/topics/t" } } },
      watchId: "my-watch",
    });
    await client.listWatches("f");
    assert.equal(mock.calls[1].method, "GET");
    await client.deleteWatch("f", "w-1");
    assert.equal(mock.calls[2].method, "DELETE");
    assert.equal(mock.calls[2].url, `${BASE}/v1/forms/f/watches/w-1`);
    await client.renewWatch("f", "w-1");
    assert.equal(mock.calls[3].method, "POST");
    assert.equal(mock.calls[3].url, `${BASE}/v1/forms/f/watches/w-1:renew`);
  } finally {
    mock.restore();
  }
});

// ---- buildQuestionItem wire mapping ----

test("buildQuestionItem maps every normalized type to its wire question", () => {
  const base = { formId: "f", title: "Q" } as const;
  assert.deepEqual(buildQuestionItem({ ...base, type: "text" }).questionItem, {
    question: { textQuestion: { paragraph: false } },
  });
  assert.deepEqual(buildQuestionItem({ ...base, type: "paragraph" }).questionItem, {
    question: { textQuestion: { paragraph: true } },
  });
  assert.deepEqual(
    buildQuestionItem({ ...base, type: "dropdown", options: ["X"] }).questionItem,
    { question: { choiceQuestion: { type: "DROP_DOWN", options: [{ value: "X" }] } } },
  );
  assert.deepEqual(
    buildQuestionItem({ ...base, type: "checkbox", options: ["X"], shuffle: true }).questionItem,
    { question: { choiceQuestion: { type: "CHECKBOX", options: [{ value: "X" }], shuffle: true } } },
  );
  assert.deepEqual(
    buildQuestionItem({ ...base, type: "scale", low: 0, high: 10, lowLabel: "bad", highLabel: "good" })
      .questionItem,
    { question: { scaleQuestion: { low: 0, high: 10, lowLabel: "bad", highLabel: "good" } } },
  );
  assert.deepEqual(buildQuestionItem({ ...base, type: "scale" }).questionItem, {
    question: { scaleQuestion: { low: 1, high: 5 } },
  });
  assert.deepEqual(
    buildQuestionItem({ ...base, type: "date", includeTime: true, includeYear: false }).questionItem,
    { question: { dateQuestion: { includeTime: true, includeYear: false } } },
  );
  assert.deepEqual(buildQuestionItem({ ...base, type: "time", duration: true }).questionItem, {
    question: { timeQuestion: { duration: true } },
  });
  assert.deepEqual(
    buildQuestionItem({ ...base, type: "rating", ratingScaleLevel: 7, ratingIconType: "thumb_up" })
      .questionItem,
    { question: { ratingQuestion: { ratingScaleLevel: 7, iconType: "THUMB_UP" } } },
  );
  assert.deepEqual(buildQuestionItem({ ...base, type: "rating" }).questionItem, {
    question: { ratingQuestion: { ratingScaleLevel: 5, iconType: "STAR" } },
  });
});

test("buildQuestionItem rejects choice questions without options", () => {
  for (const type of ["radio", "checkbox", "dropdown"] as const) {
    assert.throws(() => buildQuestionItem({ formId: "f", title: "Q", type }), /"options" is required/);
  }
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleFormsClient(staticConfig({ maxRetries: 3 })).getForm("f"),
    () => new GoogleFormsClient(staticConfig({ maxRetries: 3 })).deleteItem("f", 0),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleFormsClient(staticConfig({ maxRetries: 3 })).getForm("f");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("unavailable", { status: 503 });
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(staticConfig({ maxRetries: 3 })).deleteItem("f", 0),
      /HTTP 503/,
    );
    assert.equal(n, 1, "a 503 on a write must not be replayed — the delete may have committed");
  } finally {
    mock2.restore();
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleFormsClient(staticConfig({ maxRetries: 2 })).getForm("f");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(staticConfig({ maxRetries: 2 })).deleteItem("f", 0),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on a write must not be replayed");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(staticConfig({ maxRetries: 3 })).getForm("f"),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleFormsClient(staticConfig({ maxRetries: 2 })).getForm("f"),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleFormsClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getForm("f").then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleFormsClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleFormsClient(staticConfig()).request(
      "GET",
      "v1/forms/f/responses?pageSize=10",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/v1/forms/f/responses?pageSize=10`);
  } finally {
    mock.restore();
  }
});
