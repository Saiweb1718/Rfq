export default function RankingTable({
  rankings,
  currentUserId,
  showSupplierDetails = true,
}) {
  if (rankings.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-surface-600">No bids submitted yet</p>
      </div>
    );
  }

  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-surface-600">Rank</th>
              {showSupplierDetails && (
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-surface-600">Supplier</th>
              )}
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-surface-600">Carrier</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-surface-600">Freight</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-surface-600">Origin</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-surface-600">Dest.</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-surface-600 font-semibold">Total</th>
              <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Transit</th>
              <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-surface-600">Validity</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((bid, i) => {
              const isCurrentUser = bid.supplier_id === currentUserId;
              const isL1 = bid.rank === 1;

              return (
                <tr
                  key={bid.id}
                  className={`
                    border-b border-surface-200 transition-all duration-200
                    ${isCurrentUser ? 'bg-primary-600/15 border-l-2 border-l-primary-500' : ''}
                    ${isL1 ? 'bg-success-500/5' : ''}
                    hover:bg-surface-50
                    animate-fade-in
                  `}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isL1 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-surface-900 font-bold text-xs shadow-lg">
                          L1
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-50 text-surface-600 font-medium text-xs">
                          {bid.rank}
                        </span>
                      )}
                    </div>
                  </td>
                  {showSupplierDetails && (
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isCurrentUser ? 'text-primary-400' : 'text-surface-900'}`}>
                        {bid.company_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded-full">You</span>
                        )}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-surface-600">{bid.carrier_name}</td>
                  <td className="px-4 py-3 text-right text-surface-600 tabular-nums">{fmt(bid.freight_charges)}</td>
                  <td className="px-4 py-3 text-right text-surface-600 tabular-nums">{fmt(bid.origin_charges)}</td>
                  <td className="px-4 py-3 text-right text-surface-600 tabular-nums">{fmt(bid.destination_charges)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    <span className={isL1 ? 'text-success-400' : 'text-surface-900'}>{fmt(bid.total_charges)}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-surface-600">{bid.transit_time_days}d</td>
                  <td className="px-4 py-3 text-center text-surface-600">{bid.quote_validity_days}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
