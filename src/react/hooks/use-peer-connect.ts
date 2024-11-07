import { useMutation } from '@tanstack/react-query';
import type { PeerMessage } from '../../core/types';
import { usePeerSyncContext } from '../components/peer-sync-context';

interface StoredMessage extends PeerMessage {
  peerId?: string;
  timestamp: number;
}

export const PEER_CONNECT_KEYS = {
  connection: ['peerSync', 'connection'] as const,
  messages: ['peerSync', 'messages'] as const,
  peers: ['peerSync', 'peers'] as const,
  room: ['peerSync', 'room'] as const,
  error: ['peerSync', 'error'] as const,
  connectionState: ['peerSync', 'connectionState'] as const,
} as const;

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
}

export function usePeerConnect() {
  const { manager, queryClient } = usePeerSyncContext();

  const initConnection = useMutation({
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
