import { EventEmitter } from 'events';
import { PeerConnectOptions, PeerConnection, PeerMessage } from './types';

const isTest = process.env.NODE_ENV === 'test';

class Logger {
  static log(...args: any[]) {
    if (!isTest) {
      console.log(...args);
    }
  }

  static warn(...args: any[]) {
    if (!isTest) {
      console.warn(...args);
    }
  }

  static error(...args: any[]) {
    if (!isTest) {
      console.error(...args);
    }
  }
}

/**
 * Event handlers interface for peer connection events.
 * @interface PeerEvents
 */
interface PeerEvents {
  /** Fired when a message is received from a peer */
  message: (message: PeerMessage, peerId: string) => void;
  /** Fired when a new peer joins the room */
  peerJoin: (peerId: string) => void;
  /** Fired when a peer leaves the room */
  peerLeave: (peerId: string) => void;
  /** Fired when successfully joined a room */
  roomJoined: (roomId: string) => void;
  /** Fired when leaving a room */
  roomLeft: (roomId: string) => void;
  /** Fired when disconnecting from all peers */
  disconnect: () => void;
  /** Fired when an error occurs */
  error: (error: Error) => void;
  /** Fired when a new ICE candidate is generated */
  iceCandidate: (candidate: RTCIceCandidate, peerId: string) => void;
  /** Fired when connection info (offer/answer) is available */
  connectionInfo: (info: RTCSessionDescriptionInit) => void;
  /** Fired when connection state changes */
  connectionStateChange: (change: {
    peerId: string;
    state: string;
    iceState?: string;
    connectionState?: string;
  }) => void;
}

/**
 * Core interface for managing WebRTC peer connections.
 * @interface IPeerConnectionManager
 * @extends {EventEmitter}
 */
interface IPeerConnectionManager {
  /**
   * Creates a new room with the specified ID and initializes as host.
   * @async
   * @param {string} roomId - Unique identifier for the room
   * @throws {Error} If room creation fails or already in a room
   */
  createRoom(roomId: string): Promise<void>;

  /**
   * Joins an existing room with the specified ID.
   * @async
   * @param {string} roomId - ID of the room to join
   * @throws {Error} If room joining fails or already in a room
   */
  joinRoom(roomId: string): Promise<void>;

  /**
   * Retrieves the connection information needed for peers to join.
   * @async
   * @returns {Promise<string>} Base64 encoded connection string containing room details
   * @throws {Error} If no active room or connection info unavailable
   */
  getConnectionInfo(): Promise<string>;

  /**
   * Establishes connection using provided connection information.
   * @async
   * @param {string} encodedInfo - Base64 encoded connection string from host
   * @throws {Error} If connection fails or info is invalid
   */
  connectWithInfo(encodedInfo: string): Promise<void>;

  /**
   * Sends a message to one or all peers in the room.
   * @async
   * @param {PeerMessage} message - Message to send
   * @param {string} [targetPeerId] - Specific peer to send to, or all if omitted
   * @throws {Error} If not connected or sending fails
   */
  sendMessage(message: PeerMessage, targetPeerId?: string): Promise<void>;

  /**
   * Leaves the current room and disconnects from all peers.
   */
  leaveRoom(): void;

  /**
   * Gets the current room ID if connected to a room.
   * @returns {string | null} Current room ID or null if not in a room
   */
  getCurrentRoom(): string | null;

  /**
   * Creates a new peer connection with the specified peer.
   * @async
   * @param {string} peerId - ID of the peer to connect to
   * @throws {Error} If not in a room or connection fails
   */
  createPeerConnection(peerId: string): Promise<void>;

  /**
   * Handles incoming ICE candidate from a peer.
   * @async
   * @param {RTCIceCandidate} candidate - ICE candidate information
   * @param {string} peerId - ID of the peer the candidate is from
   */
  handleIceCandidate(candidate: RTCIceCandidate, peerId: string): Promise<void>;

  /**
   * Handles incoming connection info (offer/answer) from a peer.
   * @async
   * @param {RTCSessionDescriptionInit} info - Session description for the connection
   * @param {string} peerId - ID of the peer the info is from
   */
  handleConnectionInfo(
    info: RTCSessionDescriptionInit,
    peerId: string
  ): Promise<void>;

  /**
   * Disconnects from all peers and cleans up connections.
   */
  disconnect(): void;

  /**
   * Gets array of currently connected peer IDs.
   * @returns {string[]} Array of peer IDs
   */
  getPeerIds(): string[];

  /**
   * Checks if connected to a specific peer or host.
   * @param {string} [peerId='host'] - ID of peer to check
   * @returns {boolean} True if connected to the specified peer
   */
  isConnected(peerId?: string): boolean;
}

/**
 * Main class for managing WebRTC peer connections and room coordination.
 * @class PeerConnectionManager
 * @extends {EventEmitter}
 * @implements {IPeerConnectionManager}
 */
export class PeerConnectionManager
  extends EventEmitter
  implements IPeerConnectionManager
{
  private connections: Map<string, PeerConnection> = new Map();
  private currentRoomId: string | null = null;
  private iceServers: RTCIceServer[];
  private isHost: boolean = false;
  private localConnection: RTCPeerConnection | null = null;
  private iceCandidates: Map<string, RTCIceCandidate[]> = new Map();

  constructor(options: PeerConnectOptions) {
    super();
    this.iceServers = options?.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  public async createRoom(roomId: string): Promise<void> {
    return this.retryConnection(async () => {
      try {
        Logger.log('Creating room:', roomId);

        if (this.currentRoomId) {
          this.leaveRoom();
        }

        this.currentRoomId = roomId;
        this.isHost = true;

        const connection = new RTCPeerConnection({
          iceServers: this.iceServers,
        });

        // Create data channel
        const dataChannel = connection.createDataChannel('messageChannel', {
          ordered: true,
        });

        // Monitor connection states
        connection.onconnectionstatechange = () => {
          Logger.log('Connection state changed:', connection.connectionState);
          this.emit('connectionStateChange', {
            peerId: 'host',
            state: connection.connectionState,
            connectionState: connection.connectionState,
            dataChannelState: dataChannel.readyState,
          });
        };

        dataChannel.onopen = () => {
          Logger.log('Data channel opened');
          this.emit('connectionStateChange', {
            peerId: 'host',
            state: 'connected',
            connectionState: connection.connectionState,
            dataChannelState: 'open',
          });
        };

        // Store connection info
        this.connections.set('host', {
          connection,
          dataChannel,
          state: 'connecting',
          iceConnectionState: connection.iceConnectionState,
        });

        // Create offer
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        // Handle ICE candidates
        connection.onicecandidate = (event) => {
          if (event.candidate) {
            Logger.log('New ICE candidate:', event.candidate);
            const candidates = this.iceCandidates.get('host') || [];
            candidates.push(event.candidate);
            this.iceCandidates.set('host', candidates);
            this.emit('iceCandidate', event.candidate, 'host');
          }
        };

        // Wait for ICE gathering
        await new Promise<void>((resolve) => {
          if (connection.iceGatheringState === 'complete') {
            resolve();
          } else {
            connection.onicegatheringstatechange = () => {
              if (connection.iceGatheringState === 'complete') {
                resolve();
              }
            };
          }
        });

        this.emit('roomJoined', roomId);
      } catch (error) {
        Logger.error('Error in createRoom:', error);
        throw error;
      }
    });
  }

  public async joinRoom(roomId: string): Promise<void> {
    if (this.currentRoomId) {
      this.leaveRoom();
    }

    // Just set initial state. The actual WebRTC connection
    // will be created when connectWithInfo() is called with
    // the host's connection details
    this.currentRoomId = roomId;
    this.isHost = false;
    this.emit('roomJoined', roomId);
  }

  public async getConnectionInfo(): Promise<string> {
    if (!this.currentRoomId) {
      throw new Error('No active room');
    }

    const connection = this.connections.get('host');
    if (!connection?.connection.localDescription) {
      throw new Error('No connection info available');
    }

    // Include the gathered ICE candidates
    return btoa(
      JSON.stringify({
        type: connection.connection.localDescription.type,
        sdp: connection.connection.localDescription.sdp,
        roomId: this.currentRoomId,
        candidates: this.iceCandidates.get('host') || [],
      })
    );
  }

  public async connectWithInfo(encodedInfo: string): Promise<void> {
    return this.retryConnection(async () => {
      try {
        const info = JSON.parse(atob(encodedInfo));
        Logger.log('Connecting with info:', info);

        if (!info.sdp || !info.type || !info.roomId) {
          throw new Error('Invalid connection info');
        }

        this.currentRoomId = info.roomId;
        this.isHost = false;

        // Create new peer connection for joining
        this.localConnection = new RTCPeerConnection({
          iceServers: this.iceServers,
        });

        // Set up ICE candidate handling
        this.localConnection.onicecandidate = (event) => {
          if (event.candidate) {
            Logger.log('Generated answer ICE candidate:', event.candidate);
            // Store and emit the candidate
            if (!this.iceCandidates.has('peer')) {
              this.iceCandidates.set('peer', []);
            }
            this.iceCandidates.get('peer')!.push(event.candidate);
            this.emit('iceCandidate', event.candidate, 'peer');
          }
        };

        // Add connection state logging
        this.localConnection.oniceconnectionstatechange = () => {
          Logger.log(
            'ICE Connection state:',
            this.localConnection?.iceConnectionState
          );
        };

        this.localConnection.onconnectionstatechange = () => {
          Logger.log(
            'Connection state:',
            this.localConnection?.connectionState
          );
        };

        // Set remote description (the offer)
        await this.localConnection.setRemoteDescription(
          new RTCSessionDescription({
            type: info.type,
            sdp: info.sdp,
          })
        );

        // Create and set local description (answer)
        const answer = await this.localConnection.createAnswer();
        await this.localConnection.setLocalDescription(answer);

        // Emit the answer to be sent back to the host
        this.emit('connectionInfo', {
          type: 'answer',
          sdp: answer.sdp,
          candidates: this.iceCandidates.get('peer'),
        });

        // Add the received ICE candidates
        if (info.candidates) {
          for (const candidate of info.candidates) {
            await this.localConnection?.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          }
        }

        // Emit the answer
        this.emit('connectionInfo', this.localConnection.localDescription);
        this.emit('roomJoined', info.roomId);

        Logger.log('Successfully joined room:', info.roomId);
      } catch (error) {
        Logger.error('Failed to connect with info:', error);
        throw error;
      }
    });
  }

  public async handleConnectionInfo(
    info: RTCSessionDescriptionInit,
    peerId: string
  ): Promise<void> {
    if (info.type === 'offer' && this.isHost) {
      const peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
      });

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(info)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.connections.set(peerId, {
        connection: peerConnection,
        dataChannel: undefined,
        state: 'connecting',
        iceConnectionState: peerConnection.iceConnectionState,
      });

      // Emit answer
      this.emit('connectionInfo', peerConnection.localDescription!);
    } else if (info.type === 'answer' && !this.isHost) {
      const connection = this.connections.get('host')?.connection;
      if (connection) {
        await connection.setRemoteDescription(new RTCSessionDescription(info));
      }
    }
  }

  public leaveRoom(): void {
    if (this.currentRoomId) {
      const roomId = this.currentRoomId;

      // Disconnect from all peers in the room
      this.connections.forEach((_, peerId) => {
        this.disconnectFromPeer(peerId);
      });

      this.currentRoomId = null;
      this.emit('roomLeft', roomId);
    }
  }

  public getCurrentRoom(): string | null {
    return this.currentRoomId;
  }

  private disconnectFromPeer(peerId: string): void {
    const peer = this.connections.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.connections.delete(peerId);
      this.emit('peerLeave', peerId);
    }
  }

  public async createPeerConnection(peerId: string): Promise<void> {
    if (!this.currentRoomId) {
      throw new Error(
        'Must join or create a room before creating peer connections'
      );
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    const dataChannel = peerConnection.createDataChannel('messageChannel');
    this.setupDataChannel(dataChannel, peerId);

    this.connections.set(peerId, {
      connection: peerConnection,
      dataChannel,
      state: 'connecting',
      iceConnectionState: peerConnection.iceConnectionState,
    });

    this.setupPeerConnectionListeners(peerConnection, peerId);
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string) {
    const handlers = {
      onopen: () => {
        Logger.log(`Data channel opened for peer: ${peerId}`);
        const peerConn = this.connections.get(peerId);
        if (peerConn) {
          peerConn.state = 'connected';
          this.emit('connectionStateChange', {
            peerId,
            state: 'connected',
            dataChannelState: channel.readyState,
          });
          // Also emit peerJoin when data channel opens
          this.emit('peerJoin', peerId);
        }
      },
      onclose: () => {
        Logger.log(`Data channel closed for peer: ${peerId}`);
        const peerConn = this.connections.get(peerId);
        if (peerConn) {
          peerConn.state = 'disconnected';
          this.emit('connectionStateChange', {
            peerId,
            state: 'disconnected',
            dataChannelState: 'closed',
          });
        }
      },
      onerror: (error: Event) => {
        Logger.error(`Data channel error for peer: ${peerId}:`, error);
        this.emit('error', new Error(`Data channel error: ${error}`));
      },
    };

    channel.onopen = handlers.onopen;
    channel.onclose = handlers.onclose;
    channel.onerror = handlers.onerror;

    return () => {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
    };
  }

  private setupPeerConnectionListeners(
    connection: RTCPeerConnection,
    peerId: string
  ) {
    // ICE Candidate Generation
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        Logger.log(`ICE candidate generated for ${peerId}:`, event.candidate);
        const candidates = this.iceCandidates.get(peerId) || [];
        candidates.push(event.candidate);
        this.iceCandidates.set(peerId, candidates);
        this.emit('iceCandidate', event.candidate, peerId);
      }
    };

    // ICE Connection State
    connection.oniceconnectionstatechange = () => {
      Logger.log(
        `ICE Connection state for ${peerId}:`,
        connection.iceConnectionState
      );
      const peerConn = this.connections.get(peerId);
      if (peerConn) {
        peerConn.iceConnectionState = connection.iceConnectionState;

        // Update connection state based on ICE state
        if (
          connection.iceConnectionState === 'connected' ||
          connection.iceConnectionState === 'completed'
        ) {
          peerConn.state = 'connected';
          this.emit('connectionStateChange', {
            peerId,
            state: 'connected',
            iceState: connection.iceConnectionState,
            dataChannelState: peerConn.dataChannel?.readyState,
          });
        }
      }
    };

    // Connection State
    connection.onconnectionstatechange = () => {
      Logger.log(`Connection state for ${peerId}:`, connection.connectionState);
      const peerConn = this.connections.get(peerId);
      if (peerConn) {
        if (connection.connectionState === 'connected') {
          peerConn.state = 'connected';
          this.emit('connectionStateChange', {
            peerId,
            state: 'connected',
            connectionState: connection.connectionState,
            dataChannelState: peerConn.dataChannel?.readyState,
          });
        }
      }
    };

    // Signaling State
    connection.onsignalingstatechange = () => {
      Logger.log(`Signaling state for ${peerId}:`, connection.signalingState);
    };

    // Negotiation Needed
    connection.onnegotiationneeded = () => {
      Logger.log(`Negotiation needed for ${peerId}`);
    };

    // Data Channel Events
    const peerConnection = this.connections.get(peerId);
    if (peerConnection?.dataChannel) {
      const dataChannel = peerConnection.dataChannel;

      dataChannel.onopen = () => {
        Logger.log(`Data channel opened for ${peerId}`);
        if (peerConnection.state !== 'connected') {
          peerConnection.state = 'connected';
          this.emit('connectionStateChange', {
            peerId,
            state: 'connected',
            connectionState: connection.connectionState,
            dataChannelState: 'open',
          });
        }
      };

      dataChannel.onclose = () => {
        Logger.log(`Data channel closed for ${peerId}`);
        this.emit('connectionStateChange', {
          peerId,
          state: 'disconnected',
          connectionState: connection.connectionState,
          dataChannelState: 'closed',
        });
      };

      dataChannel.onerror = (error) => {
        Logger.error(`Data channel error for ${peerId}:`, error);
      };
    }
  }

  public async sendMessage(
    message: PeerMessage,
    targetPeerId?: string
  ): Promise<void> {
    return this.retryConnection(async () => {
      try {
        Logger.log('Attempting to send message:', {
          message,
          targetPeerId,
          isConnected: this.isConnected(targetPeerId || 'host'),
        });

        if (!this.currentRoomId) {
          throw new Error('Not connected to any room');
        }

        // If no specific peer is targeted, broadcast to all peers
        if (!targetPeerId) {
          const peers = Array.from(this.connections.keys());
          await Promise.all(
            peers.map((peerId) => this.sendMessageToPeer(message, peerId))
          );
          return;
        }

        await this.sendMessageToPeer(message, targetPeerId);
      } catch (error) {
        Logger.error('Failed to send message:', error);
        throw error;
      }
    });
  }

  private async sendMessageToPeer(
    message: PeerMessage,
    peerId: string
  ): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer: ${peerId}`);
    }

    if (!connection.dataChannel) {
      throw new Error(`No data channel established for peer: ${peerId}`);
    }

    if (connection.dataChannel.readyState !== 'open') {
      throw new Error(
        `Data channel not open for peer: ${peerId}. Current state: ${connection.dataChannel.readyState}`
      );
    }

    try {
      connection.dataChannel.send(JSON.stringify(message));
      this.emit('message', message, peerId);
    } catch (error) {
      Logger.error(`Failed to send message to peer ${peerId}:`, error);
      throw error;
    }
  }

  public disconnect(): void {
    if (this.currentRoomId) {
      this.leaveRoom();
    }
    this.emit('disconnect');
  }

  public getPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  public async handleIceCandidate(
    candidate: RTCIceCandidate,
    peerId: string
  ): Promise<void> {
    const peer = this.connections.get(peerId);
    if (peer?.connection) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  public isConnected(peerId: string = 'host'): boolean {
    const connection = this.connections.get(peerId);
    if (!connection) return false;

    const isDataChannelOpen = connection.dataChannel?.readyState === 'open';
    const isPeerConnected =
      connection.connection.connectionState === 'connected';

    Logger.log('Connection status check:', {
      peerId,
      dataChannelState: connection.dataChannel?.readyState,
      connectionState: connection.connection.connectionState,
      isConnected: isDataChannelOpen || isPeerConnected,
    });

    return isDataChannelOpen || isPeerConnected;
  }

  private async retryConnection(fn: () => Promise<void>, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fn();
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        if (!isTest) {
          Logger.warn(`Attempt ${i + 1} failed:`, error);
          const delay = Math.pow(2, i) * 1000;
          Logger.log(`Retrying in ${delay}ms...`);
        }

        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }
}

export type { IPeerConnectionManager, PeerEvents };
