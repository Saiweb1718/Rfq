import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import { useAuctionStore } from '../store/auctionStore';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import Countdown from '../components/Countdown';
import RankingTable from '../components/RankingTable';
import ActivityLog from '../components/ActivityLog';

const statusColors = {
  PENDING: 'bg-surface-50 text-surface-600',
  ACTIVE: 'bg-success-500/20 text-success-400',
  CLOSED: 'bg-surface-50 text-surface-600',
  FORCE_CLOSED: 'bg-danger-500/20 text-danger-400',
};

const triggerLabels = {
  BID_RECEIVED: 'Any bid received',
  ANY_RANK_CHANGE: 'Any rank change',
  L1_RANK_CHANGE: 'L1 rank change',
};

export default function AuctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rankings, setRankings, bidCloseTime, setBidCloseTime, auctionStatus, setAuctionStatus } = useAuctionStore();

  const [auction, setAuction] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useAuctionSocket(id);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, lRes] = await Promise.all([
          api.get(`/auctions/${id}`),
          api.get(`/auctions/${id}/logs`),
        ]);
        setAuction(aRes.data.auction);
        setRankings(aRes.data.rankings);
        setBidCloseTime(aRes.data.auction.bid_close_time);
        setAuctionStatus(aRes.data.auction.status);
        setLogs(lRes.data);
      } catch (err) {
        console.error('Failed to load auction', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(async () => {
      try { const { data } = await api.get(`/auctions/${id}/logs`); setLogs(data); } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [id, setRankings, setBidCloseTime, setAuctionStatus]);

  if (loading || !auction) {
    return <div className="min-h-screen flex items-center justify-center text-surface-600">Loading...</div>;
  }

  const currentStatus = auctionStatus || auction.status;
  const currentCloseTime = bidCloseTime || auction.bid_close_time;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions')} className="p-2 rounded-lg hover:bg-surface-50 transition-colors text-surface-600 hover:text-surface-900">← Back</button>
            <div>
              <h1 className="text-lg font-semibold text-surface-900">{auction.rfq_name}</h1>
              <p className="text-xs text-surface-600 font-mono">{auction.rfq_reference_id}</p>
            </div>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${statusColors[currentStatus] || ''}`}>{currentStatus}</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4 flex flex-col items-center">
            <Countdown targetTime={currentCloseTime} triggerWindowMinutes={auction.trigger_window_minutes} label="Bid Close" />
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <Countdown targetTime={auction.forced_close_time} label="Forced Close" />
          </div>
          <div className="glass-card p-4">
            <h3 className="text-xs uppercase tracking-widest text-surface-600 mb-3 text-center">Config</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-600">Start</span><span className="text-surface-900 text-xs tabular-nums">{format(new Date(auction.bid_start_time), 'dd MMM HH:mm:ss')}</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Trigger</span><span className="text-surface-900 font-medium">{triggerLabels[auction.extension_trigger_type]}</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Window</span><span className="text-surface-900">{auction.trigger_window_minutes} min</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Extension</span><span className="text-surface-900">{auction.extension_duration_minutes} min</span></div>
              <div className="flex justify-between"><span className="text-surface-600">Close</span><span className="text-surface-900 text-xs tabular-nums">{format(new Date(currentCloseTime), 'dd MMM HH:mm:ss')}</span></div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">📊 Live Rankings</h2>
          <RankingTable rankings={rankings} showSupplierDetails={true} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-surface-900 mb-4">📋 Activity Log</h2>
          <ActivityLog logs={logs} />
        </div>
      </div>
    </div>
  );
}
