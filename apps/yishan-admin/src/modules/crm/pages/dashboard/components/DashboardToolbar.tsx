import { ReloadOutlined } from '@ant-design/icons';
import { Button, DatePicker, Segmented, Select } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { TIME_RANGE_OPTIONS } from '../constants';
import styles from '../index.module.less';
import type { DashboardFilters } from '../types';

const { RangePicker } = DatePicker;

interface DashboardToolbarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
  loading: boolean;
  lastUpdated?: string;
  hospitalOptions?: { label: string; value: number }[];
  selectedHospitalOption?: { label: string; value: number } | null;
  hospitalOptionsLoading?: boolean;
  onHospitalSearch: (keyword: string) => void;
  onHospitalChange: (hospitalId: number | undefined) => void;
}

/**
 * 数据看板全局筛选工具栏。
 *
 * 提供医院范围、时间范围筛选及刷新操作。
 * 所有子图表和统计卡使用同一筛选口径。
 */
const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  filters,
  onChange,
  onRefresh,
  loading,
  lastUpdated,
  hospitalOptions = [],
  selectedHospitalOption,
  hospitalOptionsLoading = false,
  onHospitalSearch,
  onHospitalChange,
}) => {
  const handleTimeRangeChange = (value: string | number) => {
    const v = String(value);
    const now = dayjs();
    let startDate: string | undefined;
    const endDate: string = now.format('YYYY-MM-DD');

    switch (v) {
      case 'today':
        startDate = now.format('YYYY-MM-DD');
        break;
      case 'week':
        startDate = now.startOf('week').format('YYYY-MM-DD');
        break;
      case 'month':
        startDate = now.startOf('month').format('YYYY-MM-DD');
        break;
      case '30d':
        startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
        break;
      case '12m':
        startDate = now.subtract(12, 'month').format('YYYY-MM-DD');
        break;
      default:
        break;
    }

    onChange({
      ...filters,
      timeRange: v as DashboardFilters['timeRange'],
      startDate,
      endDate,
    });
  };

  const visibleHospitalOptions =
    selectedHospitalOption &&
    !hospitalOptions.some(
      (option) => option.value === selectedHospitalOption.value,
    )
      ? [selectedHospitalOption, ...hospitalOptions]
      : hospitalOptions;

  const periodText =
    filters.startDate && filters.endDate
      ? `${filters.startDate} 至 ${filters.endDate}`
      : '累计数据';

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Select
          placeholder="全部医院"
          style={{ width: 180 }}
          allowClear
          value={filters.hospitalId}
          onChange={onHospitalChange}
          options={visibleHospitalOptions}
          showSearch
          filterOption={false}
          onSearch={onHospitalSearch}
          onDropdownVisibleChange={(open) => {
            if (open) onHospitalSearch('');
          }}
          loading={hospitalOptionsLoading}
          notFoundContent="暂无医院数据"
          aria-label="医院范围筛选"
        />

        <Segmented
          options={TIME_RANGE_OPTIONS}
          value={filters.timeRange || '12m'}
          onChange={handleTimeRangeChange}
          aria-label="时间范围筛选"
        />

        <RangePicker
          size="small"
          style={{ width: 240 }}
          value={
            filters.startDate && filters.endDate
              ? [dayjs(filters.startDate), dayjs(filters.endDate)]
              : undefined
          }
          disabledDate={(current) => current?.endOf('day').isAfter(dayjs())}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              onChange({
                ...filters,
                timeRange: 'custom',
                startDate: dates[0].format('YYYY-MM-DD'),
                endDate: dates[1].format('YYYY-MM-DD'),
              });
            } else {
              const now = dayjs();
              onChange({
                ...filters,
                timeRange: '12m',
                startDate: now.subtract(12, 'month').format('YYYY-MM-DD'),
                endDate: now.format('YYYY-MM-DD'),
              });
            }
          }}
          aria-label="自定义时间范围"
        />

        <span className={styles.updateTime}>统计区间：{periodText}</span>

        {lastUpdated && (
          <span className={styles.updateTime}>更新时间：{lastUpdated}</span>
        )}
      </div>

      <div className={styles.toolbarRight}>
        <Button
          type="primary"
          icon={<ReloadOutlined spin={loading} />}
          onClick={onRefresh}
          loading={loading}
        >
          刷新
        </Button>
      </div>
    </div>
  );
};

export default DashboardToolbar;
