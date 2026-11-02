/*! @license
MIT License

Copyright (c) 2026 T3 Tools Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import type { ClientUsage } from '@/services/api/clientUsage';

export type UsageMetric = 'cost' | 'tokens';
type Model = ClientUsage['models'][number];

/** Shares use observed amounts only; missing prices are never coerced to zero. */
export function modelBreakdown(models: readonly Model[], metric: UsageMetric) {
  const value = (model: Model) =>
    metric === 'tokens' ? model.totalTokens : model.estimatedCostUsd;
  const subtotal = models.reduce((sum, model) => sum + (value(model) ?? 0), 0);
  const peak = Math.max(0, ...models.map((model) => value(model) ?? 0));
  return models
    .map((model) => {
      const amount = value(model);
      return {
        ...model,
        share: amount === null || subtotal <= 0 ? null : amount / subtotal,
        bar: amount === null || peak <= 0 ? null : amount / peak,
      };
    })
    .sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === null && right !== null) return 1;
      if (left !== null && right === null) return -1;
      return (right ?? 0) - (left ?? 0) || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0);
    });
}

export function chronologicalBuckets(rows: ClientUsage['timeline']) {
  return [...rows].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}
