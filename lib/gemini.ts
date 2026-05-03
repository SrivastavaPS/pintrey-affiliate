// =============================================================================
// GEMINI CLIENT — connection to Google's free AI model
// =============================================================================
// PLAIN: This file is the "phone line" to Gemini, the AI that picks our
//        niches and writes our pin captions. Other files import the helpers
//        below to ask Gemini questions and get JSON answers back.
//
// TECH:  Wrapper around @google/generative-ai. Provides a typed
//        `generateJson()` helper that forces JSON-mode responses so
//        callers get structured data instead of free-form text to parse.
// =============================================================================

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// PLAIN: Read the Gemini API key from .env.local.
// TECH:  Server-side env var; not exposed to browser.
const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

if (!apiKey) {
  throw new Error('[gemini] Missing GEMINI_API_KEY in .env.local');
}

// PLAIN: Create the Gemini client. We use this to make AI calls.
// TECH:  Singleton GoogleGenerativeAI instance.
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * PLAIN: Asks Gemini a question and forces it to respond with valid JSON
 *        in the shape we describe. This is way more reliable than asking
 *        for text and parsing it ourselves.
 *
 * TECH:  Uses Gemini's JSON mode (responseMimeType: 'application/json')
 *        plus a responseSchema to constrain output. Returns parsed object.
 *        Throws on parse error or API failure — caller handles fallback.
 *
 * @param prompt    The instruction to send to Gemini.
 * @param schema    JSON schema describing the expected response shape.
 * @returns         Parsed JSON object matching the schema.
 */
export async function generateJson<T = unknown>(
  prompt: string,
  schema: GeminiSchema
): Promise<T> {
  // PLAIN: Pick the model and tell it we want a JSON response.
  // TECH:  generationConfig with responseMimeType + responseSchema for
  //        structured output guarantees.
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: schema as any,
    },
  });

  // PLAIN: Send the prompt. Wait for the response.
  // TECH:  Single-turn generation; no multi-turn chat needed for POC.
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // PLAIN: Convert the text into a real object our code can use.
  // TECH:  JSON.parse — Gemini in JSON mode guarantees valid JSON, but
  //        we still wrap in try/catch for safety.
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `[gemini] failed to parse JSON response: ${(err as Error).message}\n` +
      `Raw response: ${text}`
    );
  }
}

/**
 * PLAIN: Asks Gemini for a plain text response (no JSON). Used for things
 *        like generating a single caption or hashtag list.
 *
 * TECH:  Free-form text generation; no schema constraint.
 */
export async function generateText(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// =============================================================================
// SCHEMA HELPERS — pre-built schemas to use with generateJson()
// =============================================================================
// PLAIN: Shortcuts so we don't have to repeat the boilerplate every time
//        we want, say, "an object with fields X, Y, Z."
//
// TECH:  Re-export Gemini's SchemaType + helper builders for common shapes.
// =============================================================================

export { SchemaType };

// PLAIN: A flexible schema type alias used in generateJson().
// TECH:  Avoid leaking @google/generative-ai's verbose Schema type.
export type GeminiSchema = {
  type: SchemaType;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  description?: string;
  enum?: string[];
};
