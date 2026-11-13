import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { getDefaultSource, saveDefaultSource } from '@/lib/default-source';

import DefaultSourceDialog from './DefaultSourceDialog';

const originalFetch = global.fetch;
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [
      { key: 'a', name: 'A源' },
      { key: 'b', name: 'B源' },
    ],
  })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('saving a selected default is explicit, and cancel does not save a draft', async () => {
  const close = jest.fn();
  const view = render(<DefaultSourceDialog onClose={close} />);
  fireEvent.click(await screen.findByLabelText(/B源/));
  expect(getDefaultSource()).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByText('保存设置'));
  });
  expect(getDefaultSource()).toEqual({ key: 'b', name: 'B源' });
  await waitFor(() => expect(close).toHaveBeenCalled());
  view.unmount();
  render(<DefaultSourceDialog onClose={close} />);
  fireEvent.click(await screen.findByLabelText(/A源/));
  fireEvent.click(screen.getByText('取消'));
  expect(getDefaultSource()?.key).toBe('b');
});

test('a default removed from configuration is reported instead of silently overwritten', async () => {
  saveDefaultSource({ key: 'removed', name: '已移除源' });
  render(<DefaultSourceDialog onClose={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '之前设置的源已不可用'
  );
  expect(screen.getByText('保存设置')).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/不设置默认源/));
  await act(async () => {
    fireEvent.click(screen.getByText('保存设置'));
  });
  expect(getDefaultSource()).toBeNull();
});

test('interface latency appears automatically without changing the selected default', async () => {
  global.fetch = jest.fn(async (path) => ({
    ok: true,
    json: async () =>
      String(path).includes('service-status')
        ? {
            supported: true,
            sources: [
              { key: 'a', status: 'available', latencyMs: 100 },
              { key: 'b', status: 'available', latencyMs: 900 },
            ],
          }
        : [
            { key: 'a', name: 'A源' },
            { key: 'b', name: 'B源' },
          ],
  })) as unknown as typeof fetch;
  saveDefaultSource({ key: 'b', name: 'B源' });
  render(<DefaultSourceDialog onClose={jest.fn()} />);
  expect(await screen.findByLabelText(/A源.*100 ms.*最快/)).not.toBeChecked();
  expect(screen.getByLabelText(/B源.*900 ms/)).toBeChecked();
  expect(getDefaultSource()?.key).toBe('b');
});
