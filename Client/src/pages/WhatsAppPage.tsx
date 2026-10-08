import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, Settings, ArrowRight, Loader2 } from 'lucide-react';
import { whatsappApi } from '../api/services';
import { useApiData } from '../hooks/useApiData';

export function WhatsAppPage() {
  const navigate = useNavigate();

  const { data: statusRes, loading } = useApiData(
    () => whatsappApi.getStatus(),
    []
  );

  const isConnected =
    (statusRes?.data?.status ?? 'disconnected') === 'connected';

  // ✅ Redirect after render instead of during render
  useEffect(() => {
    if (isConnected) {
      navigate('/conversations', { replace: true });
    }
  }, [isConnected, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  // While redirecting
  if (isConnected) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-4 flex flex-col items-center text-center animate-in">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-zinc-700"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>

        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center">
          <WifiOff className="w-3 h-3 text-zinc-500" />
        </div>
      </div>

      <h1 className="text-xl font-semibold mb-2">
        WhatsApp not connected
      </h1>

      <p className="text-sm text-zinc-500 leading-relaxed mb-2">
        Your WhatsApp Business account isn't linked yet. Connect it to start
        sending messages, managing conversations, and running campaigns.
      </p>

      <p className="text-xs text-zinc-600 mb-8">
        You'll need a Meta Business Manager account and a dedicated WhatsApp
        Business number.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate('/settings?tab=whatsapp')}
          className="btn btn-primary w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Connect WhatsApp
          </span>

          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-zinc-600 text-center">
          You can also connect via{' '}
          <button
            onClick={() => navigate('/settings?tab=whatsapp')}
            className="text-zinc-400 underline underline-offset-2 hover:text-zinc-300"
          >
            Settings → WhatsApp
          </button>
        </p>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3 w-full max-w-sm">
        {[
          { icon: '💬', title: 'Inbox', desc: 'Two-way conversations' },
          { icon: '📢', title: 'Campaigns', desc: 'Bulk messaging' },
          { icon: '📊', title: 'Analytics', desc: 'Delivery tracking' },
        ].map((f) => (
          <div
            key={f.title}
            className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center"
          >
            <span className="text-lg block mb-1">{f.icon}</span>
            <p className="text-xs font-medium">{f.title}</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}