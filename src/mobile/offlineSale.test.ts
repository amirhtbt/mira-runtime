import { describe, expect, it } from 'vitest';
import { calculateOfflineSale } from './offlineSale';

describe('offline invoice arithmetic', () => {
  const line = {quantityMilli:'2000', unitPriceBaseUnit:'1000000', discountBaseUnit:'100000'};
  it('matches the official sales PHP regression case', () => {
    expect(calculateOfflineSale([line], 1000)).toEqual({
      subtotal:'2000000', discount:'100000', tax:'190000', total:'2090000',
      items:[{taxBaseUnit:'190000', lineTotalBaseUnit:'2090000'}],
    });
  });
  it('applies no tax to non-official sales', () => {
    expect(calculateOfflineSale([line]).total).toBe('1900000');
  });
  it('rounds tax per line rather than on the aggregate', () => {
    const small = {quantityMilli:'1000', unitPriceBaseUnit:'5'};
    expect(calculateOfflineSale([small, small], 1000).tax).toBe('2');
  });
  it('rejects a discount greater than its line', () => {
    expect(() => calculateOfflineSale([{...line, discountBaseUnit:'2000001'}])).toThrow('line_discount_exceeds_total');
  });
});
