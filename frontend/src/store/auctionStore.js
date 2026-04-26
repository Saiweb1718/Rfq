import { create } from 'zustand';

export const useAuctionStore = create((set) => ({
  user: (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  rankings: [],
  setRankings: (rankings) => set({ rankings }),
  bidCloseTime: null,
  setBidCloseTime: (time) => set({ bidCloseTime: time }),
  auctionStatus: null,
  setAuctionStatus: (status) => set({ auctionStatus: status }),
}));
