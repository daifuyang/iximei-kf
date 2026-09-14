import { readFilters } from '../filters';

describe('hospital overview URL filters', () => {
  it('drops values that the overview endpoint would reject', () => {
    expect(readFilters('?provinceCode=0&cityCode=-1&status=2&category=other')).toEqual({
      startDate: undefined,
      endDate: undefined,
      category: undefined,
      provinceCode: undefined,
      cityCode: undefined,
      status: undefined,
    });
  });

  it('keeps valid region, status, and category filter values', () => {
    expect(readFilters('?provinceCode=11&cityCode=1101&status=0&category=unknown')).toEqual({
      provinceCode: 11,
      cityCode: 1101,
      status: 0,
      category: 'unknown',
    });
  });
});
