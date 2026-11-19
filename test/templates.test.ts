import { expect, test } from 'vitest';
import { createExecutorServer } from '../src/server.js';
import { getTemplates } from '../src/templates/index.js';
import { executeActor } from '../src/execute-actor.js';

const TOKEN = 'local-test-token-at-least-32-characters';
const KEY = `0x${'1'.repeat(64)}` as const;

test('exposes exactly three canonical Vietnamese templates', async () => {
  const app = createExecutorServer({ runnerMode: 'subprocess', runnerPrivateKey: KEY, executorToken: TOKEN, facetEnv: 'local' });
  try {
    const response = await app.inject({ method: 'GET', url: '/v1/templates' });
    expect(response.statusCode).toBe(200);
    expect(response.json().templates.map((item: { facetName: string; facetType: string }) => [item.facetName, item.facetType])).toEqual([
      ['vn-gold-fx-actor', 'ACTOR'],
      ['vn-tech-news-actor', 'ACTOR'],
      ['vn-market-analyst-agent', 'AGENT'],
    ]);
  } finally { await app.close(); }
});

test('gold template normalizes supplied sourced quotations without inventing a current price', async () => {
  const template = (await getTemplates())[0];
  const output = await executeActor(template.code!, {
    goldQuotes: [{ brand: 'SJC', buyVnd: 88000000, sellVnd: 90000000, asOf: '2026-01-01T00:00:00Z', sourceUrl: 'https://sjc.com.vn/' }],
    fxQuotes: [{ currency: 'USD', buyVnd: 25100, sellVnd: 25400, asOf: '2026-01-01T00:00:00Z', sourceUrl: 'https://www.vietcombank.com.vn/' }],
  }, 5000, 'subprocess');
  expect(output.dataset).toEqual([
    { kind: 'GOLD', brand: 'SJC', buyVnd: 88000000, sellVnd: 90000000, asOf: '2026-01-01T00:00:00Z', sourceUrl: 'https://sjc.com.vn/' },
    { kind: 'FX', currency: 'USD', buyVnd: 25100, sellVnd: 25400, asOf: '2026-01-01T00:00:00Z', sourceUrl: 'https://www.vietcombank.com.vn/' },
  ]);
});

test('news template extracts Vietnamese topic and sentiment from sourced text', async () => {
  const template = (await getTemplates())[1];
  const output = await executeActor(template.code!, {
    articles: [{ title: 'AI tăng trưởng tại Việt Nam', text: 'Startup AI tăng trưởng tốt tại Việt Nam', sourceUrl: 'https://example.org/story', asOf: '2026-01-01T00:00:00Z' }],
  }, 5000, 'subprocess');
  expect(output.dataset[0]).toMatchObject({ topic: 'AI', sentiment: 'POSITIVE', sourceUrl: 'https://example.org/story' });
  expect(output.dataset[0].entities).toContain('Việt Nam');
});

test('agent refuses to claim analysis without sourced datasets', async () => {
  const app = createExecutorServer({ runnerMode: 'subprocess', runnerPrivateKey: KEY, executorToken: TOKEN, facetEnv: 'local' });
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload: {
      runId: '019a1234-5678-7abc-8def-123456789abc', facetId: '019a1234-5678-7abc-8def-123456789abd', facetType: 'AGENT', input: { question: 'Phân tích thị trường?' }, timeoutMs: 15000,
      agentConfig: { erc8004ChainId: 43113, erc8004Registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', erc8004TokenId: '1', taskKind: 'vn-market-analysis' },
    } });
    expect(response.statusCode).toBe(422);
  } finally { await app.close(); }
});

test('agent composes Actor datasets into a cited report', async () => {
  const app = createExecutorServer({ runnerMode: 'subprocess', runnerPrivateKey: KEY, executorToken: TOKEN, facetEnv: 'local' });
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/execute', headers: { 'x-facet-executor-token': TOKEN }, payload: {
      runId: '019a1234-5678-7abc-8def-123456789abc', facetId: '019a1234-5678-7abc-8def-123456789abd', facetType: 'AGENT',
      input: { question: 'Phân tích thị trường?', goldQuotes: [{ brand: 'SJC', buyVnd: 88000000, sellVnd: 90000000, asOf: '2026-01-01T00:00:00Z', sourceUrl: 'https://sjc.com.vn/' }], fxQuotes: [], articles: [{ title: 'AI tăng trưởng', text: 'AI tăng trưởng tốt tại Việt Nam', sourceUrl: 'https://example.org/story', asOf: '2026-01-01T00:00:00Z' }] },
      timeoutMs: 15000,
      agentConfig: { erc8004ChainId: 43113, erc8004Registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e', erc8004TokenId: '1', taskKind: 'vn-market-analysis' },
    } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('SUCCEEDED');
    expect(body.dataset).toHaveLength(2);
    expect(body.result.citations).toEqual([{ datasetIndex: 0, sourceUrl: 'https://sjc.com.vn/' }, { datasetIndex: 1, sourceUrl: 'https://example.org/story' }]);
    expect(body.usage.itemCount).toBe(2);
  } finally { await app.close(); }
});
