import { ChatMessage } from 'llamaindex';

export const makeCondenseMessageHistoryPrompt = ({
  chatHistory,
  query,
}: {
  chatHistory: ChatMessage[];
  query: string;
}): ChatMessage[] => {
  return [
    {
      role: 'system',
      content:
        'Given a conversation (between Human and Assistant) and a follow up message from Human, rewrite the message to be a standalone question that captures all relevant context from the conversation. The standalone question must be in the same language as the user input.',
    },
    {
      role: 'user',
      content: `
Chat History:
${chatHistory.map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}`).join('\n')}

Follow Up Message:
${query}
      `.trim(),
    },
  ];
};
