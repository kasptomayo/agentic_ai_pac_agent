# Agentnic UI

A simple React + Vite workspace for uploading bank loan rules in PDF form and generating an OPA REGO policy via a Google ADK agent running on Cloud Run.

## Features

- PDF upload and text extraction using `pdfjs-dist`
- Backend endpoint that forwards bank loan rules to a Google ADK agent on Cloud Run
- REGO output display for use with Open Policy Agent

## Setup

1. Copy `.env.example` to `.env`
- Ensure `GOOGLE_ADK_API_URL` points to your public Cloud Run service endpoint
3. Install dependencies:

```bash
npm install
```

4. Start the workspace:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Notes

- The frontend sends extracted PDF text to `POST /api/generate-rego`.
- The backend uses axios for secure HTTPS communication with the public Cloud Run agent endpoint.
- The Cloud Run service endpoint is: `https://regoagent-964834321101.us-west1.run.app/run_sse`
- The endpoint is public and does not require an API key.
- Uses the agent's SSE API format with app_name, user_id, session_id, new_message, and streaming parameters.
