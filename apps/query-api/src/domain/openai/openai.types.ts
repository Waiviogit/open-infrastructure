export type OpenAiJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  /** Structured Outputs strict mode; the schema must then list every property as required. */
  strict?: boolean;
};

export type OpenAiReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export type OpenAiJsonPromptInput = {
  prompt: string;
  jsonSchema: OpenAiJsonSchema;
  /** Overrides the shared external request timeout for slow prompts. */
  timeoutMs?: number;
  /** Only for reasoning models (the default `OPENAI_MODEL` is one). */
  reasoningEffort?: OpenAiReasoningEffort;
};

export type OpenAiJsonSchemaResult<T = unknown> =
  | { result: T; error?: undefined }
  | { result?: undefined; error: string };
