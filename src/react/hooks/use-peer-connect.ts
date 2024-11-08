'use client';

import { useMutation } from '@tanstack/react-query';
import type { PeerMessage } from '../../core/types';
import { usePeerSyncContext } from '../components/peer-connect-context';

/**
 * Extended message type that includes peer ID and timestamp.
 * @interface StoredMessage
 * @extends {PeerMessage}
 */
interface StoredMessage extends PeerMessage {
  /** ID of the peer who sent the message */
  peerId?: string;
  /** Timestamp when the message was received */
  timestamp: number;
}

/**
 * Query keys used for React Query cache management.
 * @constant PEER_CONNECT_KEYS
 */
export const PEER_CONNECT_KEYS = {
  /** Key for peer connection state */
  connection: ['peerSync', 'connection'] as const,
  /** Key for message history */
  messages: ['peerSync', 'messages'] as const,
  /** Key for connected peers list */
  peers: ['peerSync', 'peers'] as const,
  /** Key for room information */
  room: ['peerSync', 'room'] as const,
  /** Key for error state */
  error: ['peerSync', 'error'] as const,
  /** Key for connection state */
  connectionState: ['peerSync', 'connectionState'] as const,
} as const;

/**
 * Connection state interface for tracking peer connection status.
 * @interface ConnectionState
 */
export interface ConnectionState {
  /** Whether there is an active peer connection */
  isConnected: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Any error that occurred during connection */
  error: Error | null;
}

/**
 * Hook for managing peer-to-peer connections and messaging.
 * @returns {Object} Object containing connection state and methods
 * @property {Function} connect - Async function to initialize and establish peer connection
 * @property {Function} disconnect - Async function to close peer connection and clean up state
 * @property {Function} sendMessage - Async function to send message to connected peers
 * @property {StoredMessage[]} messages - Array of received messages with metadata
 * @property {string[]} peers - Array of connected peer IDs
 * @property {string | null} currentRoom - Current room ID or null if not in a room
 * @property {boolean} isConnecting - Whether a connection attempt is in progress
 * @property {boolean} isConnected - Whether currently connected to peers
 * @property {Error | null} error - Any error that occurred during connection or sending
 * @property {PeerManager} peerManager - Reference to the underlying PeerManager instance
 */
export function usePeerConnect() {
  const { manager, queryClient } = usePeerSyncContext();

  const initConnection = useMutation({
    /**
     * Initializes peer connection and sets up event listeners.
     * @async
     * @returns {Promise<PeerManager>} The initialized PeerManager instance
     * @throws {Error} If connection initialization fails
     */
    mutationFn: async () => {
      manager.on('message', (message: PeerMessage, peerId: string) => {
        queryClient.setQueryData<StoredMessage[]>(
          PEER_CONNECT_KEYS.messages,
          (old = []) => [
            ...old,
            {
              ...message,
              peerId,
              timestamp: Date.now(),
            },
          ]
        );
      });

      manager.on('peerJoin', (peerId: string) => {
        queryClient.setQueryData<string[]>(
          PEER_CONNECT_KEYS.peers,
          (old = []) => [...old, peerId]
        );
      });

      manager.on('peerLeave', (peerId: string) => {
        queryClient.setQueryData<string[]>(
          PEER_CONNECT_KEYS.peers,
          (old = []) => old.filter((id) => id !== peerId)
        );
      });

      await manager.joinRoom(manager.options.roomId);
      queryClient.setQueryData(PEER_CONNECT_KEYS.room, manager.options.roomId);

      return manager;
    },
  });

  const sendMessage = useMutation({
    /**
     * Sends a message to all connected peers.
     * @async
     * @param {PeerMessage} message - Message to send
     * @returns {Promise<void>}
     * @throws {Error} If not connected or sending fails
     */
    mutationFn: async (message: PeerMessage) => {
      if (!manager.isConnected()) {
        throw new Error('Not connected to peer');
      }

      await manager.sendMessage(message);
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      queryClient.setQueryData(
        PEER_CONNECT_KEYS.error,
        error instanceof Error ? error.message : 'Failed to send message'
      );
    },
  });

  const disconnect = useMutation({
    /**
     * Disconnects from all peers and cleans up connection state.
     * @async
     * @returns {Promise<void>}
     */
    mutationFn: async () => {
      console.log('Starting disconnect...');
      manager.disconnect();
      console.log('Manager disconnected');

      // Reset all queries
      await queryClient.resetQueries({ queryKey: PEER_CONNECT_KEYS.room });
      await queryClient.resetQueries({ queryKey: PEER_CONNECT_KEYS.messages });
      await queryClient.resetQueries({ queryKey: PEER_CONNECT_KEYS.peers });
      queryClient.removeQueries({ queryKey: PEER_CONNECT_KEYS.connection });

      console.log('State cleared');
    },
    onSuccess: () => {
      // Force update after mutation succeeds
      queryClient.setQueryData(PEER_CONNECT_KEYS.room, null);
    },
  });

  const messages =
    queryClient.getQueryData<StoredMessage[]>(PEER_CONNECT_KEYS.messages) || [];
  const peers =
    queryClient.getQueryData<string[]>(PEER_CONNECT_KEYS.peers) || [];
  const room =
    queryClient.getQueryData<string | null>(PEER_CONNECT_KEYS.room) || null;

  return {
    connect: initConnection.mutateAsync,
    disconnect: disconnect.mutateAsync,
    sendMessage: sendMessage.mutateAsync,
    messages: messages,
    peers: peers,
    currentRoom: room,
    isConnecting: initConnection.isPending,
    isConnected: manager.isConnected(),
    error: initConnection.error || sendMessage.error,
    peerManager: manager,
  };
}
