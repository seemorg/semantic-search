import {
  CorrectnessEvaluator,
  RelevancyEvaluator,
  FaithfulnessEvaluator,
  VectorStoreIndex,
} from 'llamaindex';
import { setLlamaindexSettings } from 'src/shared/llamaindex';
import { createVectorStore } from 'src/shared/vector-store';
import fs from 'fs';

setLlamaindexSettings('DEV');

const fEvaluator = new FaithfulnessEvaluator();
const rEvaluator = new RelevancyEvaluator();
const cEvaluator = new CorrectnessEvaluator();

const queries = [
  'What are the pillars of Islam?',
  'What is the age of puberty?',
  "How to know when it's Ramadan?",
  'What are the pillars of Iman?',
  'ما هي اداب و سنن الطعام',
];

const main = async () => {
  const index = await VectorStoreIndex.fromVectorStore(
    createVectorStore('DEV'),
  );
  const queryEngine = index.asQueryEngine({
    similarityTopK: 5,
    preFilters: {
      filters: [
        {
          key: 'bookSlug',
          value: 'sahih',
          filterType: 'ExactMatch',
        },
      ],
    },
  });

  const responses: string[] = [];
  let i = 1;
  for (const query of queries) {
    console.log(`Evaluating query ${i} / ${queries.length}...`);
    i++;

    const response = await queryEngine.query({
      query,
    });

    const [faithfulnessResult, relevancyResult, correctnessResult] =
      await Promise.all([
        fEvaluator.evaluateResponse({
          query,
          response,
        }),
        rEvaluator.evaluateResponse({
          query,
          response,
        }),
        cEvaluator.evaluateResponse({
          query,
          response,
        }),
      ]);

    responses.push(`
---------------------
Query: ${query}
Response: ${response.response}


Faithfulness: ${faithfulnessResult.passing ? 'Pass' : 'Fail'} (${
      faithfulnessResult.score
    } / 1)
Relevancy: ${relevancyResult.passing ? 'Pass' : 'Fail'} (${relevancyResult.score} / 1)
Correctness: ${correctnessResult.passing ? 'Pass' : 'Fail'} (${
      correctnessResult.score
    } / 5)
---------------------
`);
  }

  fs.writeFileSync('evaluation.txt', responses.join('\n'));

  console.log('Done!');
};

main();
