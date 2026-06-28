export interface LlmCompletionRequest {
  endpoint: string
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  signal?: AbortSignal
}

export async function* streamCompletion(
  request: LlmCompletionRequest,
): AsyncGenerator<string, void, unknown> {
  const base = request.endpoint.replace(/\/+$/, '')
  const url = base.endsWith('/v1')
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        max_tokens: 256,
      }),
      signal: request.signal,
    })
  } catch (e: any) {
    if (e?.name === 'TypeError' && e?.message?.includes('fetch')) {
      throw new Error(`CORS error: The server at ${request.endpoint} does not allow cross-origin requests. The API provider needs to add Access-Control-Allow-Origin headers.`)
    }
    throw e
  }

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data)
        const token = parsed.choices?.[0]?.delta?.content
        if (token) yield token
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export const GHOST_TEXT_SYSTEM_PROMPT = `You are a markdown autocomplete assistant. Given the markdown document up to the cursor position, suggest the next few words or lines the user would likely want to write. Rules:
- Only output the suggested text, nothing else
- Keep suggestions short (1-3 sentences or a short phrase)
- Do not repeat text that already exists
- Match the writing style and language of the document
- Do not add explanations or markdown formatting artifacts
- If you cannot determine what comes next, output nothing`

export async function fetchModels(endpoint: string, apiKey: string): Promise<string[]> {
  const base = endpoint.replace(/\/+$/, '')
  const url = base.endsWith('/v1')
    ? `${base}/models`
    : `${base}/v1/models`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`)
  const data = await response.json()
  const models: string[] = data.data?.map((m: any) => m.id) ?? []
  return models.sort()
}
