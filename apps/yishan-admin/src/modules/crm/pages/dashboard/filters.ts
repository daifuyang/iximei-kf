import type { HospitalOverviewCategory, HospitalOverviewFilters } from './types';

const numberParam = (value: string | null, min: number, max?: number): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && (max === undefined || parsed <= max)
    ? parsed
    : undefined;
};

export const readFilters = (search: string): HospitalOverviewFilters => {
  const params = new URLSearchParams(search);
  const category = params.get('category');
  return {
    startDate: params.get('startDate') || undefined,
    endDate: params.get('endDate') || undefined,
    category: category === 'oral' || category === 'plastic' || category === 'unknown'
      ? category as HospitalOverviewCategory
      : undefined,
    provinceCode: numberParam(params.get('provinceCode'), 1),
    cityCode: numberParam(params.get('cityCode'), 1),
    status: numberParam(params.get('status'), 0, 1),
  };
};

export const writeFilters = (filters: HospitalOverviewFilters) => {
  const params = new URLSearchParams();
  (Object.entries(filters) as Array<[keyof HospitalOverviewFilters, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};
