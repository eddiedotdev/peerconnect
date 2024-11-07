import { PeerConnectionManager } from './connection-manager';

export interface PeerConnectOptions {
  roomId: string;
  manager?: PeerConnectionManager;
  iceServers?: RTCIceServer[];
}

export interface PeerMessage {
  type: string;
  payload: any;
}

// Add this if it doesn't exist
export interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  iceConnectionState: RTCIceConnectionState;
}
