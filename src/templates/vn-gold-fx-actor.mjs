// Provider-supplied quotes must carry source and observation time. No live prices are fabricated.
export default async function run(input) {
  const gold = Array.isArray(input.goldQuotes) ? input.goldQuotes : [];
  const fx = Array.isArray(input.fxQuotes) ? input.fxQuotes : [];
  if (gold.length + fx.length === 0) throw new Error('Sourced goldQuotes or fxQuotes required');
  const sourced = (row) => typeof row.sourceUrl === 'string' && /^https:\/\//.test(row.sourceUrl)
    && typeof row.asOf === 'string' && !Number.isNaN(Date.parse(row.asOf));
  const amount = (value) => Number.isSafeInteger(value) && value > 0;
  const rows = [];
  for (const row of gold) {
    if (!row || !sourced(row) || !['SJC', 'DOJI', 'PNJ'].includes(row.brand) || !amount(row.buyVnd) || !amount(row.sellVnd)) throw new Error('Invalid sourced gold quote');
    if (input.brand && input.brand !== 'ALL' && input.brand !== row.brand) continue;
    rows.push({ kind: 'GOLD', brand: row.brand, buyVnd: row.buyVnd, sellVnd: row.sellVnd, asOf: row.asOf, sourceUrl: row.sourceUrl });
  }
  for (const row of fx) {
    if (!row || !sourced(row) || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency) || !amount(row.buyVnd) || !amount(row.sellVnd)) throw new Error('Invalid sourced FX quote');
    rows.push({ kind: 'FX', currency: row.currency, buyVnd: row.buyVnd, sellVnd: row.sellVnd, asOf: row.asOf, sourceUrl: row.sourceUrl });
  }
  return rows;
}
