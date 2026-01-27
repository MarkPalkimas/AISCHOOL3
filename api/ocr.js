export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageDataUrl, filename } = await req.json();

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing imageDataUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = `
Extract class materials from the image.

Return ONLY valid JSON:
{
  "filename": "...",
  "summary": "MAX 800 chars, bullet points, keep only key definitions/formulas/steps",
  "raw_text": "MAX 2000 chars, truncate if longer"
}
`.trim();

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: imageDataUrl, detail: 'low' },
            ],
          },
        ],
        temperature: 0.2,
        max_output_tokens: 600,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.error || data, status: resp.status }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text =
      data?.output?.[0]?.content?.find?.((c) => c.type === 'output_text')?.text ||
      data?.output_text ||
      '';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        filename: filename || 'image',
        summary: (text || '').slice(0, 800),
        raw_text: '',
      };
    }

    const safe = {
      filename: (parsed.filename || filename || 'image').slice(0, 120),
      summary: (parsed.summary || '').slice(0, 800),
      raw_text: (parsed.raw_text || '').slice(0, 2000),
    };

    return new Response(JSON.stringify(safe), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'OCR failed: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
