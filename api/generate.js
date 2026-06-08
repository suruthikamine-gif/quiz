export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const isGeminiConfigured = geminiKey && geminiKey !== 'your-key-here' && geminiKey.trim() !== '';
  const isAnthropicConfigured = anthropicKey && anthropicKey !== 'your-key-here' && anthropicKey.trim() !== '';

  if (!isGeminiConfigured && !isAnthropicConfigured) {
    return res.status(400).json({
      error: 'No AI provider API key is configured. Please open the .env file in the quizforge-ai directory, set either GEMINI_API_KEY or ANTHROPIC_API_KEY, and restart the server.'
    });
  }

  const { prompt, max_tokens } = req.body;

  try {
    if (isGeminiConfigured) {
      // Use Gemini API with auto-fallback models list
      const result = await callGemini(geminiKey, prompt);
      return res.status(200).json(result);
    } else {
      // Use Anthropic API
      console.log('Routing request to Anthropic API...');
      const result = await callAnthropic(anthropicKey, prompt, max_tokens);
      return res.status(200).json(result);
    }
  } catch (err) {
    console.error('Error during quiz generation:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function callGemini(apiKey, prompt) {
  // Ordered list of models to try in case of transient overload or availability issues
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.0-flash',
    'gemini-3.5-flash'
  ];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Attempting quiz generation with Gemini model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `Gemini model ${model} call failed`);
      }

      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error(`Empty response received from Gemini model ${model}`);
      }

      console.log(`✔ Success using model: ${model}`);
      return {
        content: [
          { text: generatedText }
        ]
      };
    } catch (err) {
      console.warn(`⚠ Model ${model} failed: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw new Error(`All available Gemini models are currently overloaded. Please try again in a few seconds. (Details: ${lastError.message})`);
}

async function callAnthropic(apiKey, prompt, max_tokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Anthropic API call failed');
  }
  return data;
}
