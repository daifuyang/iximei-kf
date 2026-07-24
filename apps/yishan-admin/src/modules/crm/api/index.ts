import {
  crmCreateCustomer,
  crmDispatchCustomer,
  crmListCustomerStatuses,
  crmListCustomers,
  crmUpdateCustomer,
} from '@/services/generated/crmCustomers';
import {
  crmAddDispatchReply,
  crmGetDispatch,
  crmListDispatchStatuses,
  crmListDispatches,
} from '@/services/generated/crmDispatches';
import {
  crmAssignHospitalAccount,
  crmCreateHospital,
  crmCreateHospitalAccount,
  crmDeleteHospital,
  crmDeleteHospitalAccount,
  crmListHospitalAccounts,
  crmListHospitals,
  crmSearchHospitals,
  crmUpdateHospital,
  crmUpdateHospitalAccount,
} from '@/services/generated/crmHospitals';
import {
  crmAddMemberRemark,
  crmCreateMember,
  crmGetMember,
  crmListMembers,
  crmUpdateMember,
} from '@/services/generated/crmMembers';
import { getSystemRegionTree } from '@/services/generated/systemRegions';
import { getUserList } from '@/services/generated/sysUsers';

export const getRegionTree = (params: object) => getSystemRegionTree(params as never);
export const getUsers = (params: object) => getUserList(params as never);
export const getCustomerStatuses = crmListCustomerStatuses;
export const getDispatchStatuses = crmListDispatchStatuses;
export const getCustomers = (params: object) => crmListCustomers(params as never);
export const createCustomer = (body: object) => crmCreateCustomer(body as never);
export const updateCustomer = (id: number, body: object) => crmUpdateCustomer({ id }, body as never);
export const dispatchCustomer = (id: number, body: object) => crmDispatchCustomer({ id }, body as never);
export const searchHospitals = (params: object) => crmSearchHospitals(params as never);
export const getDispatches = (params: object) => crmListDispatches(params as never);
export const getDispatch = (id: number) => crmGetDispatch({ id });
export const addDispatchReply = (id: number, body: object) => crmAddDispatchReply({ id }, body as never);
export const getHospitals = (params: object) => crmListHospitals(params as never);
export const createHospital = (body: object) => crmCreateHospital(body as never);
export const updateHospital = (id: number, body: object) => crmUpdateHospital({ id }, body as never);
export const deleteHospital = (id: number) => crmDeleteHospital({ id });
export const getHospitalAccounts = (id: number) => crmListHospitalAccounts({ id });
export const createHospitalAccount = (id: number, body: object) => crmCreateHospitalAccount({ id }, body as never);
export const updateHospitalAccount = (id: number, userId: number, body: object) => crmUpdateHospitalAccount({ id, userId }, body as never);
export const deleteHospitalAccount = (id: number, userId: number) => crmDeleteHospitalAccount({ id, userId });
export const assignHospitalAccount = (id: number, body: object) => crmAssignHospitalAccount({ id }, body as never);
export const getMembers = (params: object) => crmListMembers(params as never);
export const createMember = (body: object) => crmCreateMember(body as never);
export const updateMember = (id: number, body: object) => crmUpdateMember({ id }, body as never);
export const getMember = (id: number) => crmGetMember({ id });
export const addMemberRemark = (id: number, body: object) => crmAddMemberRemark({ id }, body as never);
