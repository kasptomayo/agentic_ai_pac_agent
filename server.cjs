const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Agentnic UI backend' });
});

app.post('/api/generate-rego', async (req, res) => {
  try {
    const { pdfText } = req.body;

    if (!pdfText || typeof pdfText !== 'string') {
      return res.status(400).json({ error: 'pdfText is required.' });
    }

    const rego = await generateRegoPolicy(pdfText);
    return res.json({ rego });
  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ error: 'Failed to generate REGO policy.' });
  }
});

app.listen(port, () => {
  console.log(`Agentnic UI server listening on http://localhost:${port}`);
});

async function createAgentSession(apiUrl) {
  const sessionUrl = `${apiUrl.replace(/\/$/, '')}/apps/regoagent/users/user123/sessions`;
  const response = await axios.post(sessionUrl, {}, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 60000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: true,
    }),
  });

  const result = response.data;
  const sessionId = result?.id;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error(`Could not obtain session id from session creation response: ${JSON.stringify(result)}`);
  }

  console.log(`Created session ${sessionId} from ${sessionUrl}`);
  return sessionId;
}

async function generateRegoPolicy(pdfText) {
  const apiUrl = process.env.GOOGLE_ADK_API_URL || 'https://regoagent-964834321101.us-west1.run.app';

  const prompt = `Convert the following bank loan rules into a valid OPA REGO policy. Use only the rules provided, keep the policy concise, and include comments that explain the logic. Respond with REGO only, no additional prose.\n\nBank loan rules:\n${pdfText}`;

  try {
    const sessionId = await createAgentSession(apiUrl);
    const endpoint = `${apiUrl.replace(/\/$/, '')}/run_sse`;

    const response = await axios.post(endpoint, {
      app_name: "regoagent",
      user_id: "user123",
      session_id: sessionId,
      new_message: {
        role: "user",
        parts: [{
          text: prompt
        }]
      },
      streaming: false
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: true,
      }),
    });

    const result = response.data;
    console.log(`Request to agent endpoint ${endpoint} returned status ${response.status}`);

    function extractTextFromAgentResponse(payload) {
      if (typeof payload === 'string') {
        const cleaned = payload.trim();
        const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const dataLine = lines.find((line) => line.startsWith('data:')) || lines.find((line) => line.startsWith('{'));
        if (dataLine) {
          const jsonText = dataLine.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonText);
            return extractTextFromAgentResponse(parsed);
          } catch (parseError) {
            return jsonText;
          }
        }

        return cleaned;
      }

      if (payload && typeof payload === 'object') {
        if (typeof payload.rego === 'string') {
          return payload.rego;
        }

        if (typeof payload.data === 'string') {
          return payload.data;
        }

        if (typeof payload.message === 'string') {
          return payload.message;
        }

        if (payload.content && Array.isArray(payload.content.parts)) {
          const textPart = payload.content.parts.find((part) => part && typeof part.text === 'string');
          if (textPart) {
            return textPart.text;
          }
        }

        if (Array.isArray(payload.parts)) {
          const textPart = payload.parts.find((part) => part && typeof part.text === 'string');
          if (textPart) {
            return textPart.text;
          }
        }
      }

      return null;
    }

    const extracted = extractTextFromAgentResponse(result);
    if (typeof extracted === 'string' && extracted.length > 0) {
      return extracted;
    }

    if (result && typeof result === 'object') {
      const responseText = JSON.stringify(result);
      if (responseText.length > 10) {
        return responseText;
      }
    }

    throw new Error('Unexpected Cloud Run agent response format.');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 'unknown';
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(`Cloud Run agent request failed: ${status} - ${message}`);
    }
    throw new Error(`Network error communicating with Cloud Run agent: ${error}`);
  }
}