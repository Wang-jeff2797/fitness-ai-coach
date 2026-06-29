import OpenAI from "openai";
function getDeepSeekClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY!,
  });
}
export async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" };
  }
): Promise<string> {
  const client = getDeepSeekClient();
  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 2000,
    response_format: options?.responseFormat,
    stream: false,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 返回为空");
  }
  return content;
}
/**
 * 以 JSON 格式调用 DeepSeek，自动解析返回值
 */
export async function callDeepSeekJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<T> {
  const content = await callDeepSeek(systemPrompt, userMessage, {
    ...options,
    responseFormat: { type: "json_object" },
  });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`DeepSeek 返回无法解析为 JSON: ${content.slice(0, 200)}`);
  }
}