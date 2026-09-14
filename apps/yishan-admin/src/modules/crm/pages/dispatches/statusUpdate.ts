type UpdateDispatch = (id: number, body: { statusId: number }) => Promise<any>;

type PersistStatusChangeArgs = {
  id: number;
  previousStatusId?: number;
  statusId: number;
  update: UpdateDispatch;
  refresh: (dispatch: any) => Promise<void> | void;
};

export async function persistDispatchStatusChange({
  id,
  previousStatusId,
  statusId,
  update,
  refresh,
}: PersistStatusChangeArgs): Promise<boolean> {
  if (statusId === previousStatusId) return false;
  const res = await update(id, { statusId });
  if (!res?.success) {
    throw new Error(res?.message || '状态更新失败，请稍后重试');
  }
  await refresh(res.data);
  return true;
}
