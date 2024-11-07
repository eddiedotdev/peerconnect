import { useState, useEffect } from 'react';
import { usePeerConnect } from '../hooks/use-peer-connect';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface RoomState {
  connectionInfo: string | null;
  isGettingInfo: boolean;
  connectionStatus: ConnectionStatus;
  messages: Array<{ peerId: string; payload: any }>;
  peers: string[];
  isConnecting: boolean;
}

export interface RoomActions {
  leaveRoom: () => Promise<void>;
  copyConnectionInfo: () => Promise<void>;
  sendMessage: (message: any) => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoom: (connectionInfo: string) => Promise<void>;
}

export function useRoom(
  roomId: string | null,
  setRoomId: (id: string | null) => void
): [RoomState, RoomActions] {
  const [connectionInfo, setConnectionInfo] = useState<string | null>(null);
  const [isGettingInfo, setIsGettingInfo] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');

  const {
    disconnect,
    sendMessage,
    messages,
    peers,
    isConnecting,
    peerManager,
  } = usePeerConnect();

  useEffect(() => {
    if (!peerManager || !roomId) {
      setConnectionStatus('disconnected');
      return;
    }

    const handleConnectionStateChange = ({ dataChannelState, state }: any) => {
      if (dataChannelState === 'open' || state === 'connected') {
        setConnectionStatus('connected');
      } else if (state === 'disconnected') {
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('connecting');
      }
    };

    peerManager.on('connectionStateChange', handleConnectionStateChange);
    setConnectionStatus(peerManager.isConnected() ? 'connected' : 'connecting');

    return () => {
      peerManager.off('connectionStateChange', handleConnectionStateChange);
    };
  }, [peerManager, roomId]);

  const actions: RoomActions = {
    leaveRoom: async () => {
      await disconnect();
      setRoomId(null);
    },

    copyConnectionInfo: async () => {
      if (!connectionInfo) return;
      await navigator.clipboard.writeText(connectionInfo);
    },

    sendMessage: async (message: any) => {
      if (!peerManager?.isConnected()) {
        throw new Error('Not connected to peer');
      }
      await sendMessage({
        type: 'chat',
        payload: message,
      });
    },

    createRoom: async () => {
      try {
        setIsGettingInfo(true);
        const newRoomId = Math.random().toString(36).substring(2, 8);

        if (!peerManager) {
          throw new Error('PeerManager not initialized');
        }

        await peerManager.createRoom(newRoomId);
        setRoomId(newRoomId);

        const info = await peerManager.getConnectionInfo();
        setConnectionInfo(info);
      } finally {
        setIsGettingInfo(false);
      }
    },

    joinRoom: async (connectionInfo: string) => {
      if (!peerManager) {
        throw new Error('PeerManager not initialized');
      }

      const decodedInfo = JSON.parse(atob(connectionInfo));
      await peerManager.connectWithInfo(connectionInfo);
      setRoomId(decodedInfo.roomId);

      if (decodedInfo.candidates) {
        for (const candidate of decodedInfo.candidates) {
          await peerManager.handleIceCandidate(
            new RTCIceCandidate(candidate),
            'host'
          );
        }
      }
    },
  };

  const state: RoomState = {
    connectionInfo,
    isGettingInfo,
    connectionStatus,
    messages: messages.map((msg) => ({
      ...msg,
      peerId: msg.peerId || '', // Ensure peerId is always a string
    })),
    peers,
    isConnecting,
  };

  return [state, actions];
}
