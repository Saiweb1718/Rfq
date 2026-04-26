import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import { useAuctionStore } from '../store/auctionStore';
import Countdown from '../components/Countdown';

const statusColors = {
  PENDING: 'bg-surface-50 text-surface-600',
  ACTIVE: 'bg-success-500/20 text-success-400',
  CLOSED: 'bg-surface-50 text-surface-600',
  FORCE_CLOSED: 'bg-danger-500/20 text-danger-400',
};

export default function AuctionList() {
  const navigate = useNavigate();
  const { user } = useAuctionStore();
  const [auctions, setAuctions] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = filter ? { status: filter } : {};
        const { data } = await api.get('/auctions', { params });
        setAuctions(data);
      } catch (err) {
        console.error('Failed to load auctions', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  const handleRowClick = (auction) => {
    if (user?.role === 'buyer') {
      navigate(`/auctions/${auction.id}`);
    } else {
      navigate(`/auctions/${auction.id}/bid`);
    }
  };

  const filters = ['', 'ACTIVE', 'PENDING', 'CLOSED', 'FORCE_CLOSED'];

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-surface-50 transition-colors text-surface-600 hover:text-surface-900">← Back</button>
            <h1 className="text-lg font-semibold text-surface-900">Auctions</h1>
          </div>
          {user?.role === 'buyer' && (
            <button onClick={() => navigate('/rfqs/create')}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20">
              + New RFQ
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map((f) => (
            <button key={f || 'all'} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-white text-surface-600 hover:text-surface-900 hover:bg-surface-50'
              }`}>
              {f || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-surface-600">Loading...</div>
        ) : auctions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-surface-600 text-lg">No auctions found</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-surface-600">RFQ</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-surface-600">Reference</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-surface-600">L1 Bid</th>
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Bid Start</th>
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Bid Close</th>
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Forced Close</th>
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Timer</th>
                  </tr>
                </thead>
                <tbody>
                  {auctions.map((a, i) => (
                    <tr key={a.id} onClick={() => handleRowClick(a)}
                      className="border-b border-surface-200 hover:bg-surface-50 cursor-pointer transition-colors animate-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="px-4 py-4 font-medium text-surface-900">{a.rfq_name}</td>
                      <td className="px-4 py-4 text-surface-600 font-mono text-xs">{a.rfq_reference_id}</td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {a.l1_bid ? <span className="text-success-400 font-semibold">{fmt(a.l1_bid)}</span> : <span className="text-surface-600">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center text-surface-600 text-xs tabular-nums">{format(new Date(a.bid_start_time), 'dd MMM HH:mm')}</td>
                      <td className="px-4 py-4 text-center text-surface-600 text-xs tabular-nums">{format(new Date(a.bid_close_time), 'dd MMM HH:mm')}</td>
                      <td className="px-4 py-4 text-center text-surface-600 text-xs tabular-nums">{format(new Date(a.forced_close_time), 'dd MMM HH:mm')}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[a.status] || ''}`}>{a.status}</span>
                      </td>
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {a.status === 'ACTIVE' && <Countdown targetTime={a.bid_close_time} className="scale-75" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
