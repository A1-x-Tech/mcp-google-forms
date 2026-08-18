import type {
  EmailCollectionType,
  GoogleFormsConfig,
  QuestionType,
  RatingIconType,
  WatchEventType,
} from "./types.js";
import { GoogleFormsError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Normalized inputs for create_form. */
export interface CreateFormParams {
  title: string;
  documentTitle?: string;
  /** Publish right after creating (API-created forms default to unpublished). */
  publish?: boolean;
}

/** Normalized inputs for add_question. */
export interface AddQuestionParams {
  formId: string;
  title: string;
  type: QuestionType;
  description?: string;
  required?: boolean;
  /** 0-based insert position; appends at the end when omitted. */
  index?: number;
  /** Choice options (radio / checkbox / dropdown). */
  options?: string[];
  /** Shuffle option order (choice types). */
  shuffle?: boolean;
  /** Scale bounds and labels. */
  low?: number;
  high?: number;
  lowLabel?: string;
  highLabel?: string;
  /** Date question flags. */
  includeTime?: boolean;
  includeYear?: boolean;
  /** Time question: true = elapsed time (duration), false = time of day. */
  duration?: boolean;
  /** Rating question. */
  ratingScaleLevel?: number;
  ratingIconType?: RatingIconType;
}

/** Normalized inputs for list_responses. */
export interface ListResponsesParams {
  formId: string;
  /** RFC3339 UTC timestamp; becomes `filter=timestamp > X` (the only filter the API supports). */
  submittedAfter?: string;
  pageSize?: number;
  pageToken?: string;
}

/** Maps a normalized rating icon to the API's wire value. */
function mapRatingIcon(icon: RatingIconType): string {
  return { star: "STAR", heart: "HEART", thumb_up: "THUMB_UP" }[icon];
}

/** Maps a normalized choice type to the API's wire value. */
function mapChoiceType(type: "radio" | "checkbox" | "dropdown"): string {
  return { radio: "RADIO", checkbox: "CHECKBOX", dropdown: "DROP_DOWN" }[type];
}

/**
 * Builds a Forms API Item (questionItem) from the normalized add_question
 * vocabulary. Pure wire mapping — throws on inputs the API would reject
 * (e.g. a choice question without options).
 */
export function buildQuestionItem(p: AddQuestionParams): Record<string, unknown> {
  return compact({
    title: p.title,
    description: p.description,
    questionItem: {
      question: compact({ required: p.required, ...buildQuestion(p) }),
    },
  });
}

function buildQuestion(p: AddQuestionParams): Record<string, unknown> {
  switch (p.type) {
    case "text":
      return { textQuestion: { paragraph: false } };
    case "paragraph":
      return { textQuestion: { paragraph: true } };
    case "radio":
    case "checkbox":
    case "dropdown": {
      if (!p.options || p.options.length === 0) {
        throw new Error(`"options" is required for a ${p.type} question (the list of choices).`);
      }
      return {
        choiceQuestion: compact({
          type: mapChoiceType(p.type),
          options: p.options.map((value) => ({ value })),
          shuffle: p.shuffle,
        }),
      };
    }
    case "scale":
      return {
        scaleQuestion: compact({
          low: p.low ?? 1,
          high: p.high ?? 5,
          lowLabel: p.lowLabel,
          highLabel: p.highLabel,
        }),
      };
    case "date":
      return { dateQuestion: compact({ includeTime: p.includeTime, includeYear: p.includeYear }) };
    case "time":
      return { timeQuestion: compact({ duration: p.duration }) };
    case "rating":
      return {
        ratingQuestion: {
          ratingScaleLevel: p.ratingScaleLevel ?? 5,
          iconType: mapRatingIcon(p.ratingIconType ?? "star"),
        },
      };
  }
}

export class GoogleFormsClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleFormsConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_FORMS_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, text } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleFormsError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_FORMS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_FORMS_ACCESS_TOKEN fetch a form instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level request to a Google Forms API path (e.g. "v1/forms/abc"). Auth is
   * a Bearer token (refreshed transparently; a 401 forces one re-mint + retry).
   * 429 is always retried with backoff; 5xx and network errors/timeouts are
   * retried only for GET — the Forms API has real writes, and retrying a POST
   * after the write committed would duplicate the item/form/watch. Any other
   * non-2xx throws a {@link GoogleFormsError}.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasBody = body !== undefined && method !== "GET";

    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the Bearer token can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), this.base);
    if (url.origin !== new URL(this.base).origin) {
      throw new Error(`raw_request path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasBody) headers["Content-Type"] = "application/json";

      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(
          target,
          { method, headers, body: hasBody ? JSON.stringify(body) : undefined },
          path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleFormsError(res.status, data);
      return data as T;
    }
  }

  // ---- Forms ----

  /**
   * Creates a form. forms.create accepts only info.title / info.documentTitle —
   * everything else must go through batchUpdate afterwards. API-created forms
   * default to unpublished; publish=true chains a setPublishSettings call so the
   * form immediately accepts responses.
   */
  async createForm(p: CreateFormParams): Promise<unknown> {
    const form = await this.request<Record<string, unknown>>("POST", "v1/forms", {
      info: compact({ title: p.title, documentTitle: p.documentTitle }),
    });
    if (p.publish && typeof form.formId === "string") {
      // The form already exists here; the Forms API has no list endpoint, so a
      // thrown publish error would lose the only copy of the formId and push
      // the caller into re-creating (duplicating) the form.
      try {
        const published = await this.setPublishSettings({
          formId: form.formId,
          isPublished: true,
          isAcceptingResponses: true,
        });
        return { ...form, publishSettings: (published as Record<string, unknown>).publishSettings };
      } catch (err) {
        return {
          ...form,
          published: false,
          publish_error: err instanceof Error ? err.message : String(err),
          next_step:
            "The form was created but publishing failed — call set_publish_settings with this formId; do not call create_form again.",
        };
      }
    }
    return form;
  }

  /** Full form structure: info, settings, items (with itemId/questionId), publishSettings. */
  async getForm(formId: string): Promise<unknown> {
    return this.request("GET", `v1/forms/${encodeURIComponent(formId)}`);
  }

  /** Low-level batchUpdate — the write channel for everything except create/publish. */
  async batchUpdate(
    formId: string,
    requests: unknown[],
    opts: { includeFormInResponse?: boolean; requiredRevisionId?: string } = {},
  ): Promise<unknown> {
    return this.request(
      "POST",
      `v1/forms/${encodeURIComponent(formId)}:batchUpdate`,
      compact({
        requests,
        includeFormInResponse: opts.includeFormInResponse,
        writeControl: opts.requiredRevisionId ? { requiredRevisionId: opts.requiredRevisionId } : undefined,
      }),
    );
  }

  /**
   * Updates title / description with a computed updateMask. Info.documentTitle
   * is output-only in batchUpdate: the Drive file name is set at creation and
   * renamed only through the Drive API, which this server does not cover.
   */
  async updateFormInfo(p: { formId: string; title?: string; description?: string }): Promise<unknown> {
    const info = compact({ title: p.title, description: p.description });
    const mask = Object.keys(info).join(",");
    if (!mask) throw new Error("At least one of title or description is required.");
    return this.batchUpdate(p.formId, [{ updateFormInfo: { info, updateMask: mask } }]);
  }

  /** Toggles quiz mode / email collection with a computed updateMask. */
  async updateFormSettings(p: {
    formId: string;
    isQuiz?: boolean;
    emailCollectionType?: EmailCollectionType;
  }): Promise<unknown> {
    const settings = compact({
      quizSettings: p.isQuiz !== undefined ? { isQuiz: p.isQuiz } : undefined,
      emailCollectionType: p.emailCollectionType,
    });
    const maskParts: string[] = [];
    if (p.isQuiz !== undefined) maskParts.push("quizSettings.isQuiz");
    if (p.emailCollectionType !== undefined) maskParts.push("emailCollectionType");
    if (maskParts.length === 0) throw new Error("At least one of is_quiz or email_collection_type is required.");
    return this.batchUpdate(p.formId, [{ updateSettings: { settings, updateMask: maskParts.join(",") } }]);
  }

  /** Publishes/unpublishes the form and opens/closes response collection. */
  async setPublishSettings(p: {
    formId: string;
    isPublished: boolean;
    isAcceptingResponses?: boolean;
  }): Promise<unknown> {
    return this.request("POST", `v1/forms/${encodeURIComponent(p.formId)}:setPublishSettings`, {
      publishSettings: {
        publishState: {
          isPublished: p.isPublished,
          isAcceptingResponses: p.isAcceptingResponses ?? p.isPublished,
        },
      },
    });
  }

  // ---- Items ----

  /**
   * Adds one question via batchUpdate createItem. When index is omitted the
   * form is fetched first and the question is appended after the last item
   * (createItem requires an explicit location).
   */
  async addQuestion(p: AddQuestionParams): Promise<unknown> {
    const item = buildQuestionItem(p);
    let index = p.index;
    if (index === undefined) {
      const form = (await this.getForm(p.formId)) as { items?: unknown[] };
      index = form.items?.length ?? 0;
    }
    return this.batchUpdate(p.formId, [{ createItem: { item, location: { index } } }]);
  }

  /** Replaces the fields named in updateMask on the item at the given index. */
  async updateItem(p: {
    formId: string;
    index: number;
    item: Record<string, unknown>;
    updateMask: string;
  }): Promise<unknown> {
    return this.batchUpdate(p.formId, [
      { updateItem: { item: p.item, location: { index: p.index }, updateMask: p.updateMask } },
    ]);
  }

  /** Deletes the item at the given index. */
  async deleteItem(formId: string, index: number): Promise<unknown> {
    return this.batchUpdate(formId, [{ deleteItem: { location: { index } } }]);
  }

  /** Moves the item at fromIndex to toIndex. */
  async moveItem(formId: string, fromIndex: number, toIndex: number): Promise<unknown> {
    return this.batchUpdate(formId, [
      { moveItem: { originalLocation: { index: fromIndex }, newLocation: { index: toIndex } } },
    ]);
  }

  // ---- Responses (read-only; the API cannot submit responses) ----

  /** Lists submissions, optionally only those after a timestamp (the API's only filter). */
  async listResponses(p: ListResponsesParams): Promise<unknown> {
    return this.request(
      "GET",
      `v1/forms/${encodeURIComponent(p.formId)}/responses`,
      undefined,
      compact({
        filter: p.submittedAfter ? `timestamp > ${p.submittedAfter}` : undefined,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
      }),
    );
  }

  /** One submission by its responseId. */
  async getResponse(formId: string, responseId: string): Promise<unknown> {
    return this.request(
      "GET",
      `v1/forms/${encodeURIComponent(formId)}/responses/${encodeURIComponent(responseId)}`,
    );
  }

  // ---- Watches (Pub/Sub push notifications) ----

  /** Creates a watch pushing RESPONSES/SCHEMA events to a Cloud Pub/Sub topic. */
  async createWatch(p: {
    formId: string;
    eventType: WatchEventType;
    topicName: string;
    watchId?: string;
  }): Promise<unknown> {
    return this.request(
      "POST",
      `v1/forms/${encodeURIComponent(p.formId)}/watches`,
      compact({
        watch: { eventType: p.eventType, target: { topic: { topicName: p.topicName } } },
        watchId: p.watchId,
      }),
    );
  }

  /** Lists the caller's watches on a form. */
  async listWatches(formId: string): Promise<unknown> {
    return this.request("GET", `v1/forms/${encodeURIComponent(formId)}/watches`);
  }

  /** Deletes a watch. */
  async deleteWatch(formId: string, watchId: string): Promise<unknown> {
    return this.request(
      "DELETE",
      `v1/forms/${encodeURIComponent(formId)}/watches/${encodeURIComponent(watchId)}`,
    );
  }

  /** Renews a watch for another 7 days (also reactivates a SUSPENDED watch). */
  async renewWatch(formId: string, watchId: string): Promise<unknown> {
    return this.request(
      "POST",
      `v1/forms/${encodeURIComponent(formId)}/watches/${encodeURIComponent(watchId)}:renew`,
      {},
    );
  }
}

/** Drops keys whose value is `undefined` so they are not sent to the API. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
