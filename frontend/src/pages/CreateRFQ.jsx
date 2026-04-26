import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', referenceId: '', pickupDate: '',
    bidStartTime: '', bidCloseTime: '', forcedCloseTime: '',
    triggerWindowMinutes: 15, extensionDurationMinutes: 5,
    extensionTriggerType: 'BID_RECEIVED',
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const nowStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  }, []);
  const todayStr = useMemo(() => nowStr.slice(0, 10), [nowStr]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const close = new Date(form.bidCloseTime);
    const forced = new Date(form.forcedCloseTime);
    const start = new Date(form.bidStartTime);
    const now = new Date();
    if (start < now) { setError('Bid start time cannot be in the past'); return; }
    if (close <= start) { setError('Bid close time must be after start time'); return; }
    if (forced <= close) { setError('Forced close time must be after bid close time'); return; }

    setLoading(true);
    try {
      const payload = {
        ...form,
        bidStartTime: start.toISOString(),
        bidCloseTime: close.toISOString(),
        forcedCloseTime: forced.toISOString(),
      };
      await api.post('/rfqs', payload);
      navigate('/auctions');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create RFQ');
    } finally {
      setLoading(false);
    }
  };

  const triggerTypes = [
    { value: 'BID_RECEIVED', label: 'Any bid received', desc: 'Extend whenever a bid is placed in the trigger window' },
    { value: 'ANY_RANK_CHANGE', label: 'Any rank change', desc: 'Extend when any ranking position changes' },
    { value: 'L1_RANK_CHANGE', label: 'L1 rank change', desc: 'Extend only when the lowest bidder changes' },
  ];

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-surface-50 transition-colors text-surface-600 hover:text-surface-900">← Back</button>
          <h1 className="text-lg font-semibold text-surface-900">Create RFQ</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-sm">1</span>
              RFQ Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">RFQ Name</label>
                <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  placeholder="Mumbai → Delhi Shipment" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Reference ID</label>
                <input type="text" value={form.referenceId} onChange={(e) => update('referenceId', e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  placeholder="RFQ-2026-001" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Pickup Date</label>
                <input type="date" value={form.pickupDate} onChange={(e) => update('pickupDate', e.target.value)} required min={todayStr}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center text-sm">2</span>
              British Auction Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Bid Start Time</label>
                <input type="datetime-local" value={form.bidStartTime} onChange={(e) => update('bidStartTime', e.target.value)} required min={nowStr}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Bid Close Time</label>
                <input type="datetime-local" value={form.bidCloseTime} onChange={(e) => update('bidCloseTime', e.target.value)} required min={form.bidStartTime || nowStr}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Forced Close Time <span className="text-danger-400">*</span></label>
                <input type="datetime-local" value={form.forcedCloseTime} onChange={(e) => update('forcedCloseTime', e.target.value)} required min={form.bidCloseTime || nowStr}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                <p className="text-xs text-surface-600 mt-1">Immutable ceiling — auction ends here no matter what</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Trigger Window (X minutes)</label>
                <input type="number" value={form.triggerWindowMinutes} onChange={(e) => update('triggerWindowMinutes', parseInt(e.target.value) || 0)} min={1} required
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                <p className="text-xs text-surface-600 mt-1">Bids in last X minutes before close can trigger extensions</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Extension Duration (Y minutes)</label>
                <input type="number" value={form.extensionDurationMinutes} onChange={(e) => update('extensionDurationMinutes', parseInt(e.target.value) || 0)} min={1} required
                  className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" />
                <p className="text-xs text-surface-600 mt-1">How much time is added when the trigger fires</p>
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-surface-600 mb-3">Extension Trigger Type</label>
              <div className="space-y-2">
                {triggerTypes.map((t) => (
                  <label key={t.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      form.extensionTriggerType === t.value
                        ? 'bg-primary-600/10 border-primary-500/50'
                        : 'bg-white border-surface-200 hover:border-surface-400'
                    }`}>
                    <input type="radio" name="triggerType" value={t.value}
                      checked={form.extensionTriggerType === t.value}
                      onChange={(e) => update('extensionTriggerType', e.target.value)}
                      className="mt-1 accent-primary-500" />
                    <div>
                      <p className="font-medium text-surface-900">{t.label}</p>
                      <p className="text-xs text-surface-600 mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-fade-in">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl bg-primary-600 text-white font-semibold text-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all disabled:opacity-50 shadow-lg shadow-primary-600/20">
            {loading ? 'Creating...' : '🚀 Create RFQ & Start Auction'}
          </button>
        </form>
      </div>
    </div>
  );
}
