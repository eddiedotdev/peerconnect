import { EventEmitter } from 'events';
import { PeerConnectionManager } from './PeerConnectionManager';
import type { PeerMessage, PeerSyncOptions } from './types';

export class PeerSync extends EventEmitter {
  private manager: PeerConnectionManager;
  public readonly roomId: string;

  constructor(options: PeerSyncOptions) {
    super();
    this.roomId = options.roomId;

    // Create manager options by excluding the manager property
    const { manager, ...managerOptions } = options;
    this.manager = manager || new PeerConnectionManager(managerOptions);

    this.setupEventListeners();
  }

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

  async disconnect(): Promise<void> {
    this.manager.disconnect();
    this.emit('disconnect');
  }

  async sendMessage(message: PeerMessage, peerId?: string): Promise<void> {
    await this.manager.sendMessage(message, peerId);
  }

  get isConnected(): boolean {
    return this.manager.isConnected();
  }

  get peers(): string[] {
    // Use type assertion since connections is private
    const connections = Array.from(
      (this.manager as any)['connections'].keys() as string[]
    );
    return connections.filter((id) => id !== 'host');
  }
}
