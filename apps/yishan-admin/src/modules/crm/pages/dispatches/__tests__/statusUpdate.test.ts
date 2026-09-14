import { persistDispatchStatusChange } from '../statusUpdate';

describe('persistDispatchStatusChange', () => {
  it('persists a changed status and refreshes the dispatch list', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ success: true, data: { id: 7, statusId: 3 } });
    const refresh = jest.fn().mockResolvedValue(undefined);

    await persistDispatchStatusChange({
      id: 7,
      previousStatusId: 2,
      statusId: 3,
      update,
      refresh,
    });

    expect(update).toHaveBeenCalledWith(7, { statusId: 3 });
    expect(refresh).toHaveBeenCalledWith({ id: 7, statusId: 3 });
  });
});
