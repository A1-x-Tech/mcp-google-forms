import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleFormsClient } from "./client.js";

/**
 * Live READ-ONLY smoke check. With a form id (argv or GOOGLE_FORMS_SMOKE_FORM_ID)
 * it fetches the form; otherwise it just mints an access token from the refresh
 * token — either way the credentials are exercised for real and nothing is written.
 */
async function main(): Promise<void> {
  const client = new GoogleFormsClient(loadConfig());
  const formId = process.argv[2] ?? process.env.GOOGLE_FORMS_SMOKE_FORM_ID;
  if (formId) {
    const form = (await client.getForm(formId)) as {
      info?: { title?: string };
      items?: unknown[];
      responderUri?: string;
    };
    console.log(
      JSON.stringify(
        { formId, title: form.info?.title, items: form.items?.length ?? 0, responderUri: form.responderUri },
        null,
        2,
      ),
    );
    return;
  }
  console.log(JSON.stringify(await client.authCheck(), null, 2));
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
