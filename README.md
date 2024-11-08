# PeerConnect

PeerConnect is a serverless, real-time peer-to-peer connection library for web applications. It leverages WebRTC for direct communication between peers without the need for dedicated backend servers.

## Features

- **Universal Compatibility:**

  - Vanilla JavaScript support
  - React hooks with React Query integration
  - Framework agnostic API design

- **Serverless Real-Time Communication:**

  - Utilizes WebRTC for peer-to-peer connections
  - Optional out-of-band signaling (URL sharing)
  - Direct messaging between peers

- **Ease of Integration:**
  - Intuitive API
  - Built-in connection state management
  - TypeScript support

## Installation

### Vanilla JavaScript

```bash
// TODO: Hosted CDN package
```

### React

```bash
npm install peerconnect
```

## Usage

### Vanilla JavaScript

```javascript
import { PeerConnectionManager } from 'peerconnect';

// Initialize the manager
const manager = new PeerConnectionManager();

// Create a new room
const roomId = await manager.createRoom();
console.log('Created room:', roomId);

// Or join an existing room
await manager.joinRoom('existing-room-id');

// Listen for connection state changes
manager.on('connectionStateChange', ({ state, dataChannelState }) => {
  console.log('Connection state:', state);
  console.log('Data channel state:', dataChannelState);
});

// Listen for messages
manager.on('message', (data, peerId) => {
  console.log(`Received message from ${peerId}:`, data);
});

// Send a message to all peers
await manager.sendMessage({
  type: 'chat',
  payload: 'Hello everyone!',
});

// Clean up when done
manager.disconnect();
```

### React

#### Basic Setup

```jsx
import { PeerSyncProvider, useRoom } from 'peerconnect/react';

// Wrap your app with the provider
function App() {
  const [roomId, setRoomId] = useState(null);

  return (
    <PeerSyncProvider options={{ roomId: roomId || '' }}>
      <ChatRoom roomId={roomId} setRoomId={setRoomId} />
    </PeerSyncProvider>
  );
}

function ChatRoom({ roomId, setRoomId }) {
  const [messageText, setMessageText] = useState('');
  const [state, actions] = useRoom(roomId, setRoomId);

  // Create a new room
  const handleCreateRoom = async () => {
    await actions.createRoom();
  };

  // Join an existing room
  const handleJoinRoom = async (connectionInfo) => {
    await actions.joinRoom(connectionInfo);
  };

  // Send a message
  const handleSendMessage = async () => {
    if (messageText.trim()) {
      await actions.sendMessage(messageText);
      setMessageText('');
    }
  };

  return (
    <div>
      {!roomId ? (
        // Room creation/joining UI
        <div>
          <button onClick={handleCreateRoom}>Create Room</button>
          <div>
            <input
              value={connectionInfo}
              onChange={(e) => setConnectionInfo(e.target.value)}
              placeholder="Enter room connection info"
            />
            <button onClick={() => handleJoinRoom(connectionInfo)}>
              Join Room
            </button>
          </div>
        </div>
      ) : (
        // Chat room UI
        <div>
          <h2>Room: {roomId}</h2>

          {/* Connection status */}
          <div>Status: {state.connectionStatus}</div>

          {/* Connected peers */}
          <div>
            <h3>Connected Peers ({state.peers.length})</h3>
            <ul>
              {state.peers.map((peerId) => (
                <li key={peerId}>{peerId}</li>
              ))}
            </ul>
          </div>

          {/* Messages */}
          <div>
            <h3>Messages</h3>
            <ul>
              {state.messages.map((msg, i) => (
                <li key={i}>
                  {msg.peerId}: {msg.payload}
                </li>
              ))}
            </ul>
          </div>

          {/* Message input */}
          <div>
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>

          {/* Room controls */}
          <div>
            <button onClick={actions.copyConnectionInfo}>Copy Join Info</button>
            <button onClick={actions.leaveRoom}>Leave Room</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## API Reference

### Vanilla JavaScript API

#### PeerConnectionManager

```typescript
class PeerConnectionManager {
  constructor(options?: PeerConnectOptions);

  // Room management
  createRoom(): Promise<string>;
  joinRoom(connectionInfo: string): Promise<void>;
  leaveRoom(): Promise<void>;

  // Messaging
  sendMessage(message: any): Promise<void>;

  // Event handling
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;

  // Cleanup
  disconnect(): void;
}
```

### React API

#### PeerSyncProvider

```typescript
interface PeerSyncProviderProps {
  children: ReactNode;
  options: PeerConnectOptions;
}

function PeerSyncProvider(props: PeerSyncProviderProps): JSX.Element;
```

#### useRoom Hook

```typescript
interface RoomState {
  connectionInfo: string | null;
  isGettingInfo: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  messages: Array<{ peerId: string; payload: any }>;
  peers: string[];
  isConnecting: boolean;
}

interface RoomActions {
  leaveRoom: () => Promise<void>;
  copyConnectionInfo: () => Promise<void>;
  sendMessage: (message: any) => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoom: (connectionInfo: string) => Promise<void>;
}

function useRoom(
  roomId: string | null,
  setRoomId: (id: string | null) => void
): [RoomState, RoomActions];
```

## Browser Support

PeerConnect supports all modern browsers that implement the WebRTC specification:

- Chrome 51+
- Firefox 54+
- Safari 11+
- Edge 79+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
