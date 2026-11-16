import { readFile } from 'node:fs/promises';

export interface Template {
  slug: string;
  facetType: 'HOSTED_ACTOR' | 'AUTONOMOUS_AGENT';
  name: string;
  inputSchema: Record<string, unknown>;
  code?: string;
  taskKind?: string;
}

export async function getTemplates(): Promise<Template[]> {
  const goldCode = await readFile(new URL('./vn-gold-fx-actor.mjs', import.meta.url), 'utf8');
  const newsCode = await readFile(new URL('./vn-tech-news-actor.mjs', import.meta.url), 'utf8');
  return [
    { slug: 'vn-gold-fx-actor', facetType: 'HOSTED_ACTOR', name: 'VN Gold & FX Normalizer', code: goldCode,
      inputSchema: { type: 'object', properties: { goldQuotes: { type: 'array' }, fxQuotes: { type: 'array' }, brand: { enum: ['ALL', 'SJC', 'DOJI', 'PNJ'] } } } },
    { slug: 'vn-tech-news-actor', facetType: 'HOSTED_ACTOR', name: 'VN Tech News Extractor', code: newsCode,
      inputSchema: { type: 'object', required: ['articles'], properties: { articles: { type: 'array' }, limit: { type: 'integer', minimum: 1, maximum: 20 } } } },
    { slug: 'vn-market-analyst-agent', facetType: 'AUTONOMOUS_AGENT', name: 'VN Market Analyst Agent', taskKind: 'vn-market-analysis',
      inputSchema: { type: 'object', required: ['question', 'goldQuotes', 'articles'], properties: { question: { type: 'string' }, goldQuotes: { type: 'array' }, fxQuotes: { type: 'array' }, articles: { type: 'array' } } } },
  ];
}
