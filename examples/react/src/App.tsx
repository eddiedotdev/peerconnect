import React, { useState } from 'react';
import { PeerSyncProvider, useRoom } from '../../../src/react';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);

  return (
    <PeerSyncProvider options={{ roomId: roomId || '' }}>
      <Room roomId={roomId} setRoomId={setRoomId} />
    </PeerSyncProvider>
  );
}

function Room({
  roomId,
  setRoomId,
}: {
  roomId: string | null;
  setRoomId: (id: string | null) => void;
}) {
  const [inputRoomId, setInputRoomId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [state, actions] = useRoom(roomId, setRoomId);

  if (!roomId) {
    return (
      <div className="p-4">
        <h1>PeerSync Demo</h1>
        <div className="my-4 flex gap-4">
          <button
            onClick={actions.createRoom}
            disabled={state.isConnecting}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Create New Room
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="Enter Connection Info"
              className="px-2 py-1 border rounded"
            />
            <button
              onClick={() => actions.joinRoom(inputRoomId)}
              disabled={state.isConnecting}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              {state.isConnecting ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1>Room: {roomId}</h1>
        <div
          className={`px-2 py-1 rounded ${
            state.connectionStatus === 'connected'
              ? 'bg-green-500'
              : state.connectionStatus === 'connecting'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          } text-white`}
        >
          {state.connectionStatus}
          {state.connectionStatus === 'connecting' && '...'}
        </div>
        {state.connectionInfo && (
          <button
            onClick={actions.copyConnectionInfo}
            disabled={state.isGettingInfo}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {state.isGettingInfo ? 'Getting Info...' : 'Copy Join Info'}
          </button>
        )}
        <button
          onClick={actions.leaveRoom}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Leave Room
        </button>
      </div>

      <div className="my-4">
        <h2>Connected Peers ({state.peers.length})</h2>
        <ul>
          {state.peers.map((peerId) => (
            <li key={peerId}>{peerId}</li>
          ))}
        </ul>
      </div>

      <div className="my-4">
        <h2>Messages</h2>
        <ul className="mb-4">
          {state.messages.map((msg, i) => (
            <li key={i}>
              {msg.peerId}: {msg.payload}
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1 px-2 py-1 border rounded"
          />
          <button
            onClick={async () => {
              if (messageText.trim()) {
                try {
                  await actions.sendMessage(messageText);
                  setMessageText('');
                } catch (error) {
                  console.error('Failed to send message:', error);
                  // Optionally add user feedback here
                }
              }
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
