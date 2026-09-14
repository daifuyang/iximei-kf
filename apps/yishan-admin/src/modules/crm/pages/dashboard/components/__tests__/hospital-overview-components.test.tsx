import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { getHospitals } from '@/modules/crm/api';
import HospitalDistributionCard from '../HospitalDistributionCard';
import HospitalDrilldownDrawer from '../HospitalDrilldownDrawer';
import HospitalOverviewKpis from '../HospitalOverviewKpis';

jest.mock('@ant-design/charts', () => ({
  Bar: () => <div data-testid="distribution-chart" />,
}));

jest.mock('@/modules/crm/api', () => ({
  getHospitals: jest.fn(),
}));

const getHospitalsMock = getHospitals as jest.Mock;

describe('hospital overview linked components', () => {
  it('changes the global category filter when a KPI is selected', () => {
    const onSelect = jest.fn();
    render(
      <HospitalOverviewKpis
        summary={{ total: 12, oral: 5, plastic: 4, unknown: 3, periodNew: 2 }}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '口腔医院' }));

    expect(onSelect).toHaveBeenCalledWith({ category: 'oral' });
  });

  it('opens a province selection from the ranked distribution table', () => {
    const onSelect = jest.fn();
    render(
      <HospitalDistributionCard
        byProvince={[
          { provinceCode: 11, provinceName: '北京', hospitalCount: 8 },
        ]}
        byCity={[
          {
            provinceCode: 11,
            provinceName: '北京',
            cityCode: 1101,
            cityName: '北京市',
            hospitalCount: 8,
          },
        ]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('表格'));
    fireEvent.click(screen.getByRole('button', { name: '北京' }));

    expect(onSelect).toHaveBeenCalledWith({ provinceCode: 11 });
  });

  it('loads a paginated drilldown with its inherited overview filters', async () => {
    getHospitalsMock.mockResolvedValue({
      success: true,
      data: [{ id: 9, hospitalName: '协和医院', status: 1 }],
      pagination: { total: 1 },
    } as never);

    render(
      <HospitalDrilldownDrawer
        open
        onClose={jest.fn()}
        filters={{
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          category: 'oral',
          provinceCode: 11,
          cityCode: 1101,
          status: 1,
        }}
      />,
    );

    await waitFor(() => expect(getHospitalsMock).toHaveBeenCalled());
    expect(getHospitalsMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      category: 'oral',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    });
    expect(screen.getByText('协和医院')).toBeTruthy();
  });

  it('shows an empty state and a retryable error in the drilldown', async () => {
    getHospitalsMock.mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0 },
    } as never);
    const { rerender } = render(
      <HospitalDrilldownDrawer open onClose={jest.fn()} filters={{}} />,
    );

    expect(await screen.findByText('暂无医院数据')).toBeTruthy();

    getHospitalsMock.mockRejectedValueOnce(new Error('network failed'));
    rerender(
      <HospitalDrilldownDrawer open onClose={jest.fn()} filters={{ provinceCode: 11 }} />,
    );

    expect(await screen.findByText('加载失败')).toBeTruthy();
    expect(screen.getByText('重 试')).toBeTruthy();
  });
});
