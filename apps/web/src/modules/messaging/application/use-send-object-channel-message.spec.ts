/**
 * @jest-environment jsdom
 */
import { TextEncoder } from 'node:util';

import { renderHook, act } from '@testing-library/react';

import { useSendObjectChannelMessage } from './use-send-object-channel-message';

// jsdom has no TextEncoder; the custom_json size check measures UTF-8 bytes with it.
Object.assign(globalThis, { TextEncoder });

/** Past the 8192-byte Hive `custom_json` cap on its own. */
const OVERSIZED_BODY_LENGTH = 9_000;

const mockBroadcast = jest.fn();
const mockAwaitTrx = jest.fn();
const mockRefresh = jest.fn();

jest.mock('@/config/odl-network-provider', () => ({
  useOslCustomJsonId: () => 'osl-testnet',
}));

jest.mock('@/modules/auth', () => ({
  getWalletFacade: () => ({
    broadcast: mockBroadcast,
  }),
  useHydrateWalletProvider: jest.fn(),
}));

jest.mock('@/modules/notifications', () => ({
  awaitTrxConfirmation: (...args: unknown[]) => mockAwaitTrx(...args),
}));

jest.mock('@/shared/infrastructure/query/refresh-after-broadcast', () => ({
  refreshAfterBroadcast: async (...args: unknown[]) => {
    const fn = args[1] as (() => Promise<void>) | undefined;
    if (fn) {
      await fn();
    }
    return mockRefresh(...args);
  },
}));

jest.mock(
  '@/shared/infrastructure/query/revalidate-after-broadcast.server',
  () => ({
    revalidateObjectAfterBroadcast: jest.fn().mockResolvedValue(undefined),
  }),
);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

describe('useSendObjectChannelMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBroadcast.mockResolvedValue({ transactionId: 'tx-1' });
    mockAwaitTrx.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
  });

  it('uses two operations when channel is missing', async () => {
    const { result } = renderHook(() =>
      useSendObjectChannelMessage({
        viewerUsername: 'alice',
        objectId: 'obj-1',
        objectName: 'Shop',
        channelId: 'obj-ch-obj-1',
        channelExists: false,
      }),
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.sendMessage('hello');
    });

    expect(ok).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({ id: 'osl-testnet' }),
          expect.objectContaining({ id: 'osl-testnet' }),
        ]),
      }),
    );
    expect(mockBroadcast.mock.calls[0]?.[0]?.operations).toHaveLength(2);
    expect(result.current.channelExists).toBe(true);
  });

  it('uses one operation when channel exists', async () => {
    const { result } = renderHook(() =>
      useSendObjectChannelMessage({
        viewerUsername: 'alice',
        objectId: 'obj-1',
        objectName: 'Shop',
        channelId: 'obj-ch-obj-1',
        channelExists: true,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(mockBroadcast.mock.calls[0]?.[0]?.operations).toHaveLength(1);
  });

  it('does not broadcast when body is empty', async () => {
    const { result } = renderHook(() =>
      useSendObjectChannelMessage({
        viewerUsername: 'alice',
        objectId: 'obj-1',
        objectName: 'Shop',
        channelId: 'obj-ch-obj-1',
        channelExists: false,
      }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.sendMessage('   ');
    });

    expect(ok).toBe(false);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('keeps channelExists false when bootstrap fails', async () => {
    mockBroadcast.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() =>
      useSendObjectChannelMessage({
        viewerUsername: 'alice',
        objectId: 'obj-1',
        objectName: 'Shop',
        channelId: 'obj-ch-obj-1',
        channelExists: false,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.channelExists).toBe(false);
  });

  it('refuses a body over the custom_json size cap without broadcasting', async () => {
    const { result } = renderHook(() =>
      useSendObjectChannelMessage({
        viewerUsername: 'alice',
        objectId: 'obj-1',
        objectName: 'Shop',
        channelId: 'obj-ch-obj-1',
        channelExists: true,
      }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.sendMessage('x'.repeat(OVERSIZED_BODY_LENGTH));
    });

    expect(ok).toBe(false);
    expect(mockBroadcast).not.toHaveBeenCalled();
    expect(result.current.bodyTooLong).toBe(true);

    await act(async () => {
      ok = await result.current.sendMessage('hello');
    });

    expect(ok).toBe(true);
    expect(result.current.bodyTooLong).toBe(false);
  });
});
