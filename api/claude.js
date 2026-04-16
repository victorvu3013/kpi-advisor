export default async function handler(req, res) {
  // Handle preflight CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude-proxy] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured — set ANTHROPIC_API_KEY in Vercel Environment Variables' });
  }

  try {
    const body = req.body;
    console.log('[claude-proxy] model:', body.model, '| max_tokens:', body.max_tokens);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[claude-proxy] Anthropic error', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    console.log('[claude-proxy] OK — input:', data.usage?.input_tokens, 'output:', data.usage?.output_tokens);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[claude-proxy] fetch error:', error.message);
    return res.status(500).json({ error: 'Proxy fetch failed: ' + error.message });
  }
}
