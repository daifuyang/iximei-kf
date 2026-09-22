import { Alert, Button, Drawer, Empty, Table } from 'antd';
import { history } from '@umijs/max';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getHospitalOverviewDetails } from '@/modules/crm/api';
import type { HospitalOverviewFilters } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: HospitalOverviewFilters;
}

const categoryLabel: Record<string, string> = {
  oral: '口腔',
  plastic: '整形',
  unknown: '未分类',
};

const HospitalDrilldownDrawer: React.FC<Props> = ({ open, onClose, filters }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!open) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await getHospitalOverviewDetails({ page, pageSize: 10, ...filters });
      if (request !== requestRef.current) return;
      if (!response?.success) throw new Error(response?.message || '加载失败');
      setRows(response.data ?? []);
      setTotal(response.pagination?.total ?? 0);
    } catch (cause) {
      if (request !== requestRef.current) return;
      setError(cause instanceof Error ? cause : new Error('加载失败'));
      setRows([]);
      setTotal(0);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filters, open, page]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Drawer title="医院明细" placement="right" width={720} open={open} onClose={onClose}>
      {error ? (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error.message}
          action={<Button size="small" onClick={load}>重试</Button>}
        />
      ) : rows.length === 0 && !loading ? (
        <Empty description="暂无医院数据" />
      ) : (
        <Table
          loading={loading}
          rowKey="id"
          size="small"
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: 10,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: 'Dispatch', dataIndex: 'dispatchCount', key: 'dispatchCount' },
            { title: 'Arrivals', dataIndex: 'arrivedCount', key: 'arrivedCount' },
            { title: 'Deals', dataIndex: 'dealCount', key: 'dealCount' },
            { title: 'Latest dispatch', dataIndex: 'latestDispatchAt', key: 'latestDispatchAt', render: (value: string | null) => value ?? '-' },
            { title: '医院', dataIndex: 'hospitalName', key: 'hospitalName' },
            {
              title: '类型',
              dataIndex: 'category',
              key: 'category',
              render: (value: string) => categoryLabel[value] ?? '未分类',
            },
            { title: '省', dataIndex: 'provinceName', key: 'provinceName' },
            { title: '市', dataIndex: 'cityName', key: 'cityName' },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (value: number) => (value === 1 ? '启用' : '停用'),
            },
            {
              title: '操作',
              key: 'actions',
              render: (_, record: any) => (
                <Button
                  type="link"
                  onClick={() => {
                    onClose();
                    history.push(`/crm/hospitals?hospitalId=${record.id}`);
                  }}
                >
                  查看详情
                </Button>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
};

export default HospitalDrilldownDrawer;
