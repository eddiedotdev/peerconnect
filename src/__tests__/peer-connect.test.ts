import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerConnect } from '../core/peer-connect';
import type { PeerConnectionManager } from '../core/connection-manager';
import type { PeerMessage } from '../core/types';

describe('PeerSync', () => {
  let mockManager: PeerConnectionManager;
  let peerSync: PeerConnect;
  const roomId = 'test-room';

  beforeEach(() => {
    mockManager = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      createRoom: vi.fn(),
      isConnected: vi.fn(() => true),
      getConnectionInfo: vi.fn(() => new Map()),
      connections: new Map(),
    } as unknown as PeerConnectionManager;

    peerSync = new PeerConnect({
      roomId,
      manager: mockManager,
    });
  });

  it('should initialize with provided options', () => {
    expect(peerSync.roomId).toBe(roomId);
    expect(peerSync['manager']).toBe(mockManager);
  });

  it('should handle connect successfully', async () => {
    const onConnect = vi.fn();
    peerSync.on('connect', onConnect);

    await peerSync.connect();

    expect(mockManager.createRoom).toHaveBeenCalledWith(roomId);
    expect(onConnect).toHaveBeenCalled();
  });

  it('should handle connect error', async () => {
    const error = new Error('Connection failed');
    vi.mocked(mockManager.createRoom).mockRejectedValue(error);

    const onError = vi.fn();
    peerSync.on('error', onError);

    await expect(peerSync.connect()).rejects.toThrow('Connection failed');
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should handle disconnect', async () => {
    const onDisconnect = vi.fn();
    peerSync.on('disconnect', onDisconnect);

    await peerSync.disconnect();

    expect(mockManager.disconnect).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('should handle sending messages', async () => {
    const message: PeerMessage = {
      type: 'test',
      payload: 'hello',
    };

    await peerSync.sendMessage(message);

    // Update expectation to match the actual call
    expect(mockManager.sendMessage).toHaveBeenCalledWith(message, undefined);
  });

  it('should handle callbacks for peer events', () => {
    const onPeerJoin = vi.fn();
    const onPeerLeave = vi.fn();
    const peerId = 'test-peer';

    peerSync.on('peerJoin', onPeerJoin);
    peerSync.on('peerLeave', onPeerLeave);

    // Simulate the manager emitting events
    const managerCallbacks = vi.mocked(mockManager.on).mock.calls;
    const joinCallback = managerCallbacks.find(
      ([event]) => event === 'peerJoin'
    )?.[1];
    const leaveCallback = managerCallbacks.find(
      ([event]) => event === 'peerLeave'
    )?.[1];

    // Call the callbacks directly
    joinCallback?.(peerId);
    leaveCallback?.(peerId);

    expect(onPeerJoin).toHaveBeenCalledWith(peerId);
    expect(onPeerLeave).toHaveBeenCalledWith(peerId);
  });

  it('should get peers and room information', () => {
    const mockConnections = new Map([
      ['host', {}],
      ['peer1', {}],
      ['peer2', {}],
    ]);
    // @ts-expect-error
    mockManager.connections = mockConnections;

    expect(peerSync.roomId).toBe(roomId);
    expect(peerSync.isConnected).toBe(true);
    expect(peerSync.peers).toEqual(['peer1', 'peer2']);
  });
});
