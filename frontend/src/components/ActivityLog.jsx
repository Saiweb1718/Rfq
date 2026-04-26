import { format } from 'date-fns';

const eventConfig = {
  AUCTION_OPENED:       { icon: '🚀', color: 'text-success-400' },
  BID_SUBMITTED:        { icon: '💰', color: 'text-primary-400' },
  AUCTION_EXTENDED:     { icon: '⏱️', color: 'text-warning-400' },
  AUCTION_CLOSED:       { icon: '🔒', color: 'text-surface-600' },
  AUCTION_FORCE_CLOSED: { icon: '⛔', color: 'text-danger-400' },
};

export default function ActivityLog({ logs, className = '' }) {
  if (logs.length === 0) {
    return (
      <div className={`glass-card p-6 text-center ${className}`}>
        <p className="text-surface-600">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={`glass-card p-4 ${className}`}>
      <div className="space-y-1">
        {logs.map((log, i) => {
          const config = eventConfig[log.event_type] || { icon: '📋', color: 'text-surface-600' };

          return (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors animate-slide-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-lg mt-0.5 shrink-0">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${config.color}`}>
                    {log.event_type.replace(/_/g, ' ')}
                  </span>
                  {log.actor_name && (
                    <span className="text-xs text-surface-600">by {log.actor_name}</span>
                  )}
                </div>
                <p className="text-sm text-surface-600 mt-0.5">{log.description}</p>
                {log.old_close_time && log.new_close_time && (
                  <p className="text-xs text-warning-400/70 mt-1">
                    {format(new Date(log.old_close_time), 'HH:mm:ss')} →{' '}
                    {format(new Date(log.new_close_time), 'HH:mm:ss')}
                  </p>
                )}
              </div>
              <span className="text-xs text-surface-600 shrink-0 tabular-nums">
                {format(new Date(log.created_at), 'HH:mm:ss')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
