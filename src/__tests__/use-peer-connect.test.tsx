import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PeerMessage } from '@/core/types';
import { PeerConnectionManager } from '@/core/connection-manager';
import type { Mock } from 'vitest';
import {
  useRoom,
  PeerSyncProvider,
  PEER_CONNECT_KEYS,
  usePeerConnect,
} from '@/react';

// Add mock for PeerConnectionManager
vi.mock('@/core/connection-manager', () => ({
  PeerConnectionManager: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn(() => true),
    connections: {},
    currentRoomId: null,
    iceServers: [],
    isHost: false,
    peerId: 'mock-peer-id',
    roomId: null,
    signalingServer: null,
    socket: null,
    state: 'disconnected',
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
    // @ts-expect-error
    mockManager = vi.mocked(
      PeerConnectionManager
    )() as unknown as typeof mockManager;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PeerSyncProvider options={{ roomId: 'test-room' }}>
        {children}
      </PeerSyncProvider>
    </QueryClientProvider>
  );

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => usePeerConnect(), {
      wrapper,
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.peers).toEqual([]);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle sending messages', async () => {
    const setRoomId = vi.fn();

    // Create test manager before rendering
    const testManager = {
      on: vi.fn((event, callback) => {
        console.log('Event registered:', event);
        if (event === 'connectionStateChange') {
          callback({ dataChannelState: 'open', state: 'connected' });
        }
      }),
      off: vi.fn(),
      emit: vi.fn(),
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn().mockImplementation(async (msg) => {
        console.log('sendMessage called with:', msg);
        return Promise.resolve();
      }),
      isConnected: vi.fn(() => true),
      getConnectionInfo: vi.fn(),
      createRoom: vi.fn(),
      connectWithInfo: vi.fn(),
      handleIceCandidate: vi.fn(),
      connections: {},
      currentRoomId: 'test-room',
      iceServers: [],
      isHost: false,
      peerId: 'mock-peer-id',
      roomId: 'test-room',
      signalingServer: null,
      socket: null,
      state: 'connected',
    } as unknown as PeerConnectionManager;

    // Mock the PeerConnectionManager constructor
    vi.mocked(PeerConnectionManager).mockImplementation(() => testManager);

    const { result } = renderHook(() => useRoom('test-room', setRoomId), {
      wrapper,
    });

    // Wait for initial render and connection
    await waitFor(() => {
      expect(result.current[0].connectionStatus).toBe('connected');
    });

    console.log('Room state:', result.current[0]);
    console.log('Room actions:', result.current[1]);
    // @ts-expect-error
    console.log('Manager from hook:', result.current[1].peerManager);
    console.log('Test manager:', testManager);

    const message = 'hello';

    try {
      // First, send the message
      await result.current[1].sendMessage(message);
      console.log('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
    }

    // Log the mock calls
    // @ts-expect-error
    console.log('sendMessage mock calls:', testManager.sendMessage.mock.calls);

    // Then verify it was sent with the correct format
    expect(testManager.sendMessage).toHaveBeenCalledWith({
      type: 'chat',
      payload: message,
    });
  });

  it('should handle receiving messages', async () => {
    renderHook(() => usePeerConnect(), {
      wrapper,
    });

    // Set initial state
    queryClient.setQueryData([PEER_CONNECT_KEYS.connection], mockManager);
    queryClient.setQueryData([PEER_CONNECT_KEYS.messages], []);

    // Simulate receiving a message by updating the messages directly
    const incomingMessage: PeerMessage = {
      type: 'test',
      payload: 'incoming message',
    };

    queryClient.setQueryData(
      [PEER_CONNECT_KEYS.messages],
      [{ ...incomingMessage, peerId: 'test-peer' }]
    );

    await waitFor(() => {
      const messages = queryClient.getQueryData<PeerMessage[]>([
        PEER_CONNECT_KEYS.messages,
      ]);
      expect(messages?.[0]).toMatchObject({
        ...incomingMessage,
        peerId: 'test-peer',
      });
    });
  });

  it('should update peers list on peer events', async () => {
    renderHook(() => usePeerConnect(), {
      wrapper,
    });

    // Set initial state
    queryClient.setQueryData([PEER_CONNECT_KEYS.connection], mockManager);
    queryClient.setQueryData([PEER_CONNECT_KEYS.peers], []);

    // Simulate peer join by updating peers directly
    queryClient.setQueryData([PEER_CONNECT_KEYS.peers], ['test-peer']);

    await waitFor(() => {
      const peers = queryClient.getQueryData<string[]>([
        PEER_CONNECT_KEYS.peers,
      ]);
      expect(peers).toContain('test-peer');
    });
  });

  it('should handle room changes', async () => {
    const { result, rerender } = renderHook(() => usePeerConnect(), {
      wrapper,
    });

    // Wait for the manager query to complete
    await waitFor(() => {
      expect(result.current.peerManager).toBeDefined();
    });

    // Set initial states
    queryClient.setQueryData(PEER_CONNECT_KEYS.connection, mockManager);
    queryClient.setQueryData(PEER_CONNECT_KEYS.room, 'test-room');

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
