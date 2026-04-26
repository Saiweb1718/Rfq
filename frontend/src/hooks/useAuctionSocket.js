import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuctionStore } from '../store/auctionStore';

export function useAuctionSocket(auctionId) {
  const socketRef = useRef(null);
  const { token, setRankings, setBidCloseTime, setAuctionStatus } = useAuctionStore();

  useEffect(() => {
    if (!auctionId || !token) return;

    const socket = io('http://localhost:3000', {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message);
    });

    socket.on('connect', () => {
      console.log('[socket] Connected to backend');
      socket.emit('join:auction', auctionId);
    });
    socket.on('bid:new', (data) => {
      setRankings(data.rankings);
      if (data.extended && data.newBidCloseTime) {
        setBidCloseTime(data.newBidCloseTime);
      }
    });

    socket.on('auction:opened', () => setAuctionStatus('ACTIVE'));
    socket.on('auction:closed', () => setAuctionStatus('CLOSED'));
    socket.on('auction:forceClosed', () => setAuctionStatus('FORCE_CLOSED'));

    return () => {
      socket.emit('leave:auction', auctionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auctionId, token, setRankings, setBidCloseTime, setAuctionStatus]);

  return socketRef;
}
