import { Col, Row, Statistic } from 'antd';
import React from 'react';
import type {
  HospitalDistributionSelection,
  HospitalOverviewSummary,
} from '../types';

interface Props {
  summary: HospitalOverviewSummary;
  loading?: boolean;
  onSelect: (selection: HospitalDistributionSelection) => void;
}

const kpis: Array<{
  key: keyof HospitalOverviewSummary;
  label: string;
  selection: HospitalDistributionSelection;
}> = [
  { key: 'total', label: '医院总数', selection: {} },
  { key: 'oral', label: '口腔医院', selection: { category: 'oral' } },
  { key: 'plastic', label: '整形医院', selection: { category: 'plastic' } },
  { key: 'unknown', label: '未分类医院', selection: { category: 'unknown' } },
  { key: 'periodNew', label: '本期新增医院', selection: {} },
];

const HospitalOverviewKpis: React.FC<Props> = ({ summary, loading, onSelect }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    {kpis.map((item) => (
      <Col key={item.key} xs={24} sm={12} lg={item.key === 'periodNew' ? 8 : 4}>
        <button
          type="button"
          aria-label={item.label}
          onClick={() => onSelect(item.selection)}
          style={{
            minHeight: 108,
            width: '100%',
            padding: '16px 18px',
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Statistic title={item.label} value={summary[item.key]} loading={loading} suffix="家" />
        </button>
      </Col>
    ))}
  </Row>
);

export default HospitalOverviewKpis;
