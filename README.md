# PeerSync

PeerSync is a serverless, real-time peer-to-peer connection library for web applications. It leverages WebRTC for direct communication between peers without the need for dedicated backend servers. Compatible with both Vanilla JavaScript and React (including React Hooks), PeerSync aims to simplify the integration of real-time features into your projects.

## Features

- **Universal Compatibility:**
  - Vanilla JavaScript support
  - React hooks for easy integration
  - Framework agnostic API design

- **Serverless Real-Time Communication:**
  - Utilizes WebRTC for peer-to-peer connections
  - Optional out-of-band signaling (URL sharing, QR codes)

- **Ease of Integration:**
  - Intuitive API
  - Imperative and declarative interfaces

- **TypeScript and ESM:**
  - Fully typed with TypeScript
  - Published as an ESM module

## Installation

## Usage

### Vanilla JavaScript

```js
import PeerSync from 'peersync';

const rtc = new PeerSync({
  roomId: 'unique-room-id',
  onConnect: () => console.log('Connected to room'),
  onMessage: (data, peerId) => console.log(Received data from ${peerId}:, data),
  onDisconnect: () => console.log('Disconnected from room'),
  onError: (error) => console.error('Connection error:', error),
});

rtc.connect();

// Broadcasting data to all peers
rtc.broadcastMessage({ type: 'chat', message: 'Hello, everyone!' });

// Sending data to a specific peer
const targetPeerId = 'peer-12345';

rtc.sendMessageToPeer(targetPeerId, { type: 'private', message: 'Hello, peer!' });
```

### React Integration with Hooks

```js
import React, { useEffect } from "react";
import {
	usePeerSyncConnect,
	usePeerSyncMessage,
	usePeerSyncStatus,
} from "peersync";

const ChatRoom = () => {

	const peerManager = usePeerSyncConnect({
		roomId: "unique-room-id",
		onConnect: () => console.log("Connected to room"),
		onMessage: (data, peerId) => {
      console.log(`Received message from ${peerId}:`, data)
    },
		onDisconnect: () => console.log("Disconnected from room"),
		onError: (error) => console.error("Connection error:", error),
	});

	const { messages, sendMessage, sendMessageToPeer } = usePeerSyncMessage(peerManager);

	const { peers, connectionStatus } = usePeerSyncStatus(peerManager);

	useEffect(() => {
		// Any additional side effects can be handled here
	}, [peerManager]);

	const handleSend = () => {
		sendMessage({ type: "chat", message: "Hello from React!" });
	};

	return (
		<div>
			<h1>Chat Room</h1>
			<div>Status: {connectionStatus}</div>
			<ul>
				{messages.map((msg, index) => (
					<li key={index}>
						{msg.data.message} (from {msg.peerId})
					</li>
				))}
			</ul>
			<button onClick={handleSend}>Send Message</button>
			<div>
				<h2>Connected Peers:</h2>
				<ul>
					{peers.map((peer) => (
						<li key={peer}>{peer}</li>
					))}
				</ul>
			</div>
		</div>
	);
};

export default ChatRoom;
```
# peerconnect
