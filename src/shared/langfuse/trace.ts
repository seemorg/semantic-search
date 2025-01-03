import type {
  ChatResponse,
  ChatResponseChunk,
  OpenAI,
  PartialToolCall,
  ToolCall,
  ToolCallLLMMessageOptions,
} from 'llamaindex';

import { langfuse } from './singleton';
import {
  getToolCallOutput,
  parseChunk,
  parseCompletionOutput,
  parseInputArgs,
  parseUsage,
} from './parseOpenAi';
import { isAsyncIterable } from './utils';
import type {
  LangfuseConfig,
  LangfuseNewTraceConfig,
  LangfuseParent,
} from './types';

type GenericMethod = (...args: unknown[]) => unknown;

export const withTracing = <T extends GenericMethod>(
  tracedMethod: T,
  sdk: OpenAI,
  config?: LangfuseConfig & Required<{ generationName: string }>,
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  return (...args) => wrapMethod(tracedMethod, sdk, config, ...args);
};

const wrapMethod = async <T extends GenericMethod>(
  tracedMethod: T,
  sdk: OpenAI,
  config?: LangfuseConfig,
  ...args: Parameters<T>
): Promise<ReturnType<T> | any> => {
  const { model, input, modelParameters, extra } = parseInputArgs(
    args[0] ?? ({} as any),
    sdk,
  );

  const finalModelParams = { ...modelParameters, response_format: undefined };
  const finalMetadata = {
    ...config?.metadata,
    response_format:
      'response_format' in modelParameters
        ? modelParameters.response_format
        : undefined,
  };

  const promptName = extra?.promptName ?? config?.langfusePrompt?.name;
  const promptVersion = extra?.promptVersion ?? config?.langfusePrompt?.version;
  const traceId = extra?.traceId ?? (config as LangfuseNewTraceConfig)?.traceId;
  const sessionId =
    extra?.sessionId ?? (config as LangfuseNewTraceConfig)?.sessionId;

  let observationData = {
    model,
    input,
    modelParameters: finalModelParams,
    name: config?.generationName,
    startTime: new Date(),
    promptName,
    promptVersion,
    metadata: finalMetadata,
  };

  let langfuseParent: LangfuseParent;
  const hasUserProvidedParent = config && 'parent' in config;

  if (hasUserProvidedParent) {
    langfuseParent = config.parent;

    // Remove the parent from the config to avoid circular references in the generation body
    const filteredConfig = { ...config, parent: undefined };

    observationData = {
      ...filteredConfig,
      ...observationData,
      promptName,
      promptVersion,
    };
  } else {
    langfuseParent = langfuse.trace({
      ...config,
      ...observationData,
      id: traceId,
      sessionId,
      timestamp: observationData.startTime,
    });
  }

  try {
    const res = await tracedMethod(...args);

    // Handle stream responses
    if (isAsyncIterable(res)) {
      async function* tracedOutputGenerator(): AsyncGenerator<
        unknown,
        void,
        unknown
      > {
        const response = res;
        const textChunks: string[] = [];
        const toolCallChunks: (ToolCall | PartialToolCall)[] = [];
        let completionStartTime: Date | null = null;

        for await (const rawChunk of response as AsyncIterable<
          ChatResponseChunk<ToolCallLLMMessageOptions>
        >) {
          completionStartTime = completionStartTime ?? new Date();

          const processedChunk = parseChunk(rawChunk);

          if (!processedChunk.isToolCall) {
            textChunks.push(processedChunk.data as string);
          } else {
            toolCallChunks.push(
              processedChunk.data as ToolCall | PartialToolCall,
            );
          }

          yield rawChunk;
        }

        const output =
          toolCallChunks.length > 0
            ? getToolCallOutput(toolCallChunks)
            : textChunks.join('');

        langfuseParent.generation({
          ...observationData,
          output,
          endTime: new Date(),
          completionStartTime,
        });

        if (!hasUserProvidedParent) {
          langfuseParent.update({ output });
        }
      }

      return tracedOutputGenerator() as ReturnType<T>;
    }

    const usage = parseUsage(res as ChatResponse);
    const output = parseCompletionOutput(res as ChatResponse);

    langfuseParent.generation({
      ...observationData,
      output,
      endTime: new Date(),
      usage,
    });

    if (!hasUserProvidedParent) {
      langfuseParent.update({ output });
    }

    return res;
  } catch (error) {
    langfuseParent.generation({
      ...observationData,
      endTime: new Date(),
      statusMessage: String(error),
      level: 'ERROR',
      usage: {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      },
    });

    throw error;
  }
};
