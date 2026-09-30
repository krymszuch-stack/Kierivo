import { describe, expect, it, vi } from 'vitest';
import { copyTextAndNotifySuccess } from '../copyTextAndNotifySuccess';

describe('copyTextAndNotifySuccess', () => {
  it('zgłasza sukces dopiero po zapisaniu tekstu do schowka', async () => {
    const order: string[] = [];
    const clipboard = {
      writeText: vi.fn(async () => {
        order.push('clipboard');
      }),
    };

    await copyTextAndNotifySuccess('CV testowe', () => order.push('success'), clipboard);

    expect(clipboard.writeText).toHaveBeenCalledWith('CV testowe');
    expect(order).toEqual(['clipboard', 'success']);
  });

  it('nie wywołuje sukcesu, gdy przeglądarka odrzuci zapis schowka', async () => {
    const onSuccess = vi.fn();
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('Odmowa dostępu')) };

    await expect(copyTextAndNotifySuccess('CV testowe', onSuccess, clipboard))
      .rejects.toThrow('Odmowa dostępu');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
