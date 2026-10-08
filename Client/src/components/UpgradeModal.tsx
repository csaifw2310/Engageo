import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, Zap, ArrowRight, Crown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeInfo {
  resource?: string;
  used?: number;
  limit?: number;
  plan?: string;
  message?: string;
}

interface UpgradeModalCtx {
  showUpgrade: (info?: UpgradeInfo) => void;
  hideUpgrade: () => void;
}

const UpgradeCtx = createContext<UpgradeModalCtx | null>(null);

export function useUpgradeModal() {
  const ctx = useContext(UpgradeCtx);
  if (!ctx) throw new Error('useUpgradeModal must be within UpgradeModalProvider');
  return ctx;
}

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<UpgradeInfo>({});
  const navigate = useNavigate();

  const showUpgrade = useCallback((i?: UpgradeInfo) => {
    setInfo(i ?? {});
    setVisible(true);
  }, []);

  const hideUpgrade = useCallback(() => setVisible(false), []);

  const handleUpgrade = () => {
    hideUpgrade();
    navigate('/billing');
  };

  const resourceLabel = (r?: string) => {
    switch (r) {
      case 'campaign': return 'campaigns';
      case 'contact': return 'contacts';
      case 'message': return 'messages';
      default: return 'features';
    }
  };

  return (
    <UpgradeCtx.Provider value={{ showUpgrade, hideUpgrade }}>
      {children}
      {visible && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={hideUpgrade}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.9) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
            <div className="p-6 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-950/50">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Plan Limit Reached</h2>
                  <p className="text-sm text-zinc-500">Upgrade to continue</p>
                </div>
              </div>
              <button onClick={hideUpgrade} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="px-6 pb-4">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 mb-4">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {info.message || `You've reached the ${resourceLabel(info.resource)} limit on your current ${info.plan || 'free'} plan.`}
                </p>
                {info.used !== undefined && info.limit !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                      <span>Current usage</span>
                      <span className="font-medium text-red-400">{info.used} / {info.limit} {resourceLabel(info.resource)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                        style={{ width: `${Math.min((info.used / info.limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-2">
                {[
                  'Unlimited campaigns and messages',
                  'Advanced analytics and reporting',
                  'Priority customer support',
                  'Full API access',
                ].map(b => (
                  <div key={b} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    </div>
                    <span className="text-sm text-zinc-400">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 pt-2 flex gap-3">
              <button onClick={hideUpgrade} className="btn btn-secondary btn-sm flex-1">
                Maybe later
              </button>
              <button
                onClick={handleUpgrade}
                className="btn btn-sm flex-1 font-semibold text-zinc-950"
                style={{ background: 'linear-gradient(135deg, #facc15, #f97316)', border: 'none' }}
              >
                <Zap className="w-4 h-4" />
                Upgrade Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </UpgradeCtx.Provider>
  );
}