import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { getHospital } from '@/modules/crm/api';

jest.mock('@umijs/max', () => ({
  useLocation: () => ({ search: '?hospitalId=987' }),
  useModel: () => ({ initialState: { currentUser: { permissions: [] } } }),
}));
jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: any) => <main>{children}</main>,
  ProTable: () => <div>Hospital list</div>,
}));
jest.mock('yishan-tiptap', () => ({ FormEditor: () => null }));
jest.mock('@/components', () => ({ AttachmentMultiSelect: () => null }));
jest.mock('@/utils/attachmentUpload', () => ({}));
jest.mock('@/modules/crm/api', () => ({
  getRegionTree: jest.fn().mockResolvedValue({ success: true, data: [] }),
  getHospital: jest.fn(),
}));

const HospitalPage = require('../index').default;

it('opens the hospital selected by the drilldown URL independently of list pagination', async () => {
  (getHospital as jest.Mock).mockResolvedValue({ success: true, data: { id: 987, hospitalName: 'Target hospital', category: 'oral', status: 1 } });
  render(<HospitalPage />);
  expect(await screen.findByText('Target hospital')).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(getHospital).toHaveBeenCalledWith(987);
});
