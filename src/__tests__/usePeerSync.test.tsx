import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PEER_SYNC_KEYS, usePeerSync } from '../react/usePeerSync';
import type { PeerMessage } from '@/core/types';
import { PeerConnectionManager } from '@/core/PeerConnectionManager';
import type { Mock } from 'vitest';

// Add mock for PeerConnectionManager
vi.mock('@/core/PeerConnectionManager', () => ({
  PeerConnectionManager: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe('usePeerSync', () => {
  let queryClient: QueryClient;
  let mockManager: Partial<PeerConnectionManager> & {
    on: Mock;
    off: Mock;
    emit: Mock;
    joinRoom: Mock;
    leaveRoom: Mock;
    disconnect: Mock;
    sendMessage: Mock;
    isConnected: Mock;
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    // Reset mock before each test
    vi.clearAllMocks();

    // Create mock manager with all methods as spies
    mockManager = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      isConnected: vi.fn(() => true),
    };

    vi.mocked(PeerConnectionManager).mockImplementation(
      () => mockManager as unknown as PeerConnectionManager
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => usePeerSync({ roomId: 'test-room' }), {
      wrapper,
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.peers).toEqual([]);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle sending messages', async () => {
    const { result } = renderHook(() => usePeerSync({ roomId: 'test-room' }), {
      wrapper,
    });

    // Wait for the manager query to complete
    await waitFor(() => {
      expect(result.current.peerManager).toBeDefined();
    });

    // Set initial connection state
    queryClient.setQueryData(PEER_SYNC_KEYS.connection, mockManager);

    // Mock isConnected to return true
    mockManager.isConnected.mockReturnValue(true);

    // Connect and wait for it to complete
    await result.current.connect();

    const message: PeerMessage = {
      type: 'test',
      payload: 'hello',
    };

    // Mock successful send
    mockManager.sendMessage.mockResolvedValue(undefined);

    // Wait for mutation to complete
    await result.current.sendMessage(message);

    expect(mockManager.sendMessage).toHaveBeenCalledWith(message);
  });

  it('should handle receiving messages', async () => {
    renderHook(() => usePeerSync({ roomId: 'test-room' }), {
      wrapper,
    });

    // Set initial state
    queryClient.setQueryData([PEER_SYNC_KEYS.connection], mockManager);
    queryClient.setQueryData([PEER_SYNC_KEYS.messages], []);

    // Simulate receiving a message by updating the messages directly
    const incomingMessage: PeerMessage = {
      type: 'test',
      payload: 'incoming message',
    };

    queryClient.setQueryData(
      [PEER_SYNC_KEYS.messages],
      [{ ...incomingMessage, peerId: 'test-peer' }]
    );

    await waitFor(() => {
      const messages = queryClient.getQueryData<PeerMessage[]>([
        PEER_SYNC_KEYS.messages,
      ]);
      expect(messages?.[0]).toMatchObject({
        ...incomingMessage,
        peerId: 'test-peer',
      });
    });
  });

  it('should update peers list on peer events', async () => {
    renderHook(() => usePeerSync({ roomId: 'test-room' }), {
      wrapper,
    });

    // Set initial state
    queryClient.setQueryData([PEER_SYNC_KEYS.connection], mockManager);
    queryClient.setQueryData([PEER_SYNC_KEYS.peers], []);

    // Simulate peer join by updating peers directly
    queryClient.setQueryData([PEER_SYNC_KEYS.peers], ['test-peer']);

    await waitFor(() => {
      const peers = queryClient.getQueryData<string[]>([PEER_SYNC_KEYS.peers]);
      expect(peers).toContain('test-peer');
    });
  });

  it('should handle room changes', async () => {
    const { result, rerender } = renderHook(
      () => usePeerSync({ roomId: 'test-room' }),
      {
        wrapper,
      }
    );

    // Wait for the manager query to complete
    await waitFor(() => {
      expect(result.current.peerManager).toBeDefined();
    });

    // Set initial states
    queryClient.setQueryData(PEER_SYNC_KEYS.connection, mockManager);
    queryClient.setQueryData(PEER_SYNC_KEYS.room, 'test-room');

    // Connect and wait for it to complete
    await result.current.connect();

    // Wait for state updates
    await waitFor(() => {
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.currentRoom).toBe('test-room');
    });

    await result.current.disconnect();

    // Force rerender after disconnect
    rerender();

    await waitFor(
      () => {
        expect(result.current.currentRoom).toBeNull();
      },
      { timeout: 2000 }
    );
  });
});
