import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { getHospitalOverview, getHospitalOverviewDetails, getDashboardCapabilities, getDashboardStats } from '@/modules/crm/api';
import { readFilters, writeFilters } from '../filters';

let mockLocation = { pathname: '/crm/dashboard', search: '' };
let mockRealLegacy = false;
const mockLocationListeners = new Set<() => void>();
const mockHistoryReplace = jest.fn((url: string) => {
  const [pathname, query = ''] = url.split('?');
  mockLocation = { pathname, search: query ? `?${query}` : '' };
  mockLocationListeners.forEach((listener) => {
    listener();
  });
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

jest.mock('../components/LegacyCrmDashboardSection', () => () => mockRealLegacy
  ? require('react').createElement(jest.requireActual('../components/LegacyCrmDashboardSection').default) : null);

jest.mock('@ant-design/charts', () => ({
  Bar: () => <div data-testid="distribution-chart" />,
  Column: () => null,
  Pie: () => null,
}));

jest.mock('@/modules/crm/api', () => ({
  getHospitalOverview: jest.fn(),
  getHospitalOverviewDetails: jest.fn(),
  getDashboardCapabilities: jest.fn(),
  getDashboardStats: jest.fn(),
  searchHospitals: jest.fn(),
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
    mockRealLegacy = false;
    (getDashboardCapabilities as jest.Mock).mockResolvedValue({ success: true, data: { hospitalOverview: true } });
    mockLocation = { pathname: '/crm/dashboard', search: '?status=1' };
    mockHistoryReplace.mockClear();
    getHospitalOverviewMock.mockReset();
    getHospitalOverviewDetailsMock.mockReset();
  });

  it('formats API percentage points directly', async () => {
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: { ...overview, businessByCategory: [
      { category: 'oral', dispatchCount: 2, arrivedCount: 1, dealCount: 0, arrivedRate: 50, dealRate: 0 },
    ] } });
    render(<DashboardPage />);
    expect(await screen.findByText('50.0%')).toBeTruthy();
    expect(screen.getByText('0.0%')).toBeTruthy();
  });

  it('keeps category and other filters when drilling into newly created hospitals', async () => {
    mockLocation.search = '?category=oral&status=1&startDate=2026-01-01&endDate=2026-01-31';
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: overview });
    getHospitalOverviewDetailsMock.mockResolvedValue({ success: true, data: [], pagination: { total: 0 } });
    render(<DashboardPage />);
    await screen.findByText('10');
    fireEvent.click(screen.getByRole('button', { name: '本期新增医院' }));
    await waitFor(() => expect(getHospitalOverviewDetailsMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'oral', status: 1, startDate: '2026-01-01', endDate: '2026-01-31', hospitalScope: 'period-new',
    })));
    expect(mockLocation.search).toContain('hospitalScope=period-new');
  });

  it('round-trips missing regions and creation scope through URL filters', () => {
    expect(readFilters(writeFilters({ provinceCode: 'missing', cityCode: 'missing', hospitalScope: 'period-new' } as any)))
      .toMatchObject({ provinceCode: 'missing', cityCode: 'missing', hospitalScope: 'period-new' });
  });

  it('retains scoped legacy analysis without requesting unavailable hospital aggregates', async () => {
    mockRealLegacy = true;
    (getDashboardStats as jest.Mock).mockResolvedValue({ success: true, data: {
      hospitals: { total: 7, periodNew: 7, monthNew: 7, weekNew: 7, activeCount: 7 },
      customers: { total: 137, periodNew: 137, monthNew: 137, weekNew: 137, dayNew: 137 },
      dispatches: { total: 4, periodNew: 4, periodCompleted: 2, monthNew: 4, weekNew: 4, monthCompleted: 2 },
      customerByStatus: [], dispatchByStatus: [], monthlyTrend: { customers: [], dispatches: [] },
    } });
    (getDashboardCapabilities as jest.Mock).mockResolvedValue({ success: true, data: { hospitalOverview: false } });
    render(<DashboardPage />);
    expect(await screen.findByRole('region', { name: '独立经营分析' })).toBeTruthy();
    await waitFor(() => expect(getDashboardCapabilities).toHaveBeenCalled());
    expect(getHospitalOverviewMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '医院总数' })).toBeNull();
    expect((await screen.findAllByText('137')).length).toBeGreaterThan(0);
    expect(getDashboardStats).toHaveBeenCalledWith(expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }));
  });

  it('drills missing province and city buckets using explicit missing filters', async () => {
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: { ...overview,
      byProvince: [{ provinceCode: 'missing', provinceName: '未填写省份', hospitalCount: 1 }],
      byCity: [{ provinceCode: 'missing', provinceName: '未填写省份', cityCode: 'missing', cityName: '未填写城市', hospitalCount: 1 }],
    } });
    getHospitalOverviewDetailsMock.mockResolvedValue({ success: true, data: [{ id: 5, hospitalName: 'Missing region hospital' }], pagination: { total: 1 } });
    render(<DashboardPage />);
    await screen.findByText('10');
    fireEvent.click(screen.getByText('表格'));
    fireEvent.click(screen.getByRole('button', { name: '未填写省份' }));
    fireEvent.click(await screen.findByRole('button', { name: '未填写城市' }));
    expect(await screen.findByText('Missing region hospital')).toBeTruthy();
    expect(getHospitalOverviewDetailsMock).toHaveBeenLastCalledWith(expect.objectContaining({ provinceCode: 'missing', cityCode: 'missing', status: 1 }));
  });

  it('labels legacy analysis as independent of overview controls', async () => {
    getHospitalOverviewMock.mockResolvedValue({ success: true, data: overview });
    render(<DashboardPage />);
    expect(await screen.findByText(/使用本区域的时间和医院筛选/)).toBeTruthy();
  });

  it('marks retained results stale and blocks their drilldown after a filter failure', async () => {
    getHospitalOverviewMock.mockResolvedValueOnce({ success: true, data: overview }).mockRejectedValue(new Error('offline'));
    render(<DashboardPage />);
    await screen.findByText('10');
    fireEvent.click(screen.getByRole('button', { name: '口腔医院' }));
    await screen.findByText('医院总览加载失败');
    expect(screen.getByText(/保留上次成功结果.*下钻已停用/)).toBeTruthy();
    getHospitalOverviewDetailsMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '医院总数' }));
    expect(getHospitalOverviewDetailsMock).not.toHaveBeenCalled();
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
