import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuctionStore } from './store/auctionStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateRFQ from './pages/CreateRFQ';
import AuctionList from './pages/AuctionList';
import AuctionDetail from './pages/AuctionDetail';
import BidRoom from './pages/BidRoom';

function ProtectedRoute({ children }) {
  const { token } = useAuctionStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/rfqs/create" element={<ProtectedRoute><CreateRFQ /></ProtectedRoute>} />
        <Route path="/auctions" element={<ProtectedRoute><AuctionList /></ProtectedRoute>} />
        <Route path="/auctions/:id" element={<ProtectedRoute><AuctionDetail /></ProtectedRoute>} />
        <Route path="/auctions/:id/bid" element={<ProtectedRoute><BidRoom /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
