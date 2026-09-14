import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { getHospitalOverview, getHospitalOverviewDetails } from '@/modules/crm/api';

let mockLocation = { pathname: '/crm/dashboard', search: '' };
const mockLocationListeners = new Set<() => void>();
const mockHistoryReplace = jest.fn((url: string) => {
  const [pathname, query = ''] = url.split('?');
  mockLocation = { pathname, search: query ? `?${query}` : '' };
  mockLocationListeners.forEach((listener) => listener());
});

Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

jest.mock('@umijs/max', () => {
  const ReactModule = require('react');
  return {
    history: { replace: mockHistoryReplace },
    useLocation: () => {
      const [, setVersion] = ReactModule.useState(0);
      ReactModule.useEffect(() => {
        const listener = () => setVersion((version: number) => version + 1);
        mockLocationListeners.add(listener);
        return () => mockLocationListeners.delete(listener);
      }, []);
      return mockLocation;
    },
  };
});

jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: any) => <main>{children}</main>,
  ProCard: ({ children, extra }: any) => <section>{extra}{children}</section>,
}));

jest.mock('../components/LegacyCrmDashboardSection', () => () => null);

jest.mock('@ant-design/charts', () => ({
  Bar: () => <div data-testid="distribution-chart" />,
}));

jest.mock('@/modules/crm/api', () => ({
  getHospitalOverview: jest.fn(),
  getHospitalOverviewDetails: jest.fn(),
}));

const DashboardPage = require('../index').default;

const getHospitalOverviewMock = getHospitalOverview as jest.Mock;
const getHospitalOverviewDetailsMock = getHospitalOverviewDetails as jest.Mock;

const overview = {
  generatedAt: '2026-01-31T00:00:00.000Z',
  filters: {},
  summary: { total: 10, oral: 4, plastic: 3, unknown: 3, periodNew: 2 },
  byCategory: [
    { category: 'oral', hospitalCount: 4 },
    { category: 'plastic', hospitalCount: 3 },
    { category: 'unknown', hospitalCount: 3 },
  ],
  byProvince: [{ provinceCode: 11, provinceName: 'Beijing', hospitalCount: 10 }],
  byCity: [{ provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing City', hospitalCount: 10 }],
  businessByCategory: [],
};

describe('hospital overview dashboard flow', () => {
  beforeEach(() => {
    mockLocation = { pathname: '/crm/dashboard', search: '?status=1' };
    mockHistoryReplace.mockClear();
    getHospitalOverviewMock.mockReset();
    getHospitalOverviewDetailsMock.mockReset();
  });

  it('does not send a status filter on the initial request without URL filters', async () => {
    mockLocation = { pathname: '/crm/dashboard', search: '' };
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: overview });

    render(<DashboardPage />);

    await waitFor(() => expect(getHospitalOverviewMock).toHaveBeenCalledWith({}));
  });

  it('carries a KPI filter through province, city, and hospital drilldown', async () => {
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: overview });
    getHospitalOverviewDetailsMock.mockResolvedValue({
      success: true,
      data: [{ id: 9, hospitalName: 'Union Hospital', status: 1 }],
      pagination: { total: 1 },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '口腔医院' }));
    await waitFor(() => expect(getHospitalOverviewMock).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'oral',
      status: 1,
    })));

    fireEvent.click(screen.getByText('表格'));
    fireEvent.click(screen.getByRole('button', { name: 'Beijing' }));
    expect(await screen.findByRole('button', { name: 'Beijing City' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Beijing City' }));
    await waitFor(() => expect(getHospitalOverviewDetailsMock).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 10,
      category: 'oral',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    })));
    expect(await screen.findByText('Union Hospital')).toBeTruthy();
  });

  it('renders the no-data state', async () => {
    getHospitalOverviewMock.mockResolvedValue({
      success: true,
      data: { ...overview, summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 }, byCategory: [], byProvince: [], byCity: [] },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('暂无医院数据')).toBeTruthy();
  });

  it('keeps the page retryable after an overview request fails', async () => {
    getHospitalOverviewMock
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({ success: true, data: overview });

    render(<DashboardPage />);

    expect(await screen.findByText('医院总览加载失败')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));
    expect(await screen.findByText('10')).toBeTruthy();
    expect(getHospitalOverviewMock).toHaveBeenCalledTimes(2);
  });
});
