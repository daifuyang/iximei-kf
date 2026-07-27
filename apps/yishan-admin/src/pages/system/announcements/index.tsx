import { PageContainer } from '@ant-design/pro-components';
import { Typography } from 'antd';
import React from 'react';

const { Title, Paragraph, Text } = Typography;

/**
 * 系统公告。
 *
 * 纯白底 Typography 排版，文案按用户提供原话维护，不做自行改造。
 * 内容静态维护；后续如需后台可编辑再迁到 sys_option 或独立 sys_announcement 表。
 */
const AnnouncementList: React.FC = () => {
  const baseFontSize = 15;

  return (
    <PageContainer
      header={{
        title: '系统公告',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '32px 40px',
          borderRadius: 4,
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <Typography>
            <Title
              level={2}
              style={{ marginTop: 0, marginBottom: 24, fontSize: 26, fontWeight: 600 }}
            >
              商务联系人
            </Title>

            <Paragraph
              style={{
                fontSize: baseFontSize,
                color: 'rgba(0,0,0,0.85)',
                marginBottom: 28,
              }}
            >
              商务由李严、方柏负责。
            </Paragraph>

            <Paragraph
              style={{
                fontSize: baseFontSize,
                color: 'rgba(0,0,0,0.85)',
                marginBottom: 16,
              }}
            >
              <Text strong style={{ fontSize: 17 }}>
                李严
              </Text>
              <br />
              微信：
              <Text
                code
                copyable={{ tooltips: ['复制', '已复制'] }}
                style={{
                  background: '#f5f5f5',
                  padding: '3px 10px',
                  fontSize: 14,
                  marginLeft: 4,
                }}
              >
                xinaimei98
              </Text>
            </Paragraph>

            <Paragraph
              style={{
                fontSize: baseFontSize,
                color: 'rgba(0,0,0,0.85)',
                marginBottom: 28,
              }}
            >
              <Text strong style={{ fontSize: 17 }}>
                方柏
              </Text>
              <br />
              微信：
              <Text
                code
                copyable={{ tooltips: ['复制', '已复制'] }}
                style={{
                  background: '#f5f5f5',
                  padding: '3px 10px',
                  fontSize: 14,
                  marginLeft: 4,
                }}
              >
                hhzzm31
              </Text>
            </Paragraph>

            <Paragraph
              style={{
                fontSize: baseFontSize,
                color: 'rgba(0,0,0,0.85)',
                marginBottom: 0,
              }}
            >
              对公账户和对私账户可询问商务李严。
            </Paragraph>
          </Typography>
        </div>
      </div>
    </PageContainer>
  );
};

export default AnnouncementList;