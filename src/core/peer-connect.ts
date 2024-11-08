import { EventEmitter } from 'events';
import { PeerConnectionManager } from './connection-manager';
import type { PeerMessage, PeerConnectOptions } from './types';

/**
 * High-level wrapper for WebRTC peer connections with event handling.
 * Extends EventEmitter to provide event-based communication.
 *
 * @emits message - When a message is received from a peer
 * @emits peerJoin - When a new peer joins the room
 * @emits peerLeave - When a peer leaves the room
 * @emits connect - When successfully connected to the room
 * @emits disconnect - When disconnected from the room
 * @emits error - When an error occurs
 *
 * @extends {EventEmitter}
 */
export class PeerConnect extends EventEmitter {
  private manager: PeerConnectionManager;
  public readonly roomId: string;

  /**
   * Creates a new PeerConnect instance.
   * @param {PeerConnectOptions} options - Configuration options for the connection
   */
  constructor(options: PeerConnectOptions) {
    super();
    this.roomId = options.roomId;

    const { manager, ...managerOptions } = options;
    this.manager = manager || new PeerConnectionManager(managerOptions);

    this.setupEventListeners();
  }

  /**
   * Sets up event forwarding from the connection manager.
   * @private
   */
  private setupEventListeners() {
    this.manager.on('message', (message: PeerMessage, peerId: string) => {
      this.emit('message', message, peerId);
    });

    this.manager.on('peerJoin', (peerId: string) => {
      this.emit('peerJoin', peerId);
    });

    this.manager.on('peerLeave', (peerId: string) => {
      this.emit('peerLeave', peerId);
    });

    this.manager.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Connects to a room with the specified room ID.
   * @throws {Error} If connection fails
   * @emits connect - On successful connection
   * @emits error - If connection fails
   */
  async connect(): Promise<void> {
    try {
      await this.manager.createRoom(this.roomId);
      this.emit('connect');
    } catch (error) {
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Disconnects from the current room.
   * @emits disconnect - When disconnection is complete
   */
  async disconnect(): Promise<void> {
    this.manager.disconnect();
    this.emit('disconnect');
  }

  /**
   * Sends a message to one or all peers in the room.
   * @param {PeerMessage} message - Message to send
   * @param {string} [peerId] - Optional specific peer to send to
   * @throws {Error} If not connected or sending fails
   */
  async sendMessage(message: PeerMessage, peerId?: string): Promise<void> {
    await this.manager.sendMessage(message, peerId);
  }

  /**
   * Checks if currently connected to the room.
   * @returns {boolean} True if connected to the room
   */
  get isConnected(): boolean {
    return this.manager.isConnected();
  }

  /**
   * Gets array of connected peer IDs.
   * @returns {string[]} Array of peer IDs, excluding the host
   */
  get peers(): string[] {
    // Use type assertion since connections is private
    const connections = Array.from(
      (this.manager as any)['connections'].keys() as string[]
    );
    return connections.filter((id) => id !== 'host');
  }
}
