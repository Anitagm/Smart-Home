// api/chat.js
// Vercel serverless function — a thin, secure proxy to the Anthropic API.
// This is the ONLY place ANTHROPIC_API_KEY is read. It's set as a Vercel
// environment variable (Project Settings → Environment Variables), never
// committed to the repo and never sent to the browser. The frontend calls
// this endpoint; it never talks to Anthropic directly.
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
    return;
  }

  const { messages, tools, system } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: '"messages" must be a non-empty array' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system,
      tools,
      messages
    });
    res.status(200).json(response);
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong calling Claude' });
  }
}
