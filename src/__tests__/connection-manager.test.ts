import { describe, it, expect, beforeEach } from 'vitest';
import { PeerConnectionManager } from '@/core/connection-manager';
import type { PeerMessage } from '@/core/types';

describe('PeerConnectionManager', () => {
  let manager: PeerConnectionManager;
  const roomId = 'test-room';

  beforeEach(() => {
    manager = new PeerConnectionManager({ roomId });
  });

  it('should create a new peer connection', async () => {
    // Create a promise that resolves when roomJoined is emitted
    const roomJoinedPromise = new Promise<void>((resolve) => {
      manager.once('roomJoined', () => resolve());
    });

    // Create the room
    await manager.createRoom(roomId);

    // Wait for room joined event
    await roomJoinedPromise;

    expect(manager['currentRoomId']).toBe(roomId);
  });

  it('should send messages to peers', async () => {
    const roomJoinedPromise = new Promise<void>((resolve) => {
      manager.once('roomJoined', () => resolve());
    });

    await manager.createRoom(roomId);
    await roomJoinedPromise;

    const message: PeerMessage = {
      type: 'test',
      payload: 'hello',
    };
    await expect(manager.sendMessage(message)).resolves.not.toThrow();
  });

  it('should broadcast messages to all peers', async () => {
    await manager.createRoom(roomId);
    const message: PeerMessage = {
      type: 'test',
      payload: 'broadcast',
    };
    await expect(manager.sendMessage(message)).resolves.not.toThrow();
  });

  it('should handle disconnection', async () => {
    await createAndWaitForRoom();
    manager.disconnect();
    expect(manager['currentRoomId']).toBeNull();
  });

  it('should handle room lifecycle', async () => {
    await createAndWaitForRoom();
    expect(manager['currentRoomId']).toBe(roomId);
    manager.leaveRoom();
    expect(manager['currentRoomId']).toBeNull();
  });

  it('should require room creation/join before creating connections', async () => {
    const peerId = 'test-peer';
    await expect(manager.createPeerConnection(peerId)).rejects.toThrow();
  });

  it('should handle peer events', async () => {
    const events: string[] = [];
    manager.on('peerJoin', () => events.push('join'));
    manager.on('peerLeave', () => events.push('leave'));

    // Create room
    await manager.createRoom(roomId);

    // Manually create and setup a peer connection
    const peerId = 'test-peer';
    const connection = new RTCPeerConnection();
    const dataChannel = connection.createDataChannel('test');

    // Add the connection to the manager
    manager['connections'].set(peerId, {
      connection,
      dataChannel,
      state: 'connected',
      iceConnectionState: 'connected',
    });

    // Manually trigger the peer join
    manager.emit('peerJoin', peerId);

    // Check join event
    expect(events).toContain('join');

    // Manually trigger the peer leave
    manager.emit('peerLeave', peerId);

    // Check leave event
    expect(events).toContain('leave');
  });

  it('should clean up connections when leaving room', async () => {
    await createAndWaitForRoom();
    manager.leaveRoom();
    expect(manager['connections'].size).toBe(0);
  });

  it('should handle messages only when in a room', async () => {
    const peerId = 'test-peer';
    const message: PeerMessage = {
      type: 'test',
      payload: 'hello',
    };

    // Create room and wait for connection
    const roomJoinedPromise = new Promise<void>((resolve) => {
      manager.once('roomJoined', () => resolve());
    });

    await manager.createRoom(roomId);
    await roomJoinedPromise;

    // Create peer connection and wait for it to be ready
    await manager.createPeerConnection(peerId);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should be able to send message when connected
    await expect(manager.sendMessage(message, 'host')).resolves.not.toThrow();

    // Leave room
    manager.leaveRoom();

    // Should throw when trying to send message without being in a room
    await expect(manager.sendMessage(message, peerId)).rejects.toThrow(
      'Not connected to any room'
    );
  });

  const createAndWaitForRoom = async () => {
    const roomJoinedPromise = new Promise<void>((resolve) => {
      manager.once('roomJoined', () => resolve());
    });
    await manager.createRoom(roomId);
    await roomJoinedPromise;
  };
});
