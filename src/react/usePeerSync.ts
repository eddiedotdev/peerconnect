import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PeerConnectionManager } from '../core/PeerConnectionManager';
import type { PeerMessage, PeerSyncOptions } from '../core/types';

interface StoredMessage extends PeerMessage {
  peerId?: string;
  timestamp: number;
}

export const PEER_SYNC_KEYS = {
  connection: ['peerSync', 'connection'] as const,
  messages: ['peerSync', 'messages'] as const,
  peers: ['peerSync', 'peers'] as const,
  room: ['peerSync', 'room'] as const,
  error: ['peerSync', 'error'] as const,
} as const;

export function usePeerSync(options: PeerSyncOptions) {
  const queryClient = useQueryClient();

  // Single manager instance
  const manager = useQuery({
    queryKey: PEER_SYNC_KEYS.connection,
    queryFn: () => new PeerConnectionManager(options),
    staleTime: Infinity,
  });

  const initConnection = useMutation({
    mutationFn: async () => {
      const currentManager = manager.data;
      if (!currentManager) throw new Error('Manager not initialized');

      currentManager.on('message', (message: PeerMessage, peerId: string) => {
        queryClient.setQueryData<StoredMessage[]>(
          PEER_SYNC_KEYS.messages,
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

      currentManager.on('peerJoin', (peerId: string) => {
        queryClient.setQueryData<string[]>(PEER_SYNC_KEYS.peers, (old = []) => [
          ...old,
          peerId,
        ]);
      });

      currentManager.on('peerLeave', (peerId: string) => {
        queryClient.setQueryData<string[]>(PEER_SYNC_KEYS.peers, (old = []) =>
          old.filter((id) => id !== peerId)
        );
      });

      await currentManager.joinRoom(options.roomId);
      queryClient.setQueryData(PEER_SYNC_KEYS.room, options.roomId);

      return currentManager;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (message: PeerMessage) => {
      const currentManager = manager.data;
      if (!currentManager) {
        throw new Error('Manager not initialized');
      }

      if (!currentManager.isConnected()) {
        throw new Error('Not connected to peer');
      }

      await currentManager.sendMessage(message);
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      queryClient.setQueryData(
        PEER_SYNC_KEYS.error,
        error instanceof Error ? error.message : 'Failed to send message'
      );
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      console.log('Starting disconnect...');
      const currentManager = manager.data;
      if (currentManager) {
        await currentManager.disconnect();
        console.log('Manager disconnected');

        // Reset all queries
        await queryClient.resetQueries({ queryKey: PEER_SYNC_KEYS.room });
        await queryClient.resetQueries({ queryKey: PEER_SYNC_KEYS.messages });
        await queryClient.resetQueries({ queryKey: PEER_SYNC_KEYS.peers });
        queryClient.removeQueries({ queryKey: PEER_SYNC_KEYS.connection });

        console.log('State cleared');
      }
    },
    onSuccess: () => {
      // Force update after mutation succeeds
      queryClient.setQueryData(PEER_SYNC_KEYS.room, null);
    },
  });

  const messages = useQuery<StoredMessage[]>({
    queryKey: PEER_SYNC_KEYS.messages,
    initialData: [],
  });

  const peers = useQuery<string[]>({
    queryKey: PEER_SYNC_KEYS.peers,
    initialData: [],
  });

  const room = useQuery<string | null>({
    queryKey: PEER_SYNC_KEYS.room,
    initialData: null,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  return {
    connect: initConnection.mutateAsync,
    disconnect: disconnect.mutateAsync,
    sendMessage: sendMessage.mutateAsync,
    messages: messages.data || [],
    peers: peers.data || [],
    currentRoom: room.data,
    isConnecting: initConnection.isPending,
    error: initConnection.error || sendMessage.error,
    peerManager: manager.data,
  };
}
