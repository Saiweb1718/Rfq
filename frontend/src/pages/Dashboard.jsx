import { useNavigate } from 'react-router-dom';
import { useAuctionStore } from '../store/auctionStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuctionStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <span className="text-sm">⚡</span>
            </div>
            <span className="text-lg font-bold text-primary-600">
              RFQ Auction
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-surface-900">{user?.company_name}</p>
              <p className="text-xs text-surface-600">{user?.role === 'buyer' ? '🏢 Buyer' : '🚛 Supplier'}</p>
            </div>
            <button onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm text-surface-600 hover:text-surface-900 hover:bg-surface-50 transition-all">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-surface-900">Welcome back, {user?.company_name}</h1>
          <p className="text-surface-600 mt-1">
            {user?.role === 'buyer'
              ? 'Manage your RFQs and monitor live auctions'
              : 'Browse active auctions and submit competitive bids'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {user?.role === 'buyer' && (
            <button onClick={() => navigate('/rfqs/create')}
              className="glass-card p-6 text-left hover:bg-surface-50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="font-semibold text-surface-900 mb-1">Create RFQ</h3>
              <p className="text-sm text-surface-600">Set up a new auction with British Auction rules</p>
            </button>
          )}

          <button onClick={() => navigate('/auctions')}
            className="glass-card p-6 text-left hover:bg-surface-50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">🔨</span>
            </div>
            <h3 className="font-semibold text-surface-900 mb-1">Active Auctions</h3>
            <p className="text-sm text-surface-600">View and participate in live auctions</p>
          </button>

          <button onClick={() => navigate('/auctions')}
            className="glass-card p-6 text-left hover:bg-surface-50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-semibold text-surface-900 mb-1">All Auctions</h3>
            <p className="text-sm text-surface-600">Browse completed and upcoming auctions</p>
          </button>
        </div>
      </div>
    </div>
  );
}
