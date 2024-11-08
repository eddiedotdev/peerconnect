'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePeerConnect } from '../hooks/use-peer-connect';

/**
 * Possible states for a peer connection.
 * @type {ConnectionStatus}
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Event interface for connection state changes.
 * @interface ConnectionStateChangeEvent
 */
interface ConnectionStateChangeEvent {
  /** Data channel state */
  dataChannelState?: string;
  /** Connection state */
  state: string;
  /** Peer ID */
  peerId: string;
  /** Connection state */
  connectionState?: string;
  /** ICE state */
  iceState?: string;
}

/**
 * State interface for managing WebRTC room connections and messaging.
 * @interface RoomState
 */
export interface RoomState {
  /** Base64 encoded connection string for sharing with peers to join the room */
  connectionInfo: string | null;

  /** Whether connection info is currently being generated during room creation */
  isGettingInfo: boolean;

  /** Current state of the peer connection: 'connected', 'connecting', or 'disconnected' */
  connectionStatus: ConnectionStatus;

  /** Array of received messages, each containing sender's peerId and message payload */
  messages: Array<{ peerId: string; payload: any }>;

  /** Array of unique identifiers for currently connected peers */
  peers: string[];

  /** Whether a connection attempt is currently in progress */
  isConnecting: boolean;
}

/**
 * Available actions for room management.
 * @interface RoomActions
 */
export interface RoomActions {
  /**
   * Leaves the current room by disconnecting from all peers and clearing the room ID.
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If disconnection fails
   */
  leaveRoom: () => Promise<void>;

  /**
   * Copies the current room's connection info to the system clipboard.
   * This info can be shared with others to join the room.
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If clipboard access is denied
   */
  copyConnectionInfo: () => Promise<void>;

  /**
   * Sends a message to all connected peers in the room.
   * @async
   * @param {any} message - The message payload to send
   * @returns {Promise<void>}
   * @throws {Error} If not connected to any peers or if sending fails
   */
  sendMessage: (message: any) => Promise<void>;

  /**
   * Creates a new room with a random ID and generates connection info.
   * The creator becomes the host of the room.
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If PeerManager is not initialized or room creation fails
   */
  createRoom: () => Promise<void>;

  /**
   * Joins an existing room using the provided connection info.
   * @async
   * @param {string} connectionInfo - Base64 encoded connection info string from the host
   * @returns {Promise<void>}
   * @throws {Error} If PeerManager is not initialized, connection info is invalid, or connection fails
   */
  joinRoom: (connectionInfo: string) => Promise<void>;
}

/**
 * Hook for managing room state and actions.
 * @function useRoom
 * @param {string | null} roomId - Current room ID
 * @param {function} setRoomId - Function to update room ID
 * @returns {[RoomState, RoomActions]} Tuple containing room state and available actions
 */
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

  // Memoize the connection state change handler
  const handleConnectionStateChange = useCallback(
    ({ dataChannelState, state }: ConnectionStateChangeEvent) => {
      if (dataChannelState === 'open' || state === 'connected') {
        setConnectionStatus('connected');
      } else if (state === 'disconnected') {
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('connecting');
      }
    },
    []
  );

  useEffect(() => {
    if (!peerManager || !roomId) {
      setConnectionStatus('disconnected');
      return;
    }

    peerManager.on('connectionStateChange', handleConnectionStateChange);
    setConnectionStatus(peerManager.isConnected() ? 'connected' : 'connecting');

    return () => {
      peerManager.off('connectionStateChange', handleConnectionStateChange);
    };
  }, [peerManager, roomId, handleConnectionStateChange]);

  // Memoize actions to prevent unnecessary re-renders
  const actions: RoomActions = useMemo(
    () => ({
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

          const [_, info] = await Promise.all([
            peerManager.createRoom(newRoomId),
            peerManager.getConnectionInfo(),
          ]);

          setRoomId(newRoomId);
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
    }),
    [connectionInfo, disconnect, peerManager, sendMessage, setRoomId]
  );

  // Memoize state to prevent unnecessary re-renders
  const state: RoomState = useMemo(
    () => ({
      connectionInfo,
      isGettingInfo,
      connectionStatus,
      messages: messages.map((msg) => ({
        ...msg,
        peerId: msg.peerId ?? '',
      })),
      peers,
      isConnecting,
    }),
    [
      connectionInfo,
      isGettingInfo,
      connectionStatus,
      messages,
      peers,
      isConnecting,
    ]
  );

  return [state, actions];
}
