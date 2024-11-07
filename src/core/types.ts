import { PeerConnectionManager } from "./PeerConnectionManager";

export interface PeerSyncOptions {
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