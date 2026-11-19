import { readFile } from 'node:fs/promises';

export interface Template {
  facetName: string;
  facetType: 'ACTOR' | 'AGENT';
  facetDisplayName: string;
  inputSchema: Record<string, unknown>;
  code?: string;
  taskKind?: string;
}

export async function getTemplates(): Promise<Template[]> {
  const goldCode = await readFile(new URL('./vn-gold-fx-actor.mjs', import.meta.url), 'utf8');
  const newsCode = await readFile(new URL('./vn-tech-news-actor.mjs', import.meta.url), 'utf8');
  return [
    { facetName: 'vn-gold-fx-actor', facetType: 'ACTOR', facetDisplayName: 'VN Gold & FX Normalizer', code: goldCode,
      inputSchema: { type: 'object', properties: { goldQuotes: { type: 'array' }, fxQuotes: { type: 'array' }, brand: { enum: ['ALL', 'SJC', 'DOJI', 'PNJ'] } } } },
    { facetName: 'vn-tech-news-actor', facetType: 'ACTOR', facetDisplayName: 'VN Tech News Extractor', code: newsCode,
      inputSchema: { type: 'object', required: ['articles'], properties: { articles: { type: 'array' }, limit: { type: 'integer', minimum: 1, maximum: 20 } } } },
    { facetName: 'vn-market-analyst-agent', facetType: 'AGENT', facetDisplayName: 'VN Market Analyst Agent', taskKind: 'vn-market-analysis',
      inputSchema: { type: 'object', required: ['question', 'goldQuotes', 'articles'], properties: { question: { type: 'string' }, goldQuotes: { type: 'array' }, fxQuotes: { type: 'array' }, articles: { type: 'array' } } } },
  ];
}
