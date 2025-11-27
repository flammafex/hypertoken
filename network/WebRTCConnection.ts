/*
 * network/WebRTCConnection.ts
 * WebRTC DataChannel wrapper for direct peer-to-peer connections
 *
 * Provides a high-level abstraction over RTCPeerConnection and RTCDataChannel
 * for reliable, low-latency P2P communication.
 */
import { Emitter } from "../core/events.js";

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  // Optional: Configure DataChannel behavior
  ordered?: boolean;
  maxRetransmits?: number;
}

export const DEFAULT_RTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  ordered: true,
  maxRetransmits: 3
};

/**
 * WebRTCConnection manages a single peer-to-peer WebRTC connection
 *
 * Events emitted:
 * - 'rtc:ice-candidate' - Local ICE candidate generated
 * - 'rtc:connected' - DataChannel opened and ready
 * - 'rtc:disconnected' - Connection closed
 * - 'rtc:data' - Data received from peer
 * - 'rtc:error' - Connection error occurred
 */
export class WebRTCConnection extends Emitter {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private remotePeerId: string;
  private config: WebRTCConfig;
  private connectionState: RTCPeerConnectionState = 'new';

  constructor(remotePeerId: string, config: WebRTCConfig = DEFAULT_RTC_CONFIG) {
    super();
    this.remotePeerId = remotePeerId;
    this.config = config;

    // Create peer connection with ICE servers for NAT traversal
    this.peerConnection = new RTCPeerConnection({
      iceServers: config.iceServers
    });

    this.setupConnectionHandlers();
  }

  /**
   * Get the remote peer ID
   */
  getRemotePeerId(): string {
    return this.remotePeerId;
  }

  /**
   * Check if the connection is established and ready
   */
  isConnected(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RTCPeerConnectionState {
    return this.connectionState;
  }

  /**
   * Create an offer to initiate connection (caller side)
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    // Create data channel (only caller creates it)
    this.dataChannel = this.peerConnection.createDataChannel('hypertoken', {
      ordered: this.config.ordered ?? true,
      maxRetransmits: this.config.maxRetransmits ?? 3
    });

    this.setupDataChannelHandlers();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  /**
   * Handle an incoming offer and create an answer (receiver side)
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  /**
   * Handle an incoming answer (caller side)
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Add an ICE candidate received from the remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  /**
   * Send data to the remote peer via DataChannel
   */
  send(data: any): boolean {
    if (!this.isConnected()) {
      console.warn('[WebRTC] Cannot send: DataChannel not open');
      return false;
    }

    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.dataChannel!.send(payload);
      return true;
    } catch (err) {
      console.error('[WebRTC] Send error:', err);
      this.emit('rtc:error', { error: err });
      return false;
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    this.peerConnection.close();
    this.emit('rtc:disconnected', { peerId: this.remotePeerId });
  }

  /**
   * Setup handlers for peer connection events
   */
  private setupConnectionHandlers(): void {
    // ICE candidate generation
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('rtc:ice-candidate', {
          peerId: this.remotePeerId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;

      console.log(`[WebRTC] Connection state with ${this.remotePeerId}: ${this.connectionState}`);

      if (this.connectionState === 'failed' || this.connectionState === 'closed') {
        this.emit('rtc:disconnected', { peerId: this.remotePeerId });
      }
    };

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${this.remotePeerId}: ${this.peerConnection.iceConnectionState}`);

      if (this.peerConnection.iceConnectionState === 'failed') {
        this.emit('rtc:error', {
          error: 'ICE connection failed',
          peerId: this.remotePeerId
        });
      }
    };

    // Handle incoming data channels (receiver side)
    this.peerConnection.ondatachannel = (event) => {
      console.log(`[WebRTC] Received data channel from ${this.remotePeerId}`);
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };
  }

  /**
   * Setup handlers for data channel events
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log(`[WebRTC] DataChannel opened with ${this.remotePeerId}`);
      this.emit('rtc:connected', { peerId: this.remotePeerId });
    };

    this.dataChannel.onclose = () => {
      console.log(`[WebRTC] DataChannel closed with ${this.remotePeerId}`);
      this.emit('rtc:disconnected', { peerId: this.remotePeerId });
    };

    this.dataChannel.onerror = (error) => {
      console.error(`[WebRTC] DataChannel error with ${this.remotePeerId}:`, error);
      this.emit('rtc:error', { error, peerId: this.remotePeerId });
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        this.emit('rtc:data', {
          payload: data,
          fromPeerId: this.remotePeerId
        });
      } catch (err) {
        console.error('[WebRTC] Error parsing message:', err);
      }
    };
  }

  /**
   * Get connection statistics (useful for debugging)
   */
  async getStats(): Promise<RTCStatsReport> {
    return await this.peerConnection.getStats();
  }
}
