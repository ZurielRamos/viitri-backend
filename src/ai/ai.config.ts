import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AiModuleOptions } from '@nestjs/ai';
import type { ConfigService } from '@nestjs/config';

/** Modelo con visión, barato y con salida estructurada. Se cambia con OPENROUTER_MODEL. */
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash';

/**
 * Modelos de lenguaje por OpenRouter, que sirve la API de OpenAI. Sin
 * OPENROUTER_API_KEY la API arranca igual: quien llama revisa `aiEnabled()`
 * y usa su alternativa sin IA.
 */
export function createAiOptions(config: ConfigService): AiModuleOptions {
  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.get<string>('OPENROUTER_API_KEY') ?? '',
    // OpenRouter muestra la app en su panel con estos encabezados.
    headers: { 'HTTP-Referer': 'https://viitri.com', 'X-Title': 'viitri' },
    supportsStructuredOutputs: true,
  });
  return {
    models: {
      default: openrouter(
        config.get<string>('OPENROUTER_MODEL') || DEFAULT_OPENROUTER_MODEL,
      ),
    },
    defaults: { timeout: '25s', retry: { attempts: 2 }, temperature: 0.2 },
  };
}

export function aiEnabled(config: ConfigService): boolean {
  return Boolean(config.get<string>('OPENROUTER_API_KEY'));
}
