import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock RTCSessionDescription
class MockRTCSessionDescription {
  type: RTCSdpType;
  sdp: string;

  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type;
    this.sdp = init.sdp || '';
  }

  toJSON() {
    return {
      type: this.type,
      sdp: this.sdp,
    };
  }
}

// Mock RTCDataChannel
class MockRTCDataChannel extends EventTarget {
  label: string;
  readyState: RTCDataChannelState = 'open';

  constructor(label: string) {
    super();
    this.label = label;
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = 'closed';
      this.dispatchEvent(new Event('close'));
    });
  }

  send: (data: string) => void;
  close: () => void;
}

// Mock RTCPeerConnection
class MockRTCPeerConnection extends EventTarget {
  private dataChannels: Map<string, MockRTCDataChannel> = new Map();
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  onicecandidate: ((ev: any) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  iceGatheringState = 'complete';
  iceConnectionState = 'connected';
  connectionState = 'connected';

  constructor() {
    super();
    this.createOffer = vi.fn().mockResolvedValue({
      type: 'offer',
      sdp: 'mock-sdp',
    });
    this.createAnswer = vi.fn().mockResolvedValue({
      type: 'answer',
      sdp: 'mock-sdp',
    });
    this.setLocalDescription = vi.fn().mockImplementation((desc) => {
      this.localDescription = new MockRTCSessionDescription(desc);
      return Promise.resolve();
    });
    this.setRemoteDescription = vi.fn().mockImplementation((desc) => {
      this.remoteDescription = new MockRTCSessionDescription(desc);
      return Promise.resolve();
    });
    this.close = vi.fn();
  }

  createDataChannel(label: string): MockRTCDataChannel {
    const channel = new MockRTCDataChannel(label);
    this.dataChannels.set(label, channel);
    return channel;
  }

  // Mock methods
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: () => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (
    description: RTCSessionDescriptionInit
  ) => Promise<void>;
  setRemoteDescription: (
    description: RTCSessionDescriptionInit
  ) => Promise<void>;
  close: () => void;
}

// Set up global mocks
global.RTCPeerConnection = MockRTCPeerConnection as any;
global.RTCSessionDescription = MockRTCSessionDescription as any;
global.RTCDataChannel = MockRTCDataChannel as any;

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
