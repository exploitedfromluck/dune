import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';

export const usePeerJSWatchParty = ({ onMessage, onStatusChange }) => {
  const peerRef = useRef(null);
  const hostConnRef = useRef(null); // For guests: the single connection to the host
  const guestConnsRef = useRef(new Map()); // For hosts: a map of connections to all guests

  const [peerId, setPeerId] = useState(null);
  const [isPartyActive, setIsPartyActive] = useState(false);
  const [partyRole, setPartyRole] = useState(null); // 'host' or 'guest'

  // Use refs for callbacks to ensure the latest version is always used inside PeerJS event listeners
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  const cleanup = useCallback(() => {
    if (hostConnRef.current) hostConnRef.current.close();
    guestConnsRef.current.forEach(conn => conn.close());
    if (peerRef.current) peerRef.current.destroy();

    hostConnRef.current = null;
    guestConnsRef.current.clear();
    peerRef.current = null;
    setPeerId(null);
    setIsPartyActive(false);
    setPartyRole(null);
    onStatusChangeRef.current('disconnected');
  }, []);

  /**
   * Sends a message.
   * - If HOST, broadcasts to all guests. Can optionally target one guest.
   * - If GUEST, sends only to the host.
   */
  const sendMessage = useCallback((data, targetPeerId = null) => {
    if (partyRole === 'host') {
      if (targetPeerId) {
        const conn = guestConnsRef.current.get(targetPeerId);
        if (conn?.open) conn.send(data);
      } else {
        guestConnsRef.current.forEach(conn => conn.send(data));
      }
    } else if (partyRole === 'guest' && hostConnRef.current?.open) {
      hostConnRef.current.send(data);
    }
  }, [partyRole]);

  const initializePeer = useCallback((id = undefined) => {
    if (peerRef.current) peerRef.current.destroy();

    // We provide a TURN/STUN server config for better connectivity across different networks
    const newPeer = new Peer(id, {
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
            ]
        }
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      onStatusChangeRef.current('error');
      if (err.type === 'unavailable-id' || err.type === 'peer-unavailable') {
        alert('Could not connect to the party. The ID might be invalid or the host has disconnected.');
      }
      cleanup();
    });

    newPeer.on('disconnected', () => {
        // We don't cleanup here, PeerJS will try to reconnect automatically
        onStatusChangeRef.current('connecting'); 
    });

    return newPeer;
  }, [cleanup]);

  const startParty = useCallback(() => {
    const peer = initializePeer();
    setPartyRole('host');

    peer.on('open', (id) => {
      setPeerId(id);
      setIsPartyActive(true);
      onStatusChangeRef.current('hosting');
    });

    peer.on('connection', (conn) => {
      guestConnsRef.current.set(conn.peer, conn);
      onStatusChangeRef.current('hosting');

      conn.on('data', (data) => onMessageRef.current(data, conn.peer));

      conn.on('close', () => {
        guestConnsRef.current.delete(conn.peer);
        onStatusChangeRef.current('hosting');
      });
    });
  }, [initializePeer]);

  const joinParty = useCallback((hostId) => {
    const peer = initializePeer();
    setPartyRole('guest');

    peer.on('open', (id) => {
      onStatusChangeRef.current('connecting');
      const conn = peer.connect(hostId, { reliable: true });
      hostConnRef.current = conn;

      conn.on('open', () => {
        setIsPartyActive(true);
        onStatusChangeRef.current('connected');
        // A new guest automatically requests sync upon connecting
        sendMessage({ type: 'SYNC_REQUEST' });
      });

      conn.on('data', (data) => onMessageRef.current(data, conn.peer));

      conn.on('close', () => {
        alert('Disconnected from the party host.');
        cleanup();
      });
    });
  }, [initializePeer, cleanup, sendMessage]);

  // General cleanup on component unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return { peerId, isPartyActive, partyRole, sendMessage, startParty, joinParty, endParty: cleanup };
};