export default async function run(input) {
  const articles = Array.isArray(input.articles) ? input.articles : [];
  if (articles.length === 0) throw new Error('Sourced articles required');
  const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 20);
  return articles.slice(0, limit).map((article) => {
    if (!article || typeof article.title !== 'string' || typeof article.text !== 'string'
      || typeof article.sourceUrl !== 'string' || !/^https:\/\//.test(article.sourceUrl)
      || typeof article.asOf !== 'string' || Number.isNaN(Date.parse(article.asOf))) throw new Error('Invalid sourced article');
    const text = `${article.title} ${article.text}`;
    const lower = text.toLocaleLowerCase('vi');
    const entities = ['Việt Nam', 'AI', 'Blockchain', 'Fintech', 'Avalanche', 'x402'].filter((term) => lower.includes(term.toLocaleLowerCase('vi')));
    const topic = lower.includes('blockchain') || lower.includes('avalanche') ? 'BLOCKCHAIN' : lower.includes('fintech') ? 'FINTECH' : 'AI';
    const positive = ['tăng trưởng', 'phát triển', 'tích cực', 'thành công'].filter((term) => lower.includes(term)).length;
    const negative = ['giảm', 'rủi ro', 'suy thoái', 'thất bại'].filter((term) => lower.includes(term)).length;
    const sentiment = positive > negative ? 'POSITIVE' : negative > positive ? 'NEGATIVE' : 'NEUTRAL';
    return { title: article.title, topic, entities, keywords: entities, sentiment, sourceUrl: article.sourceUrl, asOf: article.asOf };
  });
}
