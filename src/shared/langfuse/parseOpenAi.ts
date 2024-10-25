import type {
  OpenAI,
  OpenAIAdditionalChatOptions,
  ChatResponseChunk,
  ToolCall,
  LLMChatParamsStreaming,
  ToolCallLLMMessageOptions,
  LLMChatParamsNonStreaming,
  PartialToolCall,
  ChatResponse,
  // CompletionResponse,
} from 'llamaindex';

type ParsedOpenAIArguments = {
  model: string;
  input: Record<string, any> | string;
  modelParameters: Record<string, any>;
};

export const parseInputArgs = (
  args:
    | LLMChatParamsStreaming<
        OpenAIAdditionalChatOptions,
        ToolCallLLMMessageOptions
      >
    | LLMChatParamsNonStreaming<
        OpenAIAdditionalChatOptions,
        ToolCallLLMMessageOptions
      >,
  globalArgs: Partial<OpenAI>,
): ParsedOpenAIArguments => {
  let params: Record<string, any> = {};
  params = {
    max_tokens: globalArgs.maxTokens,
    top_p: globalArgs.topP,
    temperature: globalArgs.temperature,
    stream: args.stream,
    frequency_penalty:
      args.additionalChatOptions?.frequency_penalty ??
      globalArgs.additionalChatOptions?.frequency_penalty,
    logit_bias:
      args.additionalChatOptions?.logit_bias ??
      globalArgs.additionalChatOptions?.logit_bias,
    logprobs:
      args.additionalChatOptions?.logprobs ??
      globalArgs.additionalChatOptions?.logprobs,
    n: args.additionalChatOptions?.n ?? globalArgs.additionalChatOptions?.n,
    presence_penalty:
      args.additionalChatOptions?.presence_penalty ??
      globalArgs.additionalChatOptions?.presence_penalty,
    seed:
      args.additionalChatOptions?.seed ??
      globalArgs.additionalChatOptions?.seed,
    stop:
      args.additionalChatOptions?.stop ??
      globalArgs.additionalChatOptions?.stop,
    user:
      args.additionalChatOptions?.user ??
      globalArgs.additionalChatOptions?.user,
    response_format:
      args.additionalChatOptions?.response_format?.type ??
      globalArgs.additionalChatOptions?.response_format?.type,
    top_logprobs:
      args.additionalChatOptions?.top_logprobs ??
      globalArgs.additionalChatOptions?.top_logprobs,
  };

  let input: Record<string, any> | string;
  if (
    args &&
    typeof args === 'object' &&
    !Array.isArray(args) &&
    'messages' in args
  ) {
    input = {};
    input.messages = args.messages;
    if ('function_call' in args) {
      input.function_call = args.function_call;
    }
    if ('functions' in args) {
      input.functions = args.functions;
    }
    if ('tools' in args) {
      input.tools = args.tools;
    }

    if ('tool_choice' in args) {
      input.tool_choice = args.tool_choice;
    }
  } else if ('prompt' in args) {
    input = args.prompt;
  }

  return {
    model: globalArgs.model,
    input: input,
    modelParameters: params,
  };
};

export const parseCompletionOutput = (res: ChatResponse): string => {
  if ('text' in res) {
    return res.text as string;
  }

  if (!res.message?.content) {
    return '';
  }

  return Array.isArray(res.message.content)
    ? res.message.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join(' ')
    : res.message.content;
};

type OpenAIUsage = {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
};

export const parseUsage = (res: ChatResponse) => {
  if (hasCompletionUsage(res.raw)) {
    const { prompt_tokens, completion_tokens, total_tokens } = res.raw.usage;

    return {
      promptTokens: prompt_tokens,
      completionTokens: completion_tokens,
      totalTokens: total_tokens,
    };
  }
};

// Type guard to check if an unknown object is a UsageResponse
function hasCompletionUsage(obj: any): obj is { usage: OpenAIUsage } {
  return (
    obj instanceof Object &&
    'usage' in obj &&
    obj.usage instanceof Object &&
    typeof obj.usage.prompt_tokens === 'number' &&
    typeof obj.usage.completion_tokens === 'number' &&
    typeof obj.usage.total_tokens === 'number'
  );
}

export const parseChunk = (
  rawChunk: ChatResponseChunk<ToolCallLLMMessageOptions>,
):
  | { isToolCall: false; data: string }
  | {
      isToolCall: true;
      data: ToolCall | PartialToolCall;
    } => {
  let isToolCall = false;

  try {
    if (rawChunk.options && 'toolCall' in rawChunk.options) {
      isToolCall = true;
      return { isToolCall, data: rawChunk.options.toolCall[0] };
    }

    if ('delta' in rawChunk) {
      return { isToolCall, data: rawChunk.delta || '' };
    }

    if ('text' in rawChunk) {
      return { isToolCall, data: (rawChunk as any).text || '' };
    }
  } catch (e) {}

  return { isToolCall: false, data: '' };
};

export const getToolCallOutput = (
  toolCallChunks: (ToolCall | PartialToolCall)[],
): {
  tool_calls: {
    function: {
      name: string;
      arguments: string;
    };
  }[];
} => {
  let name = '';
  let toolArguments = '';

  for (const toolCall of toolCallChunks) {
    name = toolCall.name || name;
    toolArguments += typeof toolCall.input === 'string' ? toolCall.input : '';
  }

  return {
    tool_calls: [
      {
        function: {
          name,
          arguments: toolArguments,
        },
      },
    ],
  };
};
