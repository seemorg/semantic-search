// /**
//  * CondenseQuestionChatEngine is used in conjunction with a Index (for example VectorStoreIndex).
//  * It does two steps on taking a user's chat message: first, it condenses the chat message
//  * with the previous chat history into a question with more context.
//  * Then, it queries the underlying Index using the new question with context and returns
//  * the response.
//  * CondenseQuestionChatEngine performs well when the input is primarily questions about the
//  * underlying data. It performs less well when the chat messages are not questions about the
//  * data, or are very referential to previous context.
//  */

// import {
//   ChatEngine,
//   ChatEngineParamsNonStreaming,
//   ChatEngineParamsStreaming,
//   ChatHistory,
//   ChatMessage,
//   CondenseQuestionPrompt,
//   LLM,
//   PromptMixin,
//   QueryEngine,
//   ServiceContext,
//   defaultCondenseQuestionPrompt,
//   getHistory,
//   messagesToHistoryStr,
// } from 'llamaindex/dist/type/engines/query/';
// import { llmFromSettingsOrContext } from 'llamaindex/dist/type/Settings';
// import { wrapEventCaller } from 'llamaindex/dist/type/internal/context/EventCaller';
// import { extractText, streamReducer } from 'llamaindex/dist/type/llm/utils';

// export class CondenseQuestionChatEngine
//   extends PromptMixin
//   implements ChatEngine
// {
//   queryEngine: QueryEngine;
//   chatHistory: ChatHistory;
//   llm: LLM;
//   condenseMessagePrompt: CondenseQuestionPrompt;

//   constructor(init: {
//     queryEngine: QueryEngine;
//     chatHistory: ChatMessage[];
//     serviceContext?: ServiceContext;
//     condenseMessagePrompt?: CondenseQuestionPrompt;
//   }) {
//     super();

//     this.queryEngine = init.queryEngine;
//     this.chatHistory = getHistory(init?.chatHistory);
//     this.llm = llmFromSettingsOrContext(init?.serviceContext);
//     this.condenseMessagePrompt =
//       init?.condenseMessagePrompt ?? defaultCondenseQuestionPrompt;
//   }

//   protected _getPrompts(): { condenseMessagePrompt: CondenseQuestionPrompt } {
//     return {
//       condenseMessagePrompt: this.condenseMessagePrompt,
//     };
//   }

//   protected _updatePrompts(promptsDict: {
//     condenseMessagePrompt: CondenseQuestionPrompt;
//   }): void {
//     if (promptsDict.condenseMessagePrompt) {
//       this.condenseMessagePrompt = promptsDict.condenseMessagePrompt;
//     }
//   }

//   private async condenseQuestion(chatHistory: ChatHistory, question: string) {
//     const chatHistoryStr = messagesToHistoryStr(
//       await chatHistory.requestMessages(),
//     );

//     return this.llm.complete({
//       prompt: this.condenseMessagePrompt({
//         question: question,
//         chatHistory: chatHistoryStr,
//       }),
//     });
//   }

//   chat(
//     params: ChatEngineParamsStreaming,
//   ): Promise<AsyncIterable<EngineResponse>>;
//   chat(params: ChatEngineParamsNonStreaming): Promise<EngineResponse>;
//   @wrapEventCaller
//   async chat(
//     params: ChatEngineParamsStreaming | ChatEngineParamsNonStreaming,
//   ): Promise<EngineResponse | AsyncIterable<EngineResponse>> {
//     const { message, stream } = params;
//     const chatHistory = params.chatHistory
//       ? getHistory(params.chatHistory)
//       : this.chatHistory;

//     const condensedQuestion = (
//       await this.condenseQuestion(chatHistory, extractText(message))
//     ).text;
//     chatHistory.addMessage({ content: message, role: 'user' });

//     if (stream) {
//       const stream = await this.queryEngine.query({
//         query: condensedQuestion,
//         stream: true,
//       });
//       return streamReducer({
//         stream,
//         initialValue: '',
//         reducer: (accumulator, part) => (accumulator += part.response),
//         finished: (accumulator) => {
//           chatHistory.addMessage({ content: accumulator, role: 'assistant' });
//         },
//       });
//     }
//     const response = await this.queryEngine.query({
//       query: condensedQuestion,
//     });
//     chatHistory.addMessage({ content: response.response, role: 'assistant' });

//     return response;
//   }

//   reset() {
//     this.chatHistory.reset();
//   }
// }
