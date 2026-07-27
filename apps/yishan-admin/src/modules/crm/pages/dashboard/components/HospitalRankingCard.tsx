import { TrophyOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Empty, Space, Table } from 'antd';
import React from 'react';
import { history } from '@umijs/max';
import type { HospitalRankingItem } from '../types';
import { formatNumber, formatPercent } from '../utils';
import styles from '../index.module.less';

interface HospitalRankingCardProps {
  rankings: HospitalRankingItem[];
  loading?: boolean;
}

/**
 * 医院效率榜。
 *
 * 使用小型表格展示医院排名，前 3 名有奖牌标识。
 * 点击医院名可跳转医院详情。
 *
 * rankings 为空时显示 Empty 图标（垂直居中、无 description）。
 */
const HospitalRankingCard: React.FC<HospitalRankingCardProps> = ({
  rankings,
  loading,
}) => {
  const renderRank = (rank: number) => {
    if (rank <= 3) {
      const medalClass =
        rank === 1
          ? styles.rankingMedalGold
          : rank === 2
            ? styles.rankingMedalSilver
            : styles.rankingMedalBronze;
      return (
        <span className={`${styles.rankingMedal} ${medalClass}`}>
          {rank}
        </span>
      );
    }
    return <span className={styles.rankingNumber}>{rank}</span>;
  };

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 56,
      render: (rank: number) => renderRank(rank),
    },
    {
      title: '医院',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, _record: HospitalRankingItem) => (
        <a
          onClick={(e) => {
            e.stopPropagation();
            history.push('/crm/hospitals');
          }}
          style={{ cursor: 'pointer' }}
        >
          {name}
        </a>
      ),
    },
    {
      title: '派单量',
      dataIndex: 'dispatchCount',
      key: 'dispatchCount',
      width: 80,
      align: 'right' as const,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '到院率',
      dataIndex: 'arrivalRate',
      key: 'arrivalRate',
      width: 72,
      align: 'right' as const,
      render: (v: number | undefined) =>
        v != null ? formatPercent(v) : '--',
    },
    {
      title: '成交率',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      width: 72,
      align: 'right' as const,
      render: (v: number | undefined) =>
        v != null ? formatPercent(v) : '--',
    },
  ];

  return (
    <ProCard
      title={
        <Space size={8}>
          <TrophyOutlined style={{ color: '#1677FF' }} />
          <span>医院效率榜</span>
        </Space>
      }
      loading={loading}
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px 20px 20px' } }}
    >
      {rankings.length === 0 ? (
        <div
          style={{
            minHeight: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无排名数据" />
        </div>
      ) : (
        <Table
          className={styles.rankingTable}
          columns={columns}
          dataSource={rankings.slice(0, 5)}
          rowKey="rank"
          size="small"
          pagination={false}
          showHeader={true}
          style={{ fontSize: 13 }}
        />
      )}
    </ProCard>
  );
};

export default HospitalRankingCard;
