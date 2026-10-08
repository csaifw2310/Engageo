import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../lib/theme"; // theme library
import {
  User,
  Building2,
  Bell,
  Settings,
  Loader2,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Wifi,
  Phone,
  Building,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { useAuth } from "../store/AppStore";
import { settingsApi, whatsappApi } from "../api/services";
import { useApiData, getApiErrorMessage } from "../hooks/useApiData";
import { useNavigate } from "react-router-dom";

function isValidPhone(phone: string) {
  if (!phone) return true;
  const cleaned = phone.trim();
  if (cleaned.length < 7) return true;
  return /^[+]?[1-9][0-9]{6,14}$/.test(cleaned);
}

function phoneErrorMessage(phone: string): string {
  const cleaned = phone.trim();
  const digits = cleaned.replace(/^\+/, "");
  if (digits.length > 15) return "Number too long — max 15 digits";
  if (!/^[+]?[0-9]+$/.test(cleaned))
    return "Only digits allowed, with optional + at start";
  if (cleaned[0] !== "+" && /^[0-9]/.test(cleaned) && cleaned[0] === "0")
    return "Number cannot start with 0";
  return "Enter a valid number, e.g. +919876543210 or 919876543210";
}


export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "business", label: "Business Information", icon: Building2 },
    { id: "whatsapp", label: "WhatsApp", icon: Wifi },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "preferences", label: "Preferences", icon: Settings },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-medium">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your account preferences</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="sm:w-52 flex-shrink-0">
          <div className="flex sm:flex-col gap-1 p-1 rounded-lg bg-zinc-900/50 border border-zinc-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {activeTab === "profile" && (
            <ProfileTab user={user} onSaved={refreshUser} />
          )}
          {activeTab === "business" && <BusinessTab />}
          {activeTab === "whatsapp" && <WhatsAppTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "preferences" && <PreferencesTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({
  user,
  onSaved,
}: {
  user: ReturnType<typeof useAuth>["user"];
  onSaved: () => Promise<void>;
}) {
  const { data: res, loading } = useApiData(() => settingsApi.getProfile(), []);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const initialised = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Seed the form from the settings fetch, falling back to the auth user only
  // while that request is still in flight.
  //
  useEffect(() => {
    if (initialised.current) return;

    if (res?.data) {
      initialised.current = true;
      setForm({
        fullName: res.data.fullName || user?.name || "",
        phoneNumber: res.data.phoneNumber ?? "",
      });
      setAvatarUrl((res.data as any).avatarUrl ?? "");
      return;
    }

    // Still loading (or the fetch failed): show the name we already know, but
    // stay uninitialised so a later response can still populate the form.
    if (user) {
      setForm((prev) => ({ ...prev, fullName: prev.fullName || user.name }));
    }

    // The fetch settled with no data — nothing better is coming, so stop
    // waiting and let the user edit.
    if (!loading) initialised.current = true;
  }, [res, user, loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const payload: { fullName: string; phoneNumber?: string } = {
        fullName: form.fullName,
      };
      payload.phoneNumber = form.phoneNumber;
      const updated = await settingsApi.updateProfile(payload);
      if (updated?.data) {
        setForm({
          fullName: updated.data.fullName ?? form.fullName,
          phoneNumber:
            "phoneNumber" in (updated.data ?? {})
              ? (updated.data.phoneNumber ?? "")
              : form.phoneNumber,
        });
      }
      await onSaved();
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/settings/profile/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (data?.data?.avatarUrl) setAvatarUrl(data.data.avatarUrl);
      // Also update local state for immediate display
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } catch {
      // silent
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium mb-6">Profile Settings</h2>
      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-900/50 text-sm text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Saved successfully
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl font-medium overflow-hidden cursor-pointer border-2 border-transparent hover:border-zinc-600 transition-all"
              onClick={() => avatarInputRef.current?.click()}
              title="Click to change profile photo"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                (form.fullName || user?.name || "?").charAt(0)
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium">
              {form.fullName || user?.name || "Your Name"}
            </p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Change photo
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Name</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Email</label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="input opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-zinc-600">Email cannot be changed here.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Phone</label>
          <input
            type="tel"
            value={form.phoneNumber}
            className={`input ${phoneTouched && form.phoneNumber && !isValidPhone(form.phoneNumber) ? "border-red-500/50 focus:border-red-500" : ""}`}
            placeholder="+91XXXXXXXXXX"
            onBlur={() => setPhoneTouched(true)}
            onChange={(e) => {
              setForm({ ...form, phoneNumber: e.target.value });
              if (error) setError("");
            }}
          />
          {phoneTouched &&
            form.phoneNumber &&
            !isValidPhone(form.phoneNumber) && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {phoneErrorMessage(form.phoneNumber)}
              </p>
            )}
        </div>
        <button
          type="submit"
          disabled={
            saving ||
            (phoneTouched &&
              !!form.phoneNumber &&
              !isValidPhone(form.phoneNumber))
          }
          className="btn btn-primary btn-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </form>
    </div>
  );
}

function BusinessTab() {
  const { data: res, loading } = useApiData(
    () => settingsApi.getBusiness(),
    [],
  );
  const [form, setForm] = useState({
    businessName: "",
    website: "",
    industry: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (res?.data)
      setForm({
        businessName: res.data.businessName ?? "",
        website: res.data.website ?? "",
        industry: res.data.industry ?? "",
        address: res.data.address ?? "",
      });
  }, [res]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const payload: Record<string, string> = {};
      (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
        if (form[k]) payload[k] = form[k];
      });
      const updated = await settingsApi.updateBusiness(payload);
      if (updated?.data) {
        setForm({
          businessName: updated.data.businessName ?? form.businessName,
          website: updated.data.website ?? form.website,
          industry: updated.data.industry ?? form.industry,
          address: updated.data.address ?? form.address,
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium mb-6">Business Information</h2>
      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-900/50 text-sm text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Saved successfully
          </div>
        )}
        {[
          { label: "Business Name", key: "businessName", type: "text" },
          {
            label: "Website",
            key: "website",
            type: "url",
            placeholder: "https://example.com",
          },
          { label: "Industry", key: "industry", type: "text" },
          { label: "Address", key: "address", type: "text" },
        ].map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs text-zinc-400">{f.label}</label>
            <input
              type={f.type}
              value={form[f.key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={(f as any).placeholder}
              className="input"
            />
          </div>
        ))}
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
          Save Changes
        </button>
      </form>
    </div>
  );
}

declare global {
  interface Window {
    FB: {
      init: (opts: object) => void;
      login: (
        cb: (res: { authResponse?: { code?: string } }) => void,
        opts: object,
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

const FB_APP_ID = import.meta.env.VITE_META_APP_ID ?? "";
const FB_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID ?? "";

function loadFBSDK() {
  if (document.getElementById("facebook-jssdk")) return;
  const js = document.createElement("script");
  js.id = "facebook-jssdk";
  js.src = "https://connect.facebook.net/en_US/sdk.js";
  document.body.appendChild(js);
}

function WhatsAppTab() {
  const navigate = useNavigate();
  const {
    data: statusRes,
    loading,
    refetch,
  } = useApiData(() => whatsappApi.getStatus(), []);
  const isConnected =
    (statusRes?.data?.status ?? "disconnected") === "connected";
  const { data: connRes } = useApiData(
    () => (isConnected ? whatsappApi.getConnection() : Promise.resolve(null)),
    [isConnected],
  );
  const connection = connRes?.data;

  const [activeTab, setActiveTab] = useState<"embedded" | "manual">("embedded");
  const [form, setForm] = useState({
    businessAccountId: "",
    phoneNumberId: "",
    phoneNumber: "",
    businessName: "",
    accessToken: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const [embeddedLoading, setEmbeddedLoading] = useState(false);
  const [embeddedError, setEmbeddedError] = useState("");
  const [embeddedSuccess, setEmbeddedSuccess] = useState(false);

  useEffect(() => {
    const initFB = () => {
      window.FB.init({
        appId: FB_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v25.0",
      });
      setFbReady(true);
    };
    if (window.FB) initFB();
    else {
      window.fbAsyncInit = initFB;
      loadFBSDK();
    }
  }, []);

  const handleEmbeddedLogin = useCallback(() => {
    if (!fbReady || !window.FB) return;
    setEmbeddedError("");
    setEmbeddedLoading(true);
    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setEmbeddedError(
            "Login cancelled or no authorisation code received.",
          );
          setEmbeddedLoading(false);
          return;
        }
        whatsappApi
          .exchangeCode(code)
          .then(() => {
            setEmbeddedSuccess(true);
            refetch();
          })
          .catch((err) => setEmbeddedError(getApiErrorMessage(err)))
          .finally(() => setEmbeddedLoading(false));
      },
      {
        config_id: FB_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }, [fbReady, refetch]);

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectError("");
    try {
      await whatsappApi.connect(form);
      refetch();
    } catch (err) {
      setConnectError(getApiErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect WhatsApp? This will stop all messaging."))
      return;
    try {
      await whatsappApi.disconnect();
      refetch();
    } catch {
      /* silent */
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await whatsappApi.sync();
      refetch();
    } catch {
      /* silent */
    } finally {
      setSyncing(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="card p-6">
          <h2 className="text-sm font-medium mb-4">WhatsApp Business</h2>
          <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-800/40 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">Connected</p>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                  {connection?.phoneNumber && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {connection.phoneNumber}
                    </span>
                  )}
                  {connection?.businessName && (
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {connection.businessName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate("/conversations")}
                className="btn btn-primary btn-sm text-xs"
              >
                Open Inbox
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn btn-secondary btn-sm text-xs"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync
              </button>
              <button
                onClick={handleDisconnect}
                className="btn btn-secondary btn-sm text-xs text-red-400 hover:text-red-300"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="text-sm font-medium">WhatsApp Business Connection</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Connect your WhatsApp Business account to start sending campaigns and
          manage conversations.
        </p>
      </div>
      <div className="flex border-b border-zinc-800">
        {[
          { id: "embedded", label: "Connect with Meta", badge: "Recommended" },
          { id: "manual", label: "Manual setup" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setConnectError("");
              setEmbeddedError("");
            }}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? "text-white border-b-2 border-emerald-500 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {tab.label}
            {(tab as any).badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">
                {(tab as any).badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "embedded" && (
        <div className="p-6">
          {embeddedSuccess ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-800/40 flex items-center justify-center mx-auto mb-3">
                <Check className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
              </div>
              <p className="font-medium mb-1">WhatsApp Connected!</p>
              <p className="text-sm text-zinc-500">
                Your account has been linked successfully.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h3 className="text-sm font-medium mb-1">
                  One-click connection
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Authorise Engageo through Meta's secure login. We'll
                  automatically configure your WhatsApp Business account.
                </p>
              </div>
              <div className="space-y-2.5 mb-5">
                {[
                  "A Meta login popup will open",
                  "Select your WhatsApp Business account",
                  "Grant Engageo the required permissions",
                  "You're connected — it's that fast",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{step}</p>
                  </div>
                ))}
              </div>
              {embeddedError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {embeddedError}
                </div>
              )}
              <button
                onClick={handleEmbeddedLogin}
                disabled={embeddedLoading || !fbReady}
                className="btn btn-primary"
              >
                {embeddedLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
                Continue with Meta
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === "manual" && (
        <div className="p-6">
          <div className="mb-5">
            <h3 className="text-sm font-medium mb-1">Enter your credentials</h3>
            <p className="text-sm text-zinc-500">
              Find these in your{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline underline-offset-4"
              >
                Meta Developer dashboard
              </a>
              .
            </p>
          </div>
          <form onSubmit={handleManualConnect} className="space-y-4 max-w-sm">
            {connectError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {connectError}
              </div>
            )}
            {[
              {
                key: "businessAccountId",
                label: "Business Account ID",
                placeholder: "WABA ID",
                type: "text",
              },
              {
                key: "phoneNumberId",
                label: "Phone Number ID",
                placeholder: "Phone number ID",
                type: "text",
              },
              {
                key: "phoneNumber",
                label: "Phone Number",
                placeholder: "+919876543210",
                type: "tel",
              },
              {
                key: "businessName",
                label: "Business Name",
                placeholder: "Your business name",
                type: "text",
              },
              {
                key: "accessToken",
                label: "Permanent Access Token",
                placeholder: "••••••••",
                type: "password",
              },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs text-zinc-400">{label} *</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="input"
                  required
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={connecting}
              className="btn btn-primary btn-sm"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  const { data: res, loading } = useApiData(
    () => settingsApi.getNotifications(),
    [],
  );
  const [form, setForm] = useState({
    incomingMessages: true,
    campaignCompleted: true,
    campaignFailed: true,
    paymentAlerts: true,
    subscriptionAlerts: true,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (res?.data) setForm((prev) => ({ ...prev, ...res.data }));
  }, [res]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      const updated = await settingsApi.updateNotifications(form);
      if (updated?.data) setForm((prev) => ({ ...prev, ...updated.data }));
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );

  const toggles: { key: keyof typeof form; label: string; desc: string }[] = [
    {
      key: "incomingMessages",
      label: "WhatsApp Messages",
      desc: "Notify me when a new WhatsApp message arrives.",
    },
    {
      key: "campaignCompleted",
      label: "Campaign Completed",
      desc: "Notify me when a campaign finishes sending",
    },
    {
      key: "campaignFailed",
      label: "Campaign Failed",
      desc: "Notify me when a campaign fails",
    },
    {
      key: "paymentAlerts",
      label: "Payment Alerts",
      desc: "Notification alerts for payments and invoices",
    },
    {
      key: "subscriptionAlerts",
      label: "Subscription Alerts",
      desc: "Notify me about subscription changes and renewals",
    },
  ];

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium mb-6">Notification Preferences</h2>
      {success && (
        <div className="p-3 mb-4 rounded-lg bg-emerald-950/50 border border-emerald-900/50 text-sm text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Saved successfully
        </div>
      )}
      {error && (
        <div className="p-3 mb-4 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      <div className="space-y-4">
        {toggles.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/30"
          >
            <div>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-zinc-500">{t.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, [t.key]: !form[t.key] })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form[t.key] ? "bg-white" : "bg-zinc-700"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-zinc-950 transition-transform ${form[t.key] ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn btn-primary btn-sm mt-6"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Save Preferences
      </button>
    </div>
  );
}

function PreferencesTab() {
  const { data: res, loading } = useApiData(
    () => settingsApi.getPreferences(),
    [],
  );
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  // Global theme — single source of truth lives in lib/theme.ts.
  // setTheme already persists to localStorage and broadcasts the
  // change to every other mounted component/tab (e.g. ConversationPage).
const [theme, setTheme] = useTheme();

  useEffect(() => {
    if (res?.data?.timezone) setTimezone(res.data.timezone);
  }, [res]);

  const handleThemeToggle = (newTheme: "dark" | "light") => setTheme(newTheme);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      const updated = await settingsApi.updatePreferences({
        timezone,
        theme,
      } as any);
      if (updated?.data?.timezone) setTimezone(updated.data.timezone);
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );

  return (
    <div className="card p-6">
      <h2 className="text-sm font-medium mb-6">Preferences</h2>
      <form onSubmit={handleSave} className="space-y-5">
        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-900/50 text-sm text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Saved successfully
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Theme Toggle */}
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Appearance</label>
          <div className="flex items-center gap-2 p-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 w-fit">
            <button
              type="button"
              onClick={() => handleThemeToggle("dark")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${theme === "dark" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => handleThemeToggle("light")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${theme === "light" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-white"}`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            Engageo is optimized for dark mode. Light mode support coming soon.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="select w-full"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="Europe/London">London</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Dubai">Dubai</option>
          </select>
        </div>
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
          Save Preferences
        </button>
      </form>
    </div>
  );
}