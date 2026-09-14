import { Drawer, Empty, Table } from 'antd';
import React from 'react';
import type { HospitalOverviewCity } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cities: HospitalOverviewCity[];
  onSelectCity: (city: Pick<HospitalOverviewCity, 'provinceCode' | 'cityCode'>) => void;
}

const HospitalCityDrilldownDrawer: React.FC<Props> = ({ open, onClose, cities, onSelectCity }) => (
  <Drawer title="城市明细" placement="right" width={520} open={open} onClose={onClose}>
    <Table
      rowKey="cityCode"
      size="small"
      dataSource={cities}
      pagination={false}
      locale={{ emptyText: <Empty description="暂无城市数据" /> }}
      columns={[
        { title: '省份', dataIndex: 'provinceName', key: 'provinceName' },
        {
          title: '城市',
          dataIndex: 'cityName',
          key: 'cityName',
          render: (cityName: string, row: HospitalOverviewCity) => (
            <button type="button" onClick={() => onSelectCity({ provinceCode: row.provinceCode, cityCode: row.cityCode })}>{cityName}</button>
          ),
        },
        { title: '医院数', dataIndex: 'hospitalCount', key: 'hospitalCount', align: 'right' as const },
      ]}
    />
  </Drawer>
);

export default HospitalCityDrilldownDrawer;
