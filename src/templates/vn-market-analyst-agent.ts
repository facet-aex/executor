import { executeActor } from '../execute-actor.js';
import { getTemplates } from './index.js';

export async function runMarketAnalyst(input: Record<string, unknown>, timeoutMs: number, mode: 'docker' | 'subprocess') {
  if (typeof input.question !== 'string' || input.question.trim().length === 0) throw new Error('Question required');
  if (!Array.isArray(input.goldQuotes) || !Array.isArray(input.articles)) throw new Error('Sourced Actor inputs required');
  const [gold, news] = await getTemplates();
  const runTimeout = Math.max(1, Math.floor(timeoutMs / 2));
  const goldRun = await executeActor(gold.code!, { goldQuotes: input.goldQuotes, fxQuotes: input.fxQuotes ?? [], brand: input.brand }, runTimeout, mode);
  const newsRun = await executeActor(news.code!, { articles: input.articles, limit: input.limit }, runTimeout, mode);
  const dataset = [...goldRun.dataset, ...newsRun.dataset];
  if (dataset.length === 0) throw new Error('No sourced data');
  const citations = dataset.map((row, datasetIndex) => ({ datasetIndex, sourceUrl: row.sourceUrl }));
  const result = {
    question: input.question,
    summary: `Tổng hợp ${goldRun.dataset.length} bản ghi vàng/tỷ giá và ${newsRun.dataset.length} bản ghi tin tức có nguồn.`,
    citations,
    dataStatus: 'SUPPLIED_SOURCED_DATA',
  };
  return { result, dataset, logs: [] as string[] };
}
