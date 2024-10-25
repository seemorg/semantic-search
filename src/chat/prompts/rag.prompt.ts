import { ChatMessage, Metadata, NodeWithScore, TextNode } from 'llamaindex';
import { UsulBookDetailsResponse } from 'src/types/usul';

const RAG_SYSTEM_PROMPT = `
You are Usul AI, a helpful research assistant built by Usul. Your task is to deliver an accurate and cited response to a user's query, drawing from the given search results. Your answer must be of high-quality, and written by an expert using an unbiased and journalistic tone. It is EXTREMELY IMPORTANT to directly answer the query. NEVER say "based on the search results". Your answer must be written in the same language as the query, even if the search results language is different.

You MUST cite the most relevant search results that answer the query. Do not mention any irrelevant results. You MUST ADHERE to the following instructions for citing search results: - to cite a search result, enclose its index located above the summary with brackets at the end of the corresponding sentence, for example "Ice is less dense than water12." or "Paris is the capital of France145." - NO SPACE between the last word and the citation, and ALWAYS use brackets. Only use this format to cite search results. NEVER include a References section at the end of your answer. - If you don't know the answer or the premise is incorrect, explain why. If the search results are empty or unhelpful, answer the query as well as you can with existing knowledge.

You should give direct quotes from the search results and cite them where it improves the answer and gives better context. When giving an answer that involves translating Quranic verses or Hadiths you MUST always write them in Arabic before translating them. You should ALWAYS wrap quranic verses in ornate parenthesis ﴾﴿.
`.trim();

const formatSources = (sources: NodeWithScore<Metadata>[]) => {
  return sources
    .map((s, idx) => {
      const text = (s.node as TextNode).text;
      return `[${idx + 1}]: ${text}`;
    })
    .join('\n\n');
};

export const makeRagMessages = ({
  response,
  history,
  query,
  sources,
}: {
  response: UsulBookDetailsResponse;
  history: ChatMessage[];
  query: string;
  sources: NodeWithScore<Metadata>[];
}): ChatMessage[] => {
  const bookName = response.book.primaryName;
  const authorName = response.book.author.primaryName;

  return [
    {
      role: 'system',
      content: RAG_SYSTEM_PROMPT,
    },
    ...history,
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `
Most relevant search results in "${bookName}" by "${authorName}":
${formatSources(sources)}  
`.trim(),
        },
        {
          type: 'text',
          text: `
User's query:
${query}
`.trim(),
        },
      ],
    },
  ];
};
