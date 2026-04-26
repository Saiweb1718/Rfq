import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import { useAuctionStore } from '../store/auctionStore';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import Countdown from '../components/Countdown';
import RankingTable from '../components/RankingTable';

export default function BidRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, rankings, setRankings, bidCloseTime, setBidCloseTime, auctionStatus, setAuctionStatus } = useAuctionStore();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [bidForm, setBidForm] = useState({
    carrierName: '', freightCharges: '', originCharges: '0',
    destinationCharges: '0', transitTimeDays: '', quoteValidityDays: '',
  });

  useAuctionSocket(id);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/auctions/${id}`);
        setAuction(data.auction);
        setRankings(data.rankings);
        setBidCloseTime(data.auction.bid_close_time);
        setAuctionStatus(data.auction.status);
      } catch (err) {
        console.error('Failed to load auction', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, setRankings, setBidCloseTime, setAuctionStatus]);

  useEffect(() => {
    if (bidCloseTime && auction && bidCloseTime !== auction.bid_close_time) {
      showToast(`⏱️ Auction extended → closes at ${format(new Date(bidCloseTime), 'HH:mm:ss')}`, 'info');
    }
  }, [bidCloseTime]);

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    setBidLoading(true);
    try {
      const payload = {
        carrierName: bidForm.carrierName,
        freightCharges: parseFloat(bidForm.freightCharges),
        originCharges: parseFloat(bidForm.originCharges || '0'),
        destinationCharges: parseFloat(bidForm.destinationCharges || '0'),
        transitTimeDays: parseInt(bidForm.transitTimeDays),
        quoteValidityDays: parseInt(bidForm.quoteValidityDays),
      };
      const { data } = await api.post(`/auctions/${id}/bids`, payload);
      showToast(`✅ Bid submitted — Rank #${data.bid.rank}`, 'success');
      setBidForm((prev) => ({ ...prev, freightCharges: '', originCharges: '0', destinationCharges: '0' }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit bid', 'error');
    } finally {
      setBidLoading(false);
    }
  };

  if (loading || !auction) {
    return <div className="min-h-screen flex items-center justify-center text-surface-600">Loading...</div>;
  }

  const currentStatus = auctionStatus || auction.status;
  const currentCloseTime = bidCloseTime || auction.bid_close_time;
  const isClosed = currentStatus === 'CLOSED' || currentStatus === 'FORCE_CLOSED';
  const myRank = rankings.find((r) => r.supplier_id === user?.id)?.rank;

  const toastColors = {
    success: 'bg-success-500/20 border-success-500/30 text-success-400',
    error: 'bg-danger-500/20 border-danger-500/30 text-danger-400',
    info: 'bg-primary-500/20 border-primary-500/30 text-primary-400',
  };

  return (
    <div className="min-h-screen">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl border shadow-2xl animate-fade-in ${toastColors[toast.type]}`}>
          {toast.msg}
        </div>
      )}

      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions')} className="p-2 rounded-lg hover:bg-surface-50 transition-colors text-surface-600 hover:text-surface-900">← Back</button>
            <div>
              <h1 className="text-lg font-semibold text-surface-900">{auction.rfq_name}</h1>
              <p className="text-xs text-surface-600 font-mono">{auction.rfq_reference_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {myRank && (
              <div className={`px-4 py-2 rounded-xl font-bold text-lg ${
                myRank === 1 ? 'bg-primary-600 text-amber-400' : 'bg-surface-50 text-surface-600'
              }`}>
                You are L{myRank}
              </div>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${isClosed ? 'bg-danger-500/20 text-danger-400' : 'bg-success-500/20 text-success-400'}`}>
              {currentStatus}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="glass-card p-5">
            <Countdown targetTime={currentCloseTime} triggerWindowMinutes={auction.trigger_window_minutes} label="Bid Close" />
          </div>
          <div className="glass-card p-5">
            <Countdown targetTime={auction.forced_close_time} label="Forced Close (Immutable)" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">📊 Live Rankings</h2>
            <RankingTable rankings={rankings} currentUserId={user?.id} showSupplierDetails={true} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">💰 Submit Bid</h2>
            <div className="glass-card p-6">
              {isClosed ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="text-surface-600 font-medium">Bidding is closed</p>
                </div>
              ) : currentStatus === 'PENDING' ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">⏳</div>
                  <p className="text-surface-600 font-medium">Auction hasn't started</p>
                </div>
              ) : (
                <form onSubmit={handleBidSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Carrier</label>
                    <input type="text" value={bidForm.carrierName} onChange={(e) => setBidForm((p) => ({ ...p, carrierName: e.target.value }))} required
                      className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" placeholder="Carrier name" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Freight (₹)</label>
                    <input type="number" step="0.01" min="0" value={bidForm.freightCharges} onChange={(e) => setBidForm((p) => ({ ...p, freightCharges: e.target.value }))} required
                      className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" placeholder="0.00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Origin (₹)</label>
                      <input type="number" step="0.01" min="0" value={bidForm.originCharges} onChange={(e) => setBidForm((p) => ({ ...p, originCharges: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Dest. (₹)</label>
                      <input type="number" step="0.01" min="0" value={bidForm.destinationCharges} onChange={(e) => setBidForm((p) => ({ ...p, destinationCharges: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Transit (days)</label>
                      <input type="number" min="1" value={bidForm.transitTimeDays} onChange={(e) => setBidForm((p) => ({ ...p, transitTimeDays: e.target.value }))} required
                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1">Validity (days)</label>
                      <input type="number" min="1" value={bidForm.quoteValidityDays} onChange={(e) => setBidForm((p) => ({ ...p, quoteValidityDays: e.target.value }))} required
                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-surface-200 text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                    </div>
                  </div>
                  <button type="submit" disabled={bidLoading}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 shadow-lg shadow-primary-600/20">
                    {bidLoading ? 'Submitting...' : '🚀 Submit Bid'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
