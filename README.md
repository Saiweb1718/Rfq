# RFQ British Auction System

A real-time auction platform where buyers create RFQs and sellers place competitive bids with automatic time extensions and fair closing rules. It eliminates manual procurement inefficiencies by enforcing transparent bidding and dynamic extension windows.

## 🚀 Key Features

- **Real-Time Bidding**: WebSockets power instant updates for countdown timers, leaderboards, and bid ranks.
- **Dynamic Time Extensions**: Automatic extension windows prevent last-second bid sniping.
- **Strict Forced Close**: Guarantees fairness by hard-closing auctions at predefined limits.
- **Concurrent Bidding Engine**: Transactions and locking ensure robust handling of simultaneous bids.

## 🏗️ Architecture

The system follows a client-server architecture where the React frontend communicates with a Node.js backend via REST APIs and WebSockets for real-time bidding updates. PostgreSQL ensures transactional consistency for auctions and bids.



## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Real-Time & APIs:** Socket.io-client, Axios

### Backend
- **Environment:** Node.js + Express
- **Database:** PostgreSQL (pg)
- **Real-Time Server:** Socket.io
- **Task Scheduling:** Node-Cron
- **Validation:** Zod

## ⚙️ Critical Backend Logic

Bids are inserted using transactional queries and optimistic concurrency locking to prevent race conditions. The system ensures that only valid bids that respect time extension triggers and forced close rules are accepted, maintaining absolute consistency under concurrent high-frequency requests.

### Core API Endpoints
- `POST /api/rfqs` - Create a new RFQ
- `POST /api/auctions` - Launch an auction from an RFQ
- `GET /api/auctions/:id` - Retrieve auction details and leaderboard
- `POST /api/auctions/:id/bids` - Submit a competitive bid

## 🗄️ Database Schema

The core database is heavily normalized and optimized for transactions.

- **`auctions`**: The core entity storing bidding schedules, status, and extension rules.
- **`bids`**: Linked to auctions, stores supplier quotes and dynamically calculated ranks.
- **`rfqs`**: The base request detailing the shipment requirements.
- **`users`**: Contains credentials and roles for both buyers and suppliers.
- **`auction_logs`**: Provides an immutable audit trail for system events like extensions and closures.



## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Saiweb1718/Rfq.git
   cd Rfq
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   # Configure your .env file with DATABASE_URL and JWT_SECRET
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   # Configure your .env.local with VITE_API_URL and VITE_SOCKET_URL
   npm run dev
   ```

## 🤝 Design Decisions

- **PostgreSQL**: Chosen for transactional consistency and ACID compliance required for bidding logic.
- **Node.js / Express**: Efficiently handles asynchronous I/O and concurrent WebSocket connections.
- **WebSockets (Socket.io)**: Provides real-time synchronization for live bids and leaderboard ranking without the overhead of HTTP polling.
