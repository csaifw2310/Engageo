import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  X,
  Check,
  FolderOpen,
  Trash2,
  Loader2,
  AlertCircle,
  Users,
  Pencil,
  Search,
} from "lucide-react";
import {
  groupsApi,
  contactsApi,
  type ApiGroup,
  type ApiContact,
} from "../api/resources";
import { useApiData, getApiErrorMessage } from "../hooks/useApiData";
import ManageMembersModal from "../components/groups/ManageMembersModal";

// Shape returned by GET /groups/:id. The member list has been observed under
// both `contacts` and `members` keys, so both are handled explicitly instead
// of casting the response to `any`.

function validateGroupName(name: string): string {
  if (!name.trim()) return "Group name is required";
  if (name.trim().length < 2) return "Group name must be at least 2 characters";
  if (name.trim().length > 100) return "Group name too long (max 100 characters)";
  return "";
}

/**
 * Converts backend error payloads into a readable message instead of the
 * generic top-level "Validation failed". Handles the common validation
 * shapes seen in this codebase:
 *   { message, errors: [{ field, message }] }
 *   { message, errors: { field: "message" } }
 *   { errors: ["msg", ...] }
 * Falls back to the existing getApiErrorMessage() for anything else, so this
 * is purely additive and never regresses current behavior.
 */
function extractErrorMessage(err: unknown): string {
  const payload = (err as any)?.response?.data ?? (err as any)?.data ?? err;
  const fieldErrors = payload?.errors;

  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    const msgs = fieldErrors
      .map((e: any) => (typeof e === "string" ? e : e?.message))
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join(" · ");
  }
  if (fieldErrors && typeof fieldErrors === "object" && !Array.isArray(fieldErrors)) {
    const msgs = Object.values(fieldErrors).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (msgs.length > 0) return msgs.join(" · ");
  }
  if (typeof payload?.message === "string" && payload.message !== "Validation failed") {
    return payload.message;
  }
  return getApiErrorMessage(err);
}

/** Locks page scroll while `locked` is true and restores it afterwards. */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}

/**
 * Shared modal shell used by both dialogs in this page. Fixed, full-viewport
 * backdrop with a high z-index and its own stacking context — this is what
 * actually fixes centering, overlay coverage, and the "button showing
 * through the modal" issue, instead of patching each modal separately.
 */
function ModalShell({
  onClose,
  widthClassName = "max-w-md",
  zIndexClassName = "z-[9999]",
  labelledBy,
  children,
}: {
  onClose: () => void;
  widthClassName?: string;
  zIndexClassName?: string;
  labelledBy: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Rendered via portal directly under <body>. This is deliberate, not a
  // style preference: if any ancestor in the page tree has a `transform`,
  // `filter`, `perspective`, or similar property (common on sticky/fixed
  // headers), it creates a CSS stacking/containing context that traps
  // `position: fixed` descendants — they end up positioned and clipped
  // relative to that ancestor instead of the real viewport. That's what was
  // causing the overlay to miss the header, the modal to sit off-center,
  // and page content to render on top of it. A portal escapes that
  // entirely, regardless of what the rest of the page does with CSS.
  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150`}
      onClick={onClose}
    >
      <div
        className={`w-full ${widthClassName} max-h-[85vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function GroupsPage() {
  const {
    data: res,
    loading,
    error,
    refetch,
  } = useApiData(() => groupsApi.list({ limit: 100 }), []);
  const groups = res?.data?.groups ?? [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const [managingGroup, setManagingGroup] = useState<ApiGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");


  // Create-modal contact picker. Kept separate from the Manage Members
  // contact state above rather than shared: Manage adds/removes members of
  // an already-created group one at a time, while this picks contacts
  // before the group exists yet (checkbox selection, applied only on
  // submit). They're different interactions over the same underlying data,
  // not the same piece of state.
  const [createContacts, setCreateContacts] = useState<ApiContact[]>([]);
  const [createContactsLoading, setCreateContactsLoading] = useState(false);
  const [createContactsError, setCreateContactsError] = useState("");
  const [createContactSearch, setCreateContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    new Set(),
  );

  useLockBodyScroll(showCreateModal || managingGroup !== null);

  // Shared by both the create-modal picker and the Manage Members modal so
  // the "fetch a page of contacts" logic exists in exactly one place.
  const fetchContactsPage = useCallback(async (): Promise<ApiContact[]> => {
    // Backend caps `limit` at 100 ("limit must be 1-100"); requesting more
    // fails validation on every call. If accounts can exceed 100 contacts,
    // this needs real server-side pagination — flagging rather than
    // guessing at undocumented page params.
    const res = await contactsApi.list({ limit: 100 });
    return res?.data?.contacts ?? [];
  }, []);

  const toggleSelectedContact = useCallback((id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateGroupName(formData.name);
    if (err) {
      setNameError(err);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (editingGroup) {
        await groupsApi.update(editingGroup._id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        closeModal();
        refetch();
        return;
      }

      const createRes = await groupsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      // The group is created at this point no matter what happens below, so
      // refresh the list now rather than only on the happy path.
      refetch();

      const newGroup =
        ((createRes?.data as any)?.group as ApiGroup | undefined) ??
        (createRes?.data as ApiGroup | undefined);

      if (selectedContactIds.size > 0 && newGroup?._id) {
        const results = await Promise.allSettled(
          Array.from(selectedContactIds).map((contactId) =>
            groupsApi.assignContact(newGroup._id, contactId),
          ),
        );
        const failedCount = results.filter(
          (r) => r.status === "rejected",
        ).length;

        if (failedCount > 0) {
          // The group and some members were saved successfully — closing
          // silently here would hide that. Surface it, and switch to edit
          // mode for this same group so a resubmit updates it instead of
          // creating a duplicate.
          setEditingGroup(newGroup);
          setSaveError(
            `Group created, but ${failedCount} of ${selectedContactIds.size} contact(s) couldn't be added. Use Manage Members to add them.`,
          );
          return;
        }
      }

      closeModal();
    } catch (err) {
      setSaveError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this group? Contacts will not be deleted."))
      return;
    if (!window.confirm("Are you absolutely sure? This cannot be undone."))
      return;
    try {
      await groupsApi.delete(id);
      refetch();
    } catch (err) {
      window.alert(extractErrorMessage(err));
    }
  };

  const openEditModal = (group: ApiGroup) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description || "" });
    setNameError("");
    setSaveError("");
    setShowCreateModal(true);
  };

  const openNewModal = useCallback(async () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
    setNameError("");
    setSaveError("");
    setSelectedContactIds(new Set());
    setCreateContactSearch("");
    setShowCreateModal(true);
    setCreateContactsLoading(true);
    setCreateContactsError("");
    try {
      const contacts = await fetchContactsPage();
      setCreateContacts(contacts);
    } catch (err) {
      setCreateContactsError(extractErrorMessage(err));
    } finally {
      setCreateContactsLoading(false);
    }
  }, [fetchContactsPage]);

  const closeModal = useCallback(() => {
    setShowCreateModal(false);
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
    setNameError("");
    setSaveError("");
    setSelectedContactIds(new Set());
    setCreateContactSearch("");
    setCreateContactsError("");
  }, []);

  // Opening the modal only records which group is open — ManageMembersModal
  // owns loading, searching and paging its own data. The page previously
  // prefetched one capped page of contacts here and diffed members in the
  // browser, which silently broke past that page size.
  const openManageModal = useCallback((group: ApiGroup) => {
    setManagingGroup(group);
  }, []);

  const closeManageModal = useCallback(() => {
    setManagingGroup(null);
  }, []);

  // Create-modal picker only. Client-side filtering is fine here because the
  // create flow deliberately shows a single page of contacts as a starting
  // selection; the full membership picker lives in ManageMembersModal.
  const createFilteredContacts = useMemo(() => {
    const q = createContactSearch.trim().toLowerCase();
    if (!q) return createContacts;
    return createContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [createContacts, createContactSearch]);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Groups</h1>
          <p className="text-sm text-zinc-500">
            {res?.data?.totalGroups ?? 0} groups
          </p>
        </div>
        <button onClick={openNewModal} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Create Group
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
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FolderOpen className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="empty-state-title">No groups yet</p>
          <p className="empty-state-description">
            Create groups to organize your contacts for targeted campaigns.
          </p>
          <button
            onClick={openNewModal}
            className="btn btn-secondary btn-sm mt-4"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div key={group._id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(group)}
                    className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                    aria-label={`Edit ${group.name}`}
                    title="Edit group"
                  >
                    <Pencil className="w-4 h-4 text-zinc-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(group._id)}
                    className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                    aria-label={`Delete ${group.name}`}
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-medium mb-1">{group.name}</h3>
              {group.description && (
                <p className="text-sm text-zinc-500 mb-3 line-clamp-2">
                  {group.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {group.contactCount ?? 0} contacts
                </p>
                <button
                  onClick={() => openManageModal(group)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <ModalShell
          onClose={closeModal}
          widthClassName="max-w-md"
          labelledBy="group-modal-title"
        >
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <h2 id="group-modal-title" className="text-lg font-medium">
              {editingGroup ? "Edit Group" : "Create Group"}
            </h2>
            <button
              onClick={closeModal}
              className="p-1 hover:bg-zinc-800 rounded-md"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="px-6 pb-6 space-y-4 overflow-y-auto"
          >
            {saveError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">
                {saveError}
              </div>
            )}
            <div>
              <label className="text-xs text-zinc-400">Group Name *</label>
              <input
                type="text"
                autoFocus
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (nameError) setNameError("");
                }}
                className={`input mt-1 ${nameError ? "border-red-500/50" : ""}`}
                placeholder="e.g. VIP Customers"
              />
              {nameError && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {nameError}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-400">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="input min-h-20 resize-none mt-1"
                placeholder="Optional description..."
              />
            </div>

            {!editingGroup && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">
                    Add Contacts (optional)
                  </label>
                  {selectedContactIds.size > 0 && (
                    <span className="text-xs text-zinc-500">
                      {selectedContactIds.size} selected
                    </span>
                  )}
                </div>
                <div className="mt-1 border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="relative p-2 border-b border-zinc-800">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={createContactSearch}
                      onChange={(e) => setCreateContactSearch(e.target.value)}
                      className="input text-xs py-1.5 pl-8 w-full"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {createContactsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                      </div>
                    ) : createContactsError ? (
                      <p className="p-3 text-xs text-red-400">
                        {createContactsError}
                      </p>
                    ) : createFilteredContacts.length === 0 ? (
                      <p className="p-3 text-xs text-zinc-500 text-center">
                        {createContactSearch
                          ? "No contacts match your search"
                          : "No contacts yet — add some on the Contacts page"}
                      </p>
                    ) : (
                      createFilteredContacts.map((c) => {
                        const checked = selectedContactIds.has(c._id);
                        return (
                          <label
                            key={c._id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/30 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectedContact(c._id)}
                              className="accent-emerald-500"
                            />
                            <div className="min-w-0">
                              <p className="text-sm truncate">{c.name}</p>
                              <p className="text-xs text-zinc-500 truncate">
                                {c.phone}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
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
                {editingGroup ? "Save Changes" : "Create Group"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Manage Members Modal — paging, search and bulk actions all live in
          the component; this page only owns which group is open. */}
      {managingGroup && (
        <ModalShell
          onClose={closeManageModal}
          widthClassName="max-w-4xl"
          labelledBy="manage-modal-title"
        >
          <ManageMembersModal
            group={managingGroup}
            onClose={closeManageModal}
            onChanged={refetch}
            extractErrorMessage={extractErrorMessage}
          />
        </ModalShell>
      )}
    </div>
  );
}