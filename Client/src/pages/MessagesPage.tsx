import { useState } from "react";
import {
  Megaphone,
  Search,
  Loader2,
  AlertCircle,
  CheckCheck,
  Check,
  Clock,
  XCircle,
} from "lucide-react";
import { messagesApi, campaignsApi } from "../api/resources";
import { useApiData } from "../hooks/useApiData";

// Campaign Delivery Tracker — shows ONLY campaign messages (outbound, has campaignId)
// with their delivery status.

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "read":
      return <CheckCheck className="w-4 h-4 text-blue-400" />;
    case "delivered":
      return <CheckCheck className="w-4 h-4 text-zinc-400" />;
    case "sent":
      return <Check className="w-4 h-4 text-zinc-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    case "pending":
    case "queued":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    default:
      return <Clock className="w-4 h-4 text-zinc-600" />;
  }
};

const statusBadge = (s: string) => {
  switch (s) {
    case "read":
      return "badge-success";
    case "delivered":
      return "badge-info";
    case "sent":
      return "badge-default";
    case "failed":
      return "badge-error";
    case "pending":
    case "queued":
      return "badge-warning";
    default:
      return "badge-default";
  }
};

export function MessagesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");

  const {
    data: res,
    loading,
    error,
  } = useApiData(
    () =>
      messagesApi.list({
        page,
        limit: 25,
        search: search || undefined,
        status: statusFilter || undefined,
        campaignId: campaignFilter || undefined,
      }),
    [page, search, statusFilter, campaignFilter],
  );

  const { data: campaignsRes } = useApiData(
    () => campaignsApi.list({ limit: 100 }),
    [],
  );
  const campaigns = campaignsRes?.data?.campaigns ?? [];

  // Show only campaign messages (have campaignId) — or all if no filter
  const messages = (res?.data?.messages ?? []).filter((m) =>
    campaignFilter ? true : !!m.campaignId,
  );
  const pagination = res?.data;

  // Stats summary
  const totalShown = messages.length;
  const deliveredCount = messages.filter(
    (m) => m.status === "delivered" || m.status === "read",
  ).length;
  const readCount = messages.filter((m) => m.status === "read").length;
  const failedCount = messages.filter((m) => m.status === "failed").length;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-zinc-400" />
            <h1 className="text-xl font-medium">Campaign Delivery</h1>
          </div>
          <p className="text-sm text-zinc-500">
            Track message delivery status across your campaigns
          </p>
        </div>
      </div>

      {/* Stats Row */}
      {!loading && messages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: totalShown, color: "text-white" },
            {
              label: "Delivered",
              value: deliveredCount,
              color: "text-blue-400",
            },
            { label: "Read", value: readCount, color: "text-emerald-400" },
            { label: "Failed", value: failedCount, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-9"
          />
        </div>
        <select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setPage(1);
          }}
          className="select"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="select"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Megaphone className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="empty-state-title">No campaign messages found</p>
          <p className="empty-state-description">
            {search || statusFilter || campaignFilter
              ? "Try adjusting your filters."
              : "Messages sent from campaigns will appear here with their delivery status."}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Recipient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">
                    Campaign
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg._id} className="table-row">
                    {/* Recipient */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {msg.contactName || "Unknown Contact"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {msg.phone || "No phone"}
                        </p>
                      </div>
                    </td>

                    {/* Campaign */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-zinc-300">
                        {msg.campaignName ||
                          campaigns.find((c) => c._id === msg.campaignId)
                            ?.name ||
                          "—"}
                      </span>
                    </td>

                    {/* Delivery */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={msg.status} />
                        <span className={`badge ${statusBadge(msg.status)}`}>
                          {msg.status}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">
                      {new Date(msg.createdAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">
                Page {pagination.currentPage} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn btn-secondary btn-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn btn-secondary btn-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
