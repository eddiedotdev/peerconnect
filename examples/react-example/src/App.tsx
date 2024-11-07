import React from 'react';
import { useState, useEffect } from 'react';
import { usePeerSync } from '../../../src/react/usePeerSync';

export default function App() {
  const [inputRoomId, setInputRoomId] = useState('');
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [isRoomCreator, setIsRoomCreator] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<string | null>(null);
  const [isGettingInfo, setIsGettingInfo] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>('disconnected');

  const {
    connect,
    disconnect,
    sendMessage,
    messages,
    peers,
    isConnecting,
    peerManager,
  } = usePeerSync({
    roomId: joinedRoomId || '',
  });

  // Debug logging
  useEffect(() => {
    console.log('PeerManager:', peerManager);
    if (!peerManager) return;
    peerManager.on(
      'connectionStateChange',
      ({ peerId, state, iceState, connectionState }) => {
        console.log(`Connection state changed for ${peerId}:`, {
          state,
          iceState,
          connectionState,
        });
      }
    );
  }, [peerManager]);

  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!peerManager || !joinedRoomId) {
      setConnectionStatus('disconnected');
      return;
    }

    const handleConnectionStateChange = (event: any) => {
      console.log('Connection state change event:', event);

      if (event.dataChannelState === 'open' || event.state === 'connected') {
        console.log('Setting status to connected');
        setConnectionStatus('connected');
      } else if (event.state === 'disconnected') {
        console.log('Setting status to disconnected');
        setConnectionStatus('disconnected');
      } else {
        console.log('Setting status to connecting');
        setConnectionStatus('connecting');
      }
    };

    peerManager.on('connectionStateChange', handleConnectionStateChange);

    // Initial connection check
    const isConnected = peerManager.isConnected();
    console.log('Initial connection check:', {
      isConnected,
      status: isConnected ? 'connected' : 'connecting',
    });
    setConnectionStatus(isConnected ? 'connected' : 'connecting');

    return () => {
      peerManager.off('connectionStateChange', handleConnectionStateChange);
    };
  }, [peerManager, joinedRoomId]);

  const handleCreateRoom = async () => {
    try {
      setIsGettingInfo(true);
      const newRoomId = Math.random().toString(36).substring(2, 8);

      if (!peerManager) {
        throw new Error('PeerManager not initialized');
      }

      console.log('Creating room...');
      await peerManager.createRoom(newRoomId);
      console.log('Room created successfully');

      // Set these before getting connection info
      setJoinedRoomId(newRoomId);
      setIsRoomCreator(true);

      const info = await peerManager.getConnectionInfo();
      setConnectionInfo(info);
    } catch (error) {
      console.error('Detailed error in room creation:', error);
      // Reset states on error
      setJoinedRoomId(null);
      setIsRoomCreator(false);
      alert(
        `Failed to create room: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setIsGettingInfo(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputRoomId.trim() || !peerManager) {
      return;
    }

    try {
      // Decode the connection info that was copied from the host
      const decodedInfo = JSON.parse(atob(inputRoomId));
      console.log('Decoded connection info:', decodedInfo);

      // Join the room with the decoded info
      await peerManager.connectWithInfo(inputRoomId);

      // Set the room ID from the decoded info
      setJoinedRoomId(decodedInfo.roomId);
      setIsRoomCreator(false);

      // Add the ICE candidates that were included in the connection info
      if (decodedInfo.candidates) {
        console.log('Adding ICE candidates:', decodedInfo.candidates);
        for (const candidate of decodedInfo.candidates) {
          await peerManager.handleIceCandidate(
            new RTCIceCandidate(candidate),
            'host'
          );
        }
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      alert(error instanceof Error ? error.message : 'Failed to join room');
    }
  };

  const handleLeaveRoom = async () => {
    await disconnect();
    setJoinedRoomId(null);
    setInputRoomId('');
  };

  const handleCopyJoinInfo = async () => {
    if (!connectionInfo || !peerManager) {
      console.error('No connection info or peer manager available');
      return;
    }

    try {
      await navigator.clipboard.writeText(connectionInfo);
      console.log('Copied connection info:', connectionInfo);
      alert('Connection info copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy connection info');
    }
  };

  // Debug logging for render
  useEffect(() => {
    console.log('connectionInfo', connectionInfo);
    console.log('isRoomCreator', isRoomCreator);
  }, [connectionInfo, isRoomCreator]);

  const handleSendMessage = async (message: string) => {
    try {
      if (!peerManager?.isConnected()) {
        throw new Error('Not connected to peer');
      }

      await sendMessage({
        type: 'chat',
        payload: message,
      });
      setMessageText(''); // Clear input after successful send
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Make sure you are connected to a peer.');
    }
  };

  useEffect(() => {
    if (!peerManager) return;

    const handleConnectionInfo = async (info: RTCSessionDescriptionInit) => {
      console.log('Received connection info:', info);
      if (info.type === 'answer') {
        await peerManager.handleConnectionInfo(info, 'peer');
      }
    };

    const handleIceCandidate = async (
      candidate: RTCIceCandidate,
      peerId: string
    ) => {
      console.log(`Received ICE candidate from ${peerId}:`, candidate);
      await peerManager.handleIceCandidate(candidate, peerId);
    };

    peerManager.on('connectionInfo', handleConnectionInfo);
    peerManager.on('iceCandidate', handleIceCandidate);

    return () => {
      peerManager.off('connectionInfo', handleConnectionInfo);
      peerManager.off('iceCandidate', handleIceCandidate);
    };
  }, [peerManager]);

  // Add this useEffect to debug state changes
  useEffect(() => {
    console.log('State changed:', {
      joinedRoomId,
      isRoomCreator,
      connectionInfo,
    });
  }, [joinedRoomId, isRoomCreator, connectionInfo]);

  // This should control which view is shown
  if (!joinedRoomId) {
    return (
      <div className="p-4">
        <h1>PeerSync Demo</h1>
        <div className="my-4 flex gap-4">
          <button
            onClick={handleCreateRoom}
            disabled={isConnecting}
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
              onClick={handleJoinRoom}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              {isConnecting ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1>Room: {joinedRoomId}</h1>
        <div
          className={`px-2 py-1 rounded ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          } text-white`}
        >
          {connectionStatus}
          {connectionStatus === 'connecting' && '...'}
        </div>
        {isRoomCreator && (
          <button
            onClick={handleCopyJoinInfo}
            disabled={isGettingInfo}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {isGettingInfo ? 'Getting Info...' : 'Copy Join Info'}
          </button>
        )}
        <button
          onClick={handleLeaveRoom}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Leave Room
        </button>
      </div>

      <div className="my-4">
        <h2>Connected Peers ({peers.length})</h2>
        <ul>
          {peers.map((peerId) => (
            <li key={peerId}>{peerId}</li>
          ))}
        </ul>
      </div>

      <div className="my-4">
        <h2>Messages</h2>
        <ul className="mb-4">
          {messages.map((msg, i) => (
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
            onClick={() => {
              if (messageText.trim()) {
                handleSendMessage(messageText);
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
