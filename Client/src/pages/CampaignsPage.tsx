import { useState } from "react";
import {
  Plus,
  X,
  Check,
  Megaphone,
  Trash2,
  Send,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { campaignsApi, templatesApi, groupsApi } from "../api/resources";
import { useApiData, getApiErrorMessage } from "../hooks/useApiData";

const statusBadge = (s: string) => {
  switch (s) {
    case "COMPLETED":
      return "badge-success";

    case "RUNNING":
      return "badge-info";

    case "SCHEDULED":
      return "badge-warning";

    case "FAILED":
      return "badge-error";

    case "CANCELLED":
      return "badge-error";

    case "DRAFT":
    default:
      return "badge-default";
  }
};

export function CampaignsPage() {
  const {
    data: res,
    loading,
    error,
    refetch,
  } = useApiData(() => campaignsApi.list({ limit: 50 }), []);
  const { data: templatesRes } = useApiData(
    () => templatesApi.list({ status: "approved", limit: 100 }),
    [],
  );
  const { data: groupsRes } = useApiData(
    () => groupsApi.list({ limit: 100 }),
    [],
  );

  const campaigns = res?.data?.campaigns ?? [];
  const templates = templatesRes?.data?.templates ?? [];
  const groups = groupsRes?.data?.groups ?? [];

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    templateId: "",
    audience: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNameError("Campaign name is required");
      return;
    }
    if (formData.name.trim().length < 2) {
      setNameError("Campaign name must be at least 2 characters");
      return;
    }
    if (!formData.templateId) {
      setSaveError("Please select a template");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await campaignsApi.create({
        name: formData.name.trim(),
        templateId: formData.templateId,
        groupIds: formData.audience,
      });
      setShowModal(false);
      setFormData({ name: "", templateId: "", audience: [] });
      setNameError("");
      refetch();
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async (id: string) => {
    try {
      await campaignsApi.launch(id);
      refetch();
    } catch {
      /* silent */
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this campaign?")) return;
    try {
      await campaignsApi.delete(id);
      refetch();
    } catch {
      /* silent */
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Campaigns</h1>
          <p className="text-sm text-zinc-500">
            {res?.data?.totalCampaigns ?? 0} campaigns
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
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
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Megaphone className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="empty-state-title">No campaigns yet</p>
          <p className="empty-state-description">
            Create your first campaign to send messages to your contacts.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-secondary btn-sm mt-4"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                  Campaign
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">
                  Recipients
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden lg:table-cell">
                  Delivered
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden lg:table-cell">
                  Read
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <Megaphone className="w-4 h-4 text-zinc-500" />
                      </div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                    {c.totalRecipients ?? 0}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">
                    {c.totalDelivered ?? 0}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">
                    {c.totalRead ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "DRAFT" && (
                        <button
                          onClick={() => handleLaunch(c._id)}
                          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                          title="Launch"
                        >
                          <Send className="w-4 h-4 text-zinc-500" />
                        </button>
                      )}
                      {(c.status === "DRAFT" || c.status === "CANCELLED") && (
                        <button
                          onClick={() => handleDelete(c._id)}
                          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-zinc-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="modal p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">New Campaign</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-zinc-800 rounded-md"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">
                  {saveError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Campaign Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (nameError) setNameError("");
                  }}
                  className={`input ${nameError ? "border-red-500/50" : ""}`}
                  placeholder="e.g. Summer Sale 2025"
                />
                {nameError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {nameError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Template *</label>
                <select
                  value={formData.templateId}
                  onChange={(e) =>
                    setFormData({ ...formData, templateId: e.target.value })
                  }
                  className="select w-full"
                  required
                >
                  <option value="">Select template</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-xs text-zinc-600">
                    No approved templates available.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">
                  Audience (groups)
                </label>
                <div className="space-y-1">
                  {groups.map((g) => (
                    <label
                      key={g._id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.audience.includes(g._id)}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            audience: e.target.checked
                              ? [...formData.audience, g._id]
                              : formData.audience.filter((id) => id !== g._id),
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{g.name}</span>
                      <span className="text-xs text-zinc-500">
                        ({g.contactCount} contacts)
                      </span>
                    </label>
                  ))}
                  {groups.length === 0 && (
                    <p className="text-xs text-zinc-600">
                      No groups available. Create groups to target.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
