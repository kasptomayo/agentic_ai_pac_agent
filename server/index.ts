import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

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

async function generateRegoPolicy(pdfText: string): Promise<string> {
  const apiKey = process.env.GOOGLE_ADK_API_KEY;
  const apiUrl = process.env.GOOGLE_ADK_API_URL || 'https://regoagent-964834321101.us-west1.run.app';
  const agentId = process.env.GOOGLE_ADK_AGENT_ID;
  const model = process.env.GOOGLE_ADK_MODEL || 'text-bison-001';

  if (!apiKey) {
    throw new Error('GOOGLE_ADK_API_KEY is not configured.');
  }

  const prompt = `Convert the following bank loan rules into a valid OPA REGO policy. Use only the rules provided, keep the policy concise, and include comments that explain the logic. Respond with REGO only, no additional prose.\n\nBank loan rules:\n${pdfText}`;

  try {
    const response = await axios.post(`${apiUrl}/run_sse`, {
      app_name: "regoagent",
      user_id: "agentnic-ui-user",
      session_id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      new_message: {
        role: "user",
        parts: [{
          text: prompt
        }]
      },
      streaming: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 60000, // 60 second timeout for agent processing
      httpsAgent: new https.Agent({
        rejectUnauthorized: true, // Ensure SSL certificate validation
      }),
    });

    const result = response.data;
    
    // Handle different possible response formats from the agent
    if (typeof result.rego === 'string') {
      return result.rego;
    }
    
    // Check for SSE-style response
    if (result.data && typeof result.data === 'string') {
      return result.data;
    }
    
    // Check for message content in response
    if (result.message && typeof result.message === 'string') {
      return result.message;
    }
    
    // Check for parts array response
    if (result.parts && Array.isArray(result.parts) && result.parts.length > 0) {
      const textPart = result.parts.find((part: any) => part.text);
      if (textPart && typeof textPart.text === 'string') {
        return textPart.text;
      }
    }
    
    // Fallback to stringifying the entire response if it's not empty
    if (result && typeof result === 'object') {
      const responseText = JSON.stringify(result);
      if (responseText.length > 10) { // Not just empty braces
        return responseText;
      }
    }

    throw new Error('Unexpected Cloud Run agent response format.');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 'unknown';
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(`Cloud Run agent /run_sse request failed: ${status} - ${message}`);
    }
    throw new Error(`Network error communicating with Cloud Run agent: ${error}`);
  }
