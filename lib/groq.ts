// =============================================================================
// GROQ CLIENT — drop-in replacement for Gemini (truly free, India-friendly)
// =============================================================================
// PLAIN: This file is the new "phone line" to Groq, an AI service that runs
//        Meta's Llama models for free. No quota games, no regional blocks.
//        Same job as our old Gemini client: ask the AI a question, get
//        structured JSON back.
//
// TECH:  Wraps Groq's OpenAI-compatible chat completions endpoint. Exports
//        generateJson<T>() and generateText() with identical signatures to
//        the old gemini.ts so route files only need an import swap.
// =============================================================================

// PLAIN: Pull the key & model name from .env.local.
// TECH:  Server-side env. Falls back to a powerful default model.
const apiKey = process.env.GROQ_API_KEY;
const modelName = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

// PLAIN: Where Groq's API lives.
// TECH:  OpenAI-compatible endpoint; same request/response shape as OpenAI.
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

// PLAIN: If the key is missing, fail loudly so we know what to fix.
// TECH:  Module-load validation; throws inside route only if Groq is used.
function assertKey(): string {
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error(
      '[groq] Missing GROQ_API_KEY in .env.local. Get one free at https://console.groq.com/keys'
    );
  }
  return apiKey;
}

// =============================================================================
// SCHEMA TYPES — mirror Gemini's SchemaType so route files don't change
// =============================================================================
// PLAIN: Lets us write schemas in the same style as before.
// TECH:  Re-implementation of the SchemaType enum + GeminiSchema interface.
//        Groq doesn't natively use a schema (Gemini does), so we convert the
//        schema into a JSON-shape instruction inside the prompt.
// =============================================================================

export const SchemaType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const;

export type SchemaTypeValue = (typeof SchemaType)[keyof typeof SchemaType];

export type GeminiSchema = {
  type: SchemaTypeValue;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  description?: string;
  enum?: string[];
};

/**
 * PLAIN: Turns our schema object into a human-readable JSON shape that
 *        we paste into the prompt so the LLM knows what to return.
 *
 * TECH:  Recursive serializer. Output looks like:
 *          {
 *            "name": "<STRING: ...>",
 *            "score": "<NUMBER: ...>"
 *          }
 *        We append this to the prompt as a contract.
 */
function schemaToShape(schema: GeminiSchema): string {
  if (schema.type === SchemaType.OBJECT && schema.properties) {
    const fields = Object.entries(schema.properties)
      .map(([key, value]) => `  "${key}": ${schemaToShape(value)}`)
      .join(',\n');
    return `{\n${fields}\n}`;
  }
  if (schema.type === SchemaType.ARRAY && schema.items) {
    return `[ ${schemaToShape(schema.items)} ]`;
  }
  const desc = schema.description ?? '';
  return `"<${schema.type}${desc ? `: ${desc}` : ''}>"`;
}

// =============================================================================
// PUBLIC API — generateJson + generateText
// =============================================================================

/**
 * PLAIN: Asks Groq's Llama model a question and forces it to respond with
 *        valid JSON in the shape we describe.
 *
 * TECH:  Uses Groq's response_format: { type: 'json_object' } to enforce
 *        valid JSON. Schema is rendered into the prompt as instructions.
 *        Returns parsed object. Throws on parse error or API failure.
 */
export async function generateJson<T = unknown>(
  prompt: string,
  schema: GeminiSchema
): Promise<T> {
  const key = assertKey();

  // PLAIN: Build a fortified prompt that includes the JSON shape we want.
  // TECH:  Inject schema-as-shape into prompt; Llama follows shape reliably.
  const augmentedPrompt = `${prompt}

You MUST respond with a single valid JSON object matching exactly this shape (no markdown, no code fences, just JSON):
${schemaToShape(schema)}`;

  // PLAIN: Make the API call.
  // TECH:  POST chat completion with response_format=json_object.
  const response = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: augmentedPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  // PLAIN: If Groq rejected the request, surface the error clearly.
  // TECH:  Read body once; throw with status + body for debugging.
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`[groq] api error ${response.status}: ${text}`);
  }

  // PLAIN: Parse the wrapper response, then parse the actual JSON content.
  // TECH:  OpenAI-compat response: { choices: [{ message: { content } }] }.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`[groq] empty response: ${text}`);
  }

  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error(
      `[groq] failed to parse JSON: ${(err as Error).message}\nRaw: ${content}`
    );
  }
}

/**
 * PLAIN: Asks Groq for a plain text response (no JSON).
 *
 * TECH:  Free-form chat completion. Used for one-off captions if needed.
 */
export async function generateText(prompt: string): Promise<string> {
  const key = assertKey();

  const response = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`[groq] api error ${response.status}: ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(text);
  return (data?.choices?.[0]?.message?.content ?? '').trim();
}
