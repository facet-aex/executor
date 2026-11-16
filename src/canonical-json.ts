import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      if (seen.has(item)) throw new Error('cyclic JSON');
      seen.add(item);
      const result = item.map(normalize);
      seen.delete(item);
      return result;
    }
    if (item !== null && typeof item === 'object') {
      if (seen.has(item)) throw new Error('cyclic JSON');
      seen.add(item);
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(item).sort()) {
        const normalized = normalize((item as Record<string, unknown>)[key]);
        if (normalized !== undefined) result[key] = normalized;
      }
      seen.delete(item);
      return result;
    }
    return item;
  };
  const serialized = JSON.stringify(normalize(value));
  if (serialized === undefined) throw new Error('value is not JSON');
  return serialized;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
