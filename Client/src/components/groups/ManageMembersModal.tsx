import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Search,
  Users,
  UserMinus,
  UserPlus,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  groupsApi,
  type ApiContact,
  type ApiGroup,
} from "../../api/resources";


const PAGE_SIZE = 50;

type Pane = "members" | "available";

interface PaneState {
  rows: ApiContact[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
}

const emptyPane: PaneState = {
  rows: [],
  total: 0,
  page: 1,
  totalPages: 0,
  loading: true,
  loadingMore: false,
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ManageMembersModal({
  group,
  onClose,
  onChanged,
  extractErrorMessage,
}: {
  group: ApiGroup;
  onClose: () => void;
  /** Called after any successful mutation so the group list can refetch. */
  onChanged: () => void;
  extractErrorMessage: (err: unknown) => string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [availableSearch, setAvailableSearch] = useState("");
  const debouncedMemberSearch = useDebounced(memberSearch);
  const debouncedAvailableSearch = useDebounced(availableSearch);

  const [members, setMembers] = useState<PaneState>(emptyPane);
  const [available, setAvailable] = useState<PaneState>(emptyPane);

  const [memberSel, setMemberSel] = useState<Set<string>>(new Set());
  const [availableSel, setAvailableSel] = useState<Set<string>>(new Set());
  const [memberSelectAll, setMemberSelectAll] = useState(false);
  const [availableSelectAll, setAvailableSelectAll] = useState(false);

  // Guards against a slow response for an old search overwriting a newer one.
  const reqId = useRef({ members: 0, available: 0 });

  const load = useCallback(
    async (pane: Pane, search: string, page: number) => {
      const id = ++reqId.current[pane];
      const setPane = pane === "members" ? setMembers : setAvailable;

      setPane((p) => ({
        ...p,
        loading: page === 1,
        loadingMore: page > 1,
      }));

      try {
        const call =
          pane === "members" ? groupsApi.members : groupsApi.availableContacts;
        const res = await call(group._id, {
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (id !== reqId.current[pane]) return; // superseded

        const d = res.data;
        setPane((prev) => ({
          rows: page === 1 ? d.contacts : [...prev.rows, ...d.contacts],
          total: d.totalContacts,
          page: d.currentPage,
          totalPages: d.totalPages,
          loading: false,
          loadingMore: false,
        }));
      } catch (err) {
        if (id !== reqId.current[pane]) return;
        setError(extractErrorMessage(err));
        setPane((p) => ({ ...p, loading: false, loadingMore: false }));
      }
    },
    [group._id, extractErrorMessage],
  );

  // Reload a pane from page 1 whenever its search changes. Selections are
  // dropped because "select all matching" is scoped to the search that
  // produced it — carrying it across a new search would act on rows the user
  // never saw.
  useEffect(() => {
    setMemberSel(new Set());
    setMemberSelectAll(false);
    load("members", debouncedMemberSearch, 1);
  }, [debouncedMemberSearch, load]);

  useEffect(() => {
    setAvailableSel(new Set());
    setAvailableSelectAll(false);
    load("available", debouncedAvailableSearch, 1);
  }, [debouncedAvailableSearch, load]);

  const refreshBoth = useCallback(() => {
    setMemberSel(new Set());
    setAvailableSel(new Set());
    setMemberSelectAll(false);
    setAvailableSelectAll(false);
    load("members", debouncedMemberSearch, 1);
    load("available", debouncedAvailableSearch, 1);
    onChanged();
  }, [load, debouncedMemberSearch, debouncedAvailableSearch, onChanged]);

  const toggle = (pane: Pane, id: string) => {
    const [sel, setSel, setAll] =
      pane === "members"
        ? ([memberSel, setMemberSel, setMemberSelectAll] as const)
        : ([availableSel, setAvailableSel, setAvailableSelectAll] as const);

    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
    // Any manual change invalidates "everything matching".
    setAll(false);
  };

  const selectedCount = (pane: Pane) => {
    if (pane === "members") {
      return memberSelectAll ? members.total : memberSel.size;
    }
    return availableSelectAll ? available.total : availableSel.size;
  };

  const runBulk = async (pane: Pane) => {
    const count = selectedCount(pane);
    if (count === 0 || busy) return;

    setBusy(true);
    setError("");
    try {
      if (pane === "available") {
        const payload = availableSelectAll
          ? { all: true, search: debouncedAvailableSearch || undefined }
          : { contactIds: [...availableSel] };
        const res = await groupsApi.addMembers(group._id, payload);
        const { added, skipped } = res.data;
        if (added === 0 && skipped > 0) {
          setError("Those contacts are already members.");
        }
      } else {
        const payload = memberSelectAll
          ? { all: true, search: debouncedMemberSearch || undefined }
          : { contactIds: [...memberSel] };
        await groupsApi.removeMembers(group._id, payload);
      }
      refreshBoth();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const renderPane = (pane: Pane) => {
    const state = pane === "members" ? members : available;
    const sel = pane === "members" ? memberSel : availableSel;
    const selectAll =
      pane === "members" ? memberSelectAll : availableSelectAll;
    const setSelectAll =
      pane === "members" ? setMemberSelectAll : setAvailableSelectAll;
    const search = pane === "members" ? memberSearch : availableSearch;
    const setSearch = pane === "members" ? setMemberSearch : setAvailableSearch;
    const debounced =
      pane === "members" ? debouncedMemberSearch : debouncedAvailableSearch;

    const isMembers = pane === "members";
    const chosen = selectedCount(pane);
    const pageAllChosen =
      state.rows.length > 0 && state.rows.every((c) => sel.has(c._id));

    return (
      <div className="flex flex-col min-h-0 border-b sm:border-b-0 border-zinc-800">
        <div className="px-3 py-2 border-b border-zinc-800 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {isMembers ? "Members" : "Add contacts"} ({state.total})
            </p>
            {chosen > 0 && (
              <button
                onClick={() => runBulk(pane)}
                disabled={busy}
                className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 disabled:opacity-50 ${
                  isMembers
                    ? "bg-red-950/60 text-red-300 hover:bg-red-900/60"
                    : "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60"
                }`}
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isMembers ? (
                  <UserMinus className="w-3 h-3" />
                ) : (
                  <UserPlus className="w-3 h-3" />
                )}
                {isMembers ? "Remove" : "Add"} {chosen}
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search name, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-xs py-1.5 pl-8 w-full"
            />
          </div>

          {/* Selecting the visible page is a client-side act; selecting every
              match is a server-side one, so they're offered separately. */}
          {state.total > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <button
                onClick={() => {
                  const setSel = isMembers ? setMemberSel : setAvailableSel;
                  setSelectAll(false);
                  setSel(
                    pageAllChosen
                      ? new Set()
                      : new Set(state.rows.map((c) => c._id)),
                  );
                }}
                className="flex items-center gap-1 hover:text-zinc-300"
              >
                {pageAllChosen ? (
                  <CheckSquare className="w-3 h-3" />
                ) : (
                  <Square className="w-3 h-3" />
                )}
                Select page
              </button>

              {state.total > state.rows.length && (
                <button
                  onClick={() => {
                    const setSel = isMembers ? setMemberSel : setAvailableSel;
                    setSel(new Set());
                    setSelectAll(!selectAll);
                  }}
                  className={`hover:text-zinc-300 ${
                    selectAll ? "text-emerald-400" : ""
                  }`}
                >
                  {selectAll
                    ? `All ${state.total} selected — clear`
                    : `Select all ${state.total}${debounced ? " matching" : ""}`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 max-h-72 sm:max-h-none">
          {state.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : state.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                {isMembers ? (
                  <Users className="w-5 h-5 text-zinc-600" />
                ) : (
                  <Search className="w-5 h-5 text-zinc-600" />
                )}
              </div>
              <p className="text-sm text-zinc-500">
                {debounced
                  ? "No contacts match that search"
                  : isMembers
                    ? "No members yet"
                    : "All contacts are already members"}
              </p>
            </div>
          ) : (
            <>
              {state.rows.map((c) => {
                const checked = selectAll || sel.has(c._id);
                return (
                  <label
                    key={c._id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={selectAll}
                      onChange={() => toggle(pane, c._id)}
                      className="accent-emerald-500 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {c.phone}
                      </p>
                    </div>
                  </label>
                );
              })}

              {state.page < state.totalPages && (
                <button
                  onClick={() => load(pane, debounced, state.page + 1)}
                  disabled={state.loadingMore}
                  className="w-full py-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 flex items-center justify-center gap-2"
                >
                  {state.loadingMore && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  Load more ({state.rows.length} of {state.total})
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
        <div>
          <h2 id="manage-modal-title" className="text-base font-medium">
            Manage Members
          </h2>
          <p className="text-sm text-zinc-500">
            {group.name} · {members.total} member
            {members.total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-md"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-zinc-800 flex-1 min-h-0 overflow-hidden">
        {renderPane("members")}
        {renderPane("available")}
      </div>

      <div className="p-4 border-t border-zinc-800 flex justify-end flex-shrink-0">
        <button onClick={onClose} className="btn btn-secondary btn-sm">
          Done
        </button>
      </div>
    </>
  );
}