# Environment setup

## Google Cloud

| | |
|---|---|
| Project | `project-d5fe6dd3-2b61-40b3-932` ("Hack2skill-global-hackathon", #242926648187) |
| Account | Project owner's personal Google account |
| Billing | Enabled |
| Region | `us-central1` for Cloud Run / Firestore / Artifact Registry |
| Gemini location | `global` (gemini-3.x / 3.8-flash / 4-argon return 404 on regional endpoints) |
| Database | Firestore Native, `(default)`, `us-central1` |
| Runtime SA | `agent-runtime@project-d5fe6dd3-2b61-40b3-932.iam.gserviceaccount.com` |

Runtime SA roles: `aiplatform.user`, `datastore.user`, `secretmanager.secretAccessor`, `logging.logWriter`, `cloudtrace.agent`, `monitoring.metricWriter`.

APIs enabled: Cloud Run, Cloud Build, Artifact Registry, Firestore, Vertex AI (`aiplatform`), Gemini API (`generativelanguage`), Secret Manager, IAM, Cloud Scheduler, Pub/Sub, Logging, Monitoring, Trace.

### How auth is isolated from other GCP work on this machine

- **gcloud**: a separate named config, `hack2skill`, which is *not* the globally active one. In this folder Claude Code picks it up through `CLOUDSDK_ACTIVE_CONFIG_NAME` in `.claude/settings.local.json`. That file is git-ignored because it holds per-machine paths; the shared `.claude/settings.json` only sets the project ID and locations. In your own terminal, either prefix commands with it or activate the config:

  ```bash
  export CLOUDSDK_ACTIVE_CONFIG_NAME=hack2skill
  ```

- **Application Default Credentials** (used by the Python/Node SDKs and ADK): a separate file at `~/.config/gcloud-hack2skill-adc/application_default_credentials.json`, with its quota project set to this project. It is referenced through `GOOGLE_APPLICATION_CREDENTIALS`. The global ADC in `~/.config/gcloud/` (the Addo account) is untouched.
  To re-login:

  ```bash
  CLOUDSDK_CONFIG=$HOME/.config/gcloud-hack2skill-adc gcloud auth application-default login
  ```

### Gemini

Models verified working via Vertex AI on 2026-10-16 (location `global`):
`gemini-3.8-flash` (default), `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-4-argon`, `gemini-2.5-flash`.

```python
from google import genai
client = genai.Client()  # reads GOOGLE_GENAI_USE_VERTEXAI / GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION
client.models.generate_content(model="gemini-3.8-flash", contents="hi")
```

Agent framework: Google ADK (`pip install google-adk`, Python 3.11+). It deploys with `adk deploy cloud_run`.

### Deploying to Cloud Run

```bash
gcloud run deploy agent-api --source . --region us-central1 \
  --service-account agent-runtime@project-d5fe6dd3-2b61-40b3-932.iam.gserviceaccount.com \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=project-d5fe6dd3-2b61-40b3-932,GOOGLE_CLOUD_LOCATION=global \
  --allow-unauthenticated
```

### Teammate setup

1. Get the project owner to grant your Google account a role on the project (for example `roles/editor`).
2. Run:

   ```bash
   gcloud config configurations create hack2skill
   gcloud config set project project-d5fe6dd3-2b61-40b3-932
   gcloud config set run/region us-central1
   gcloud auth login
   gcloud auth application-default login
   gcloud auth application-default set-quota-project project-d5fe6dd3-2b61-40b3-932
   cp .env.example .env
   ```

3. In `.env`, fix `GOOGLE_APPLICATION_CREDENTIALS`. Either point it at your own ADC file or remove the line to use the default ADC.

## Claude Code ↔ Google Cloud

There are two layers, and both are already configured:

1. **gcloud CLI** through Bash. This is the main path for anything gcloud can do.
2. **Google's managed remote MCP servers** (GA since May 2026) in `.mcp.json`:
   - `gcp-firestore`: read and write documents and manage indexes. gcloud can't read documents.
   - `gcp-cloud-run`: list, get and deploy services.
   - `gcp-logging`: query log entries.
   - `gcp-docs`: Google's Developer Knowledge API, for current GCP docs.

   Auth goes through `scripts/gcp-mcp-headers.sh`, a `headersHelper`. It mints a bearer token from the project ADC, and Claude Code re-runs it on 401/403, so the 1-hour token expiry is handled.

More servers: see https://docs.cloud.google.com/mcp/supported-products (for example `https://aiplatform.googleapis.com/mcp/...`, `https://bigquery.googleapis.com/mcp`).
