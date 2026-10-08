import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, Check, Trash2, Mail, Phone, Loader2, AlertCircle, MessageCircle, Upload, Download, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { contactsApi, groupsApi, type ApiContact } from '../api/resources';
import { useApiData, getApiErrorMessage } from '../hooks/useApiData';

function validatePhone(phone: string): string {
  if (!phone.trim()) return 'Phone number is required';
  if (!/^\+?[1-9]\d{6,14}$/.test(phone.trim().replace(/\s/g, ''))) return 'Invalid phone number (e.g. +919876543210)';
  return '';
}
function validateEmail(email: string): string {
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
  return '';
}
function validateName(name: string): string {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return '';
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ApiContact | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', tags: '', groupId: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: contactsRes, loading, error, refetch } = useApiData(
    () => contactsApi.list({ page, limit: 20, search: searchQuery || undefined }),
    [page, searchQuery],
  );
  const { data: groupsRes } = useApiData(() => groupsApi.list({ limit: 100 }), []);
  const contacts = contactsRes?.data?.contacts ?? [];
  const pagination = contactsRes?.data;
  const groups = groupsRes?.data?.groups ?? [];

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const n = validateName(formData.name); if (n) errors.name = n;
    const p = validatePhone(formData.phone); if (p) errors.phone = p;
    const e = validateEmail(formData.email); if (e) errors.email = e;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true); setSaveError('');
    try {
      const payload = {
        name: formData.name.trim(), phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: 'active' as const,
      };
      let contactId = editingContact?._id;
      if (editingContact) {
        await contactsApi.update(editingContact._id, payload);
      } else {
        const created = await contactsApi.create(payload);
        contactId = created.data._id;
      }
      if (formData.groupId && contactId) {
        try { await groupsApi.assignContact(formData.groupId, contactId); } catch { /* non-fatal */ }
      }
      closeModal(); refetch();
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contact?')) return;
    try { await contactsApi.delete(id); refetch(); } catch { /* silent */ }
  };

  const openEditModal = (contact: ApiContact) => {
    setEditingContact(contact);
    setFormData({ name: contact.name, phone: contact.phone, email: contact.email || '', tags: (contact.tags ?? []).join(', '), groupId: contact.groupId || '' });
    setFieldErrors({}); setShowModal(true);
  };

  const openNewModal = () => {
    setEditingContact(null);
    setFormData({ name: '', phone: '', email: '', tags: '', groupId: '' });
    setFieldErrors({}); setSaveError(''); setShowModal(true);
  };

  const closeModal = useCallback(() => {
    setShowModal(false); setEditingContact(null);
    setFormData({ name: '', phone: '', email: '', tags: '', groupId: '' });
    setFieldErrors({}); setSaveError('');
  }, []);

  // Open this specific contact's conversation in the CRM inbox.
  // The inbox finds-or-creates the conversation for this phone number.
  const openConversation = (contact: ApiContact) =>
    navigate(
      `/conversations?phone=${encodeURIComponent(contact.phone)}` +
        `&name=${encodeURIComponent(contact.name || '')}`,
    );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportMsg('');
    try {
      const result = await contactsApi.importCsv(file);
      const n = result?.data?.imported ?? result?.data?.created ?? '?';
      setImportMsg(`✓ Imported ${n} contacts`); refetch();
    } catch (err) { setImportMsg(`✗ ${getApiErrorMessage(err)}`); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await contactsApi.export() as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'contacts.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { /* silent */ } finally { setExporting(false); }
  };

  const FE = ({ f }: { f: string }) => fieldErrors[f]
    ? <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors[f]}</p> : null;

  // Modal is rendered via a portal straight into document.body.
  // Reason: the page root uses the `animate-in` class, whose keyframe
  // ends on `transform: translateY(0)`. Because the animation fill-mode
  // is `both`, that transform stays applied to the div forever (not just
  // during the animation), and ANY transform on an ancestor turns it into
  // a containing block for `position: fixed` descendants. That silently
  // breaks the modal overlay's fixed positioning, clipping it to the
  // page content's box instead of the viewport. Portaling to document.body
  // sidesteps this permanently, regardless of what animation/transform
  // classes get added to ancestors later.
  const modal = showModal ? (
    <div className="modal-overlay flex items-center justify-center p-4" onClick={closeModal}>
      <div className="modal p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-md"><X className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{saveError}</div>}
          <div>
            <label className="text-xs text-zinc-400">Name *</label>
            <input type="text" value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFieldErrors(p => ({ ...p, name: '' })); }}
              className={`input mt-1 ${fieldErrors.name ? 'border-red-500/50' : ''}`} />
            <FE f="name" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Phone *</label>
            <input type="tel" value={formData.phone} placeholder="+919876543210"
              onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setFieldErrors(p => ({ ...p, phone: '' })); }}
              className={`input mt-1 ${fieldErrors.phone ? 'border-red-500/50' : ''}`} />
            <FE f="phone" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Email</label>
            <input type="email" value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFieldErrors(p => ({ ...p, email: '' })); }}
              className={`input mt-1 ${fieldErrors.email ? 'border-red-500/50' : ''}`} />
            <FE f="email" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Tags (comma separated)</label>
            <input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="VIP, Enterprise" className="input mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Group</label>
            <select value={formData.groupId} onChange={(e) => setFormData({ ...formData, groupId: e.target.value })} className="select w-full mt-1">
              <option value="">No group</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Contacts</h1>
          <p className="text-sm text-zinc-500">{pagination?.totalContacts ?? 0} total contacts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" id="csv-import" />
          <button onClick={() => document.getElementById('csv-import')?.click()} disabled={importing} className="btn btn-secondary btn-sm">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Import CSV
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn btn-secondary btn-sm">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Export
          </button>
          <button onClick={openNewModal} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add Contact</button>
        </div>
      </div>

      {importMsg && (
        <div className={`p-3 rounded-lg text-sm ${importMsg.startsWith('✓') ? 'bg-emerald-950/50 border border-emerald-900/50 text-emerald-400' : 'bg-red-950/50 border border-red-900/50 text-red-400'}`}>
          {importMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" placeholder="Search contacts..." value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="input pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" /><p className="text-sm">{error}</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Search className="w-6 h-6 text-zinc-600" /></div>
          <p className="empty-state-title">{searchQuery ? 'No contacts found' : 'No contacts yet'}</p>
          <p className="empty-state-description">{searchQuery ? 'Try adjusting your search.' : 'Add your first contact to get started.'}</p>
          {!searchQuery && <button onClick={openNewModal} className="btn btn-secondary btn-sm mt-4"><Plus className="w-4 h-4" />Add Contact</button>}
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact._id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="avatar avatar-sm">{contact.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-xs text-zinc-500 md:hidden">{contact.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                      <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-zinc-600" />{contact.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">
                      {contact.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-zinc-600" />{contact.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(contact.tags ?? []).slice(0, 2).map((tag) => <span key={tag} className="badge badge-default">{tag}</span>)}
                        {(contact.tags ?? []).length > 2 && <span className="text-xs text-zinc-500">+{(contact.tags ?? []).length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`badge ${contact.status === 'active' ? 'badge-success' : contact.status === 'blocked' ? 'badge-error' : 'badge-warning'}`}>{contact.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openConversation(contact)} className="p-1.5 rounded-md hover:bg-emerald-900/30 transition-colors" title="Open CRM Inbox">
                          <MessageCircle className="w-4 h-4 text-emerald-500" />
                        </button>
                        <button onClick={() => openEditModal(contact)} className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4 text-zinc-500" />
                        </button>
                        <button onClick={() => handleDelete(contact._id)} className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4 text-zinc-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-500">Page {pagination.currentPage} of {pagination.totalPages} · {pagination.totalContacts} contacts</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Previous</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {modal && createPortal(modal, document.body)}
    </div>
  );
}