import { callWithOpenAIRetry, getUserKey, guardAiRequest } from '../lib/aiGuard.ts';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const startedAt = Date.now();
  const route = '/api/ocr';
  let status = 500;
  let success = false;
  let retryAttempts = 0;
  let userKey = getUserKey(req);
  let releaseLock = async () => {};

  if (req.method !== 'POST') {
    status = 405;
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      status = 500;
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const guard = await guardAiRequest({
      req,
      body,
      userKey,
      routeName: route,
    });

    userKey = guard.userKey;
    releaseLock = guard.release;

    if (!guard.ok) {
      status = guard.status;
      return new Response(guard.message, {
        status: guard.status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const { imageDataUrl, filename } = body;

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      status = 400;
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

    const retryResult = await callWithOpenAIRetry(
      () =>
        fetch('https://api.openai.com/v1/responses', {
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
        }),
      {
        routeName: route,
        userKey,
      }
    );

    const resp = retryResult.response;
    retryAttempts = retryResult.retryAttempts;

    const data = await resp.json();

    if (!resp.ok) {
      status = resp.status;
      success = false;
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

    status = 200;
    success = true;
    return new Response(JSON.stringify(safe), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    status = 500;
    success = false;
    return new Response(JSON.stringify({ error: 'OCR failed: ' + e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await releaseLock();
    const durationMs = Date.now() - startedAt;
    console.info(JSON.stringify({
      event: 'ai_ocr_request',
      route,
      userKey,
      durationMs,
      success,
      status,
      retryAttempts,
    }));
  }
}
