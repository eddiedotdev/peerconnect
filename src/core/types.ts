import { PeerConnectionManager } from './connection-manager';

/**
 * Configuration options for initializing a peer connection.
 * @interface PeerConnectOptions
 */
export interface PeerConnectOptions {
  /** Unique identifier for the room to join or create */
  roomId: string;
  /** Optional custom connection manager instance */
  manager?: PeerConnectionManager;
  /** Optional array of STUN/TURN servers for NAT traversal */
  iceServers?: RTCIceServer[];
}

/**
 * Standard message format for peer-to-peer communication.
 * @interface PeerMessage
 */
export interface PeerMessage {
  /** Message type identifier used for handling different message categories */
  type: string;
  /** Message payload containing the actual data to be transmitted */
  payload: any;
}

/**
 * Represents an active peer connection with its associated state and channels.
 * @interface PeerConnection
 */
export interface PeerConnection {
  /** The underlying WebRTC peer connection instance */
  connection: RTCPeerConnection;
  /** Optional data channel for sending/receiving messages */
  dataChannel?: RTCDataChannel;
  /** Current state of the peer connection */
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  /** Current state of the ICE connection */
  iceConnectionState: RTCIceConnectionState;
}
