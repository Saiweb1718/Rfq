import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuctionStore } from '../store/auctionStore';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuctionStore();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister
        ? { email, password, role, companyName }
        : { email, password };

      const { data } = await api.post(endpoint, payload);
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4 shadow-lg shadow-primary-500/20">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-600">
            RFQ Auction
          </h1>
          <p className="text-surface-600 mt-2">British Auction Bidding System</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex rounded-xl bg-white p-1 mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isRegister ? 'bg-primary-600 text-white shadow-lg' : 'text-surface-600 hover:text-surface-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isRegister ? 'bg-primary-600 text-white shadow-lg' : 'text-surface-600 hover:text-surface-600'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                placeholder="you@company.com" />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                placeholder="••••••••" />
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Role</label>
                  <div className="flex gap-3">
                    {['buyer', 'supplier'].map((r) => (
                      <button key={r} type="button" onClick={() => setRole(r)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                          role === r
                            ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                            : 'bg-white border-surface-200 text-surface-600 hover:border-surface-400'
                        }`}
                      >
                        {r === 'buyer' ? '🏢 Buyer' : '🚛 Supplier'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-surface-600 mb-1.5">Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                    className="w-full px-4 py-3 rounded-xl bg-white border border-surface-200 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                    placeholder="Your Company Inc." />
                </div>
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
