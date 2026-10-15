import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Bell, Check, Eye, Globe2, InfoCircle, Package, Palette, Plug, Server, ShieldCheck, Smartphone, UserRound, Wifi } from "./icons.js";
import { useAuth, type AuthUser, type ProfileUpdate } from "./auth.js";
import { readSidebarWidth } from "./app-sidebar.js";
import { ModelsSettings, type ModelsView } from "./models-settings.js";
import type { SettingsSection } from "./routes.js";
import { UserAvatar } from "./user-avatar.js";
import { WindowDragRegion } from "./window-drag-region.js";
import type { DesktopUpdateState } from "../shared/desktop-update.js";
import { readAppearance, setAppearance as persistAppearance, type Appearance } from "./appearance.js";
import { WebSearchSettingsPanel } from "./web-search-settings.js";
import { NetworkSettingsPanel } from "./network-settings.js";
import { readChatLayout, setChatLayout, type ChatLayout } from "./chat-layout.js";
import { SegmentedControl } from "./segmented-control.js";
import { PluginsSettings } from "./plugins.js";
import type { PluginDetail } from "../shared/plugins.js";
import { useLanguage } from "./i18n.js";
import { SYSTEM_AVATARS, systemAvatarUrl } from "./profile-avatars.js";

const DISPLAY_VERSION_EN = "Puteng-0.0.10";
const DISPLAY_VERSION_ZH = "扑腾-0.0.10";
const CHAT_LAYOUT_OPTIONS: readonly { value: ChatLayout; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const SETTINGS_SECTIONS: Array<{ section: SettingsSection; label: string; icon: typeof UserRound }> = [
  { section: "providers", label: "Providers & Models", icon: Server },
  { section: "account", label: "Account", icon: UserRound },
  { section: "appearance", label: "Appearance", icon: Palette },
  { section: "web-search", label: "Web Search", icon: Globe2 },
  { section: "network", label: "Network", icon: Wifi },
  { section: "plugins", label: "Plugins", icon: Package },
  { section: "about", label: "About", icon: InfoCircle },
];

export function SettingsPage({ section, pluginId, onBack, onSectionChange, onPluginChange, onTryPlugin }: {
  section: SettingsSection;
  pluginId?: string;
  onBack: () => void;
  onSectionChange: (section: SettingsSection) => void;
  onPluginChange: (pluginId?: string) => void;
  onTryPlugin: (plugin: PluginDetail, prompt: string, projectId?: string) => Promise<void>;
}) {
  const [modelsView, setModelsView] = useState<ModelsView>({ page: "providers" });
  const navigation = useRef<HTMLElement>(null);
  const sidebarStyle = { "--sidebar-width": `${readSidebarWidth()}px` } as CSSProperties;

  useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [section]);

  function chooseSection(next: SettingsSection): void {
    if (next === "providers") setModelsView({ page: "providers" });
    onSectionChange(next);
  }

  return (
    <main className="home-shell settings-page-shell" style={sidebarStyle}>
      <aside className="home-sidebar settings-page-sidebar">
        <div className="home-sidebar-header-spacer" aria-hidden="true" />
        <button className="settings-page-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>Back to app</span>
        </button>
        <nav className="settings-page-nav" aria-label="Settings sections" ref={navigation}>
          <div className="home-nav-label">SETTINGS</div>
          {SETTINGS_SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.section;
            return (
              <button className={`settings-page-nav-item${active ? " is-active" : ""}`} type="button" aria-current={active ? "page" : undefined} onClick={() => chooseSection(item.section)} key={item.section}>
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <section className="settings-page-content">
        <WindowDragRegion />
        <div className={`settings-page-inner${section === "plugins" ? " settings-page-inner-plugins" : ""}`}>
          {section === "account" ? <AccountSettings /> : null}
          {section === "billing" ? <BillingSettings /> : null}
        {section === "points" ? <PointsSettings /> : null}
          {section === "appearance" ? <AppearanceSettings /> : null}
          {section === "providers" ? <ModelsSettings view={modelsView} onViewChange={setModelsView} /> : null}
          {section === "web-search" ? <WebSearchSettingsPanel /> : null}
          {section === "network" ? <NetworkSettingsPanel /> : null}
          {section === "plugins" ? <PluginsSettings pluginId={pluginId} onPluginChange={onPluginChange} onTryPlugin={onTryPlugin} /> : null}
          {section === "about" ? <AboutSettings onOpenNetwork={() => chooseSection("network")} /> : null}
        </div>
      </section>
    </main>
  );
}

function BillingSettings() {
  const [selectedPlan, setSelectedPlan] = useState("Creator");
  const [message, setMessage] = useState<string>();

  function choosePlan(plan: string): void {
    setSelectedPlan(plan);
    setMessage("Plan selected. Checkout is simulated in this build.");
  }

  return (
    <section className="settings-panel settings-overview-panel settings-commerce-panel">
      <header className="settings-panel-header"><h3>Upgrade plan</h3></header>
      <p>Choose a plan with more creation capacity. This is a demo checkout page.</p>
      <div className="settings-commerce-grid">
        <CommercePlan name="Starter" price="$9.99" detail="For occasional creation" features={["1,000 points each month", "Standard generation speed"]} selected={selectedPlan === "Starter"} onSelect={() => choosePlan("Starter")} />
        <CommercePlan name="Creator" price="$19.99" detail="For regular creation" features={["3,000 points each month", "Priority generation speed"]} badge="Popular" selected={selectedPlan === "Creator"} onSelect={() => choosePlan("Creator")} />
        <CommercePlan name="Studio" price="$49.99" detail="For serious production" features={["10,000 points each month", "Highest generation priority"]} selected={selectedPlan === "Studio"} onSelect={() => choosePlan("Studio")} />
      </div>
      {message ? <p className="settings-success" role="status">{message}</p> : null}
    </section>
  );
}

function PointsSettings() {
  const [selectedPackage, setSelectedPackage] = useState("1,500 points");
  const [message, setMessage] = useState<string>();

  function choosePackage(packageName: string): void {
    setSelectedPackage(packageName);
    setMessage("Points package selected. Payment is simulated in this build.");
  }

  return (
    <section className="settings-panel settings-overview-panel settings-commerce-panel">
      <header className="settings-panel-header"><h3>Buy points</h3></header>
      <p>Purchase extra points for generation and production tasks. No real payment is made.</p>
      <div className="settings-commerce-grid settings-points-grid">
        <CommercePlan name="500 points" price="$4.99" detail="A small top-up" features={["One-time purchase", "Never expires"]} selected={selectedPackage === "500 points"} onSelect={() => choosePackage("500 points")} />
        <CommercePlan name="1,500 points" price="$12.99" detail="A balanced top-up" features={["One-time purchase", "Never expires"]} badge="Best value" selected={selectedPackage === "1,500 points"} onSelect={() => choosePackage("1,500 points")} />
        <CommercePlan name="5,000 points" price="$39.99" detail="For larger projects" features={["One-time purchase", "Never expires"]} selected={selectedPackage === "5,000 points"} onSelect={() => choosePackage("5,000 points")} />
      </div>
      {message ? <p className="settings-success" role="status">{message}</p> : null}
    </section>
  );
}

function CommercePlan({ name, price, detail, features, badge, selected, onSelect }: { name: string; price: string; detail: string; features: string[]; badge?: string; selected: boolean; onSelect: () => void }) {
  return (
    <article className={`settings-commerce-card${selected ? " is-selected" : ""}`}>
      <div className="settings-commerce-card-heading">
        <div>
          <h4>{name}</h4>
          <p>{detail}</p>
        </div>
        {badge ? <span className="settings-commerce-badge">{badge}</span> : null}
      </div>
      <strong className="settings-commerce-price">{price}</strong>
      <ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      <button className={selected ? "settings-primary-button" : "settings-secondary-button"} type="button" aria-pressed={selected} onClick={onSelect}>
        {selected ? "Selected" : "Choose"}
      </button>
    </article>
  );
}

function AppearanceSettings() {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [chatLayout, updateChatLayout] = useState<ChatLayout>(readChatLayout);
  const { language, setLanguage } = useLanguage();

  function chooseAppearance(next: Appearance): void {
    setAppearance(next);
    persistAppearance(next);
  }

  function chooseChatLayout(next: ChatLayout): void {
    updateChatLayout(next);
    setChatLayout(next);
  }

  return (
    <section className="settings-panel settings-overview-panel settings-appearance-panel">
      <header className="settings-panel-header"><h3>Appearance</h3></header>
      <div className="settings-appearance-group">
        <h4 className="settings-section-heading">Theme</h4>
        <fieldset className="settings-theme-options" aria-label="Theme">
          <ThemeOption appearance="system" selected={appearance === "system"} onSelect={chooseAppearance} />
          <ThemeOption appearance="light" selected={appearance === "light"} onSelect={chooseAppearance} />
          <ThemeOption appearance="dark" selected={appearance === "dark"} onSelect={chooseAppearance} />
        </fieldset>
      </div>
      <div className="settings-appearance-group">
        <h4 className="settings-section-heading">Workspace</h4>
        <div className="settings-chat-layout-row">
          <span className="settings-chat-layout-label">Chat position</span>
          <SegmentedControl className="settings-chat-layout-control" label="Chat panel position" options={CHAT_LAYOUT_OPTIONS} value={chatLayout} onChange={chooseChatLayout} />
        </div>
      </div>
      <div className="settings-appearance-group">
        <h4 className="settings-section-heading">Language</h4>
        <div className="settings-chat-layout-row">
          <label className="settings-chat-layout-label" htmlFor="interface-language">Interface language</label>
          <select id="interface-language" className="settings-language-select" value={language} onChange={(event) => setLanguage(event.target.value as "zh-CN" | "en-US")}>
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function ThemeOption({ appearance, selected, onSelect }: {
  appearance: Appearance;
  selected: boolean;
  onSelect: (appearance: Appearance) => void;
}) {
  const label = appearance === "system" ? "System" : appearance === "light" ? "Light" : "Dark";
  return (
    <button
      className={`settings-theme-option is-${appearance}${selected ? " is-selected" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(appearance)}
    >
      <ThemePreview appearance={appearance} />
      <span className="settings-theme-option-label">
        <span>{label}</span>
        {selected ? <Check size={16} aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

function ThemePreview({ appearance }: { appearance: Appearance }) {
  if (appearance === "system") {
    return <span className="settings-theme-preview is-system" aria-hidden="true">
      <span className="settings-theme-system-layer">
        <span className="settings-theme-preview-sidebar" />
        <ThemePreviewContent />
      </span>
      <span className="settings-theme-system-layer is-dark">
        <span className="settings-theme-preview-sidebar" />
        <ThemePreviewContent />
      </span>
    </span>;
  }
  return <span className="settings-theme-preview" aria-hidden="true">
    <span className="settings-theme-preview-sidebar" />
    <ThemePreviewContent />
  </span>;
}

function ThemePreviewContent() {
  return <span className="settings-theme-preview-content">
    <i />
    <i />
    <i />
  </span>;
}

function AccountSettings() {
  const auth = useAuth();
  const [error, setError] = useState<string>();
  const [section, setSection] = useState<AccountSettingsSection>("profile");
  return (
    <section className="settings-panel settings-overview-panel settings-account-panel">
      <header className="settings-panel-header"><h3>Account</h3></header>
      <div className="settings-account-tabs" role="tablist" aria-label="Account settings">
        <AccountTab active={section === "profile"} icon={<UserRound size={16} />} label="Personal profile" onClick={() => setSection("profile")} />
        <AccountTab active={section === "security"} icon={<ShieldCheck size={16} />} label="Security settings" onClick={() => setSection("security")} />
        <AccountTab active={section === "notifications"} icon={<Bell size={16} />} label="Notification preferences" onClick={() => setSection("notifications")} />
      </div>
      {section === "profile" ? (
        auth.state.status === "signed-in" ? (
          <ProfileSettings user={auth.state.user} onSave={auth.updateProfile} onSignOut={() => void auth.signOut().catch((cause) => setError(errorMessage(cause)))} />
        ) : (
          <button className="settings-primary-button" type="button" onClick={auth.openSignIn}>Sign in</button>
        )
      ) : section === "security" ? (
        auth.state.status === "signed-in" ? <SecuritySettings user={auth.state.user} /> : <AccountSettingInfo title="Security settings" description="Sign in to manage your account security." />
      ) : (
        auth.state.status === "signed-in" ? <NotificationSettings userId={auth.state.user.id} /> : <AccountSettingInfo title="Notification preferences" description="Choose how PutengGame keeps you informed about system messages and updates." />
      )}
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
    </section>
  );
}

function ProfileSettings({ user, onSave, onSignOut }: { user: AuthUser; onSave: (profile: ProfileUpdate) => Promise<void>; onSignOut: () => void }) {
  const [draft, setDraft] = useState<ProfileUpdate>(() => profileDraft(user));
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const original = profileDraft(user);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  useEffect(() => {
    setDraft(profileDraft(user));
    setSaved(false);
    setError(undefined);
  }, [user]);

  function change<K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function discard(): void {
    setDraft(original);
    setAvatarPickerOpen(false);
    setError(undefined);
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onSave({ ...draft, name: draft.name.trim(), website: draft.website?.trim(), bio: draft.bio?.trim() });
      setSaved(true);
      setAvatarPickerOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-profile-form" onSubmit={(event) => void save(event)}>
      <div className="settings-profile-intro">
        <div className="settings-profile-avatar-picker">
          <button className="settings-profile-avatar-button" type="button" aria-label="Choose system avatar" aria-expanded={avatarPickerOpen} onClick={() => setAvatarPickerOpen((open) => !open)}>
            <UserAvatar className="settings-profile-avatar" name={draft.name} avatarUrl={draft.avatarUrl} />
          </button>
          {avatarPickerOpen ? (
            <div className="settings-profile-avatar-options" role="listbox" aria-label="System avatars">
              {SYSTEM_AVATARS.map((avatar) => {
                const avatarUrl = systemAvatarUrl(avatar.id);
                return <button className={`settings-profile-avatar-option${draft.avatarUrl === avatarUrl ? " is-selected" : ""}`} type="button" role="option" aria-selected={draft.avatarUrl === avatarUrl} title={avatar.label} key={avatar.id} onClick={() => change("avatarUrl", avatarUrl)}><img src={avatarUrl} alt={avatar.label} /></button>;
              })}
            </div>
          ) : null}
        </div>
        <div>
          <h4>Personal profile</h4>
          <p>Show your personal page and creator profile.</p>
        </div>
      </div>

      <div className="settings-profile-grid">
        <ProfileField label="Display name" hint="Shown on your profile and project comments">
          <input value={draft.name} onChange={(event) => change("name", event.target.value)} autoComplete="name" />
        </ProfileField>
        <ProfileField label="Email" hint="Used for sign-in and important notifications">
          <input value={user.email ?? ""} readOnly disabled autoComplete="email" />
        </ProfileField>
        <ProfileField label="Personal website" hint="A public link on your profile" optional>
          <input value={draft.website ?? ""} onChange={(event) => change("website", event.target.value)} type="url" placeholder="https://" autoComplete="url" />
        </ProfileField>
        <ProfileField label="Gender display" hint="Optional and does not affect features">
          <div className="settings-profile-segmented" role="group" aria-label="Gender display">
            {([
              ["male", "Male"],
              ["female", "Female"],
              ["private", "Prefer not to say"],
            ] as const).map(([value, label]) => <button className={draft.gender === value ? "is-selected" : ""} type="button" aria-pressed={draft.gender === value} key={value} onClick={() => change("gender", value)}>{label}</button>)}
          </div>
        </ProfileField>
      </div>

      <ProfileField label="Bio" hint="A short introduction, up to 150 characters">
        <textarea value={draft.bio ?? ""} onChange={(event) => change("bio", event.target.value.slice(0, 150))} rows={4} maxLength={150} />
      </ProfileField>

      {error ? <p className="settings-error" role="alert">{error}</p> : null}
      {saved ? <p className="settings-success" role="status">Profile saved.</p> : null}
      <div className="settings-profile-actions">
        <button className="settings-danger-button" type="button" onClick={onSignOut}>Sign out</button>
        <span className="settings-profile-action-spacer" />
        <button className="settings-secondary-button" type="button" disabled={!dirty || saving} onClick={discard}>Discard changes</button>
        <button className="settings-primary-button" type="submit" disabled={!dirty || saving}>{saving ? "Saving..." : "Save changes"}</button>
      </div>
    </form>
  );
}

function ProfileField({ label, hint, optional, children }: { label: string; hint: string; optional?: boolean; children: ReactNode }) {
  return <label className="settings-profile-field"><span className="settings-profile-field-label"><strong>{label}</strong>{optional ? <small>Optional</small> : null}<em>{hint}</em></span>{children}</label>;
}

function profileDraft(user: AuthUser): ProfileUpdate {
  return { name: user.name, avatarUrl: user.avatarUrl, website: user.website, gender: user.gender, bio: user.bio };
}

type FakeSecurityState = { phone?: string; twoFactor: boolean };
const FAKE_SECURITY_STORAGE_KEY = "putenggame-fake-security:";

function SecuritySettings({ user }: { user: AuthUser }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ kind: "error" | "success"; text: string }>();
  const [security, setSecurity] = useState<FakeSecurityState>(() => readFakeSecurityState(user.id));
  const [phoneDraft, setPhoneDraft] = useState("");
  const [bindingPhone, setBindingPhone] = useState(false);

  useEffect(() => {
    setSecurity(readFakeSecurityState(user.id));
    setPhoneDraft("");
    setBindingPhone(false);
  }, [user.id]);

  function updateSecurity(next: FakeSecurityState): void {
    setSecurity(next);
    try { localStorage.setItem(`${FAKE_SECURITY_STORAGE_KEY}${user.id}`, JSON.stringify(next)); } catch { /* Demo settings remain usable without storage. */ }
  }

  function updatePassword(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ kind: "error", text: "Enter your current and new password." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ kind: "error", text: "The new password must be at least 8 characters." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPasswordMessage({ kind: "success", text: "Password updated in demo mode." });
  }

  function bindPhone(): void {
    if (!/^1\d{10}$/.test(phoneDraft)) return;
    updateSecurity({ ...security, phone: phoneDraft });
    setPhoneDraft("");
    setBindingPhone(false);
  }

  return (
    <div className="settings-security-form">
      <form className="settings-security-password" onSubmit={updatePassword}>
        <div className="settings-security-heading"><h4>Change password</h4><p>We recommend changing your password every 6 months. Use at least 8 characters.</p></div>
        <div className="settings-security-password-grid">
          <PasswordField label="Current password" value={currentPassword} visible={showCurrentPassword} onChange={setCurrentPassword} onToggle={() => setShowCurrentPassword((visible) => !visible)} />
          <PasswordField label="New password" value={newPassword} visible={showNewPassword} onChange={setNewPassword} onToggle={() => setShowNewPassword((visible) => !visible)} />
        </div>
        <div className="settings-security-actions">
          {passwordMessage ? <p className={`settings-${passwordMessage.kind}`} role={passwordMessage.kind === "error" ? "alert" : "status"}>{passwordMessage.text}</p> : null}
          <button className="settings-primary-button" type="submit" disabled={!currentPassword || !newPassword}>Update password</button>
        </div>
      </form>

      <section className="settings-security-verification">
        <div className="settings-security-heading"><h4>Verification methods</h4><p>Use extra verification steps to make your account safer. These controls are simulated in this build.</p></div>
        <div className="settings-security-methods">
          <SecurityMethod icon={<InfoCircle size={18} />} title="Email verified" description={user.email ?? "No email address"} status="Verified" statusKind="success" />
          {bindingPhone ? (
            <div className="settings-security-method settings-security-method-editor">
              <span className="settings-security-method-icon"><Smartphone size={18} /></span>
              <label><strong>Phone verification</strong><small>Enter a demo phone number</small><input value={phoneDraft} onChange={(event) => setPhoneDraft(event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" placeholder="13800138000" autoFocus /></label>
              <span className="settings-security-method-editor-actions"><button className="settings-secondary-button" type="button" onClick={() => setBindingPhone(false)}>Cancel</button><button className="settings-primary-button" type="button" disabled={!/^1\d{10}$/.test(phoneDraft)} onClick={bindPhone}>Bind phone</button></span>
            </div>
          ) : (
            <SecurityMethod icon={<Smartphone size={18} />} title="Phone verification" description={security.phone ? maskPhone(security.phone) : "Not connected"} status={security.phone ? "Enabled" : "Not enabled"} statusKind={security.phone ? "success" : "warning"} action={security.phone ? undefined : { label: "Bind phone", onClick: () => setBindingPhone(true) }} />
          )}
          <SecurityMethod icon={<ShieldCheck size={18} />} title="Two-factor authentication" description={security.twoFactor ? "Authenticator app verification is enabled" : "Use an authenticator app when signing in"} status={security.twoFactor ? "Enabled" : "Not enabled"} statusKind={security.twoFactor ? "success" : "warning"} action={security.twoFactor ? { label: "Disable", onClick: () => updateSecurity({ ...security, twoFactor: false }) } : { label: "Enable", onClick: () => updateSecurity({ ...security, twoFactor: true }) }} />
        </div>
      </section>
    </div>
  );
}

function PasswordField({ label, value, visible, onChange, onToggle }: { label: string; value: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  return <label className="settings-security-password-field"><span>{label}</span><span className="settings-security-password-input"><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={label === "Current password" ? "current-password" : "new-password"} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} onClick={onToggle}><Eye size={16} /></button></span></label>;
}

function SecurityMethod({ icon, title, description, status, statusKind, action }: { icon: ReactNode; title: string; description: string; status: string; statusKind: "success" | "warning"; action?: { label: string; onClick: () => void } }) {
  return <div className="settings-security-method"><span className="settings-security-method-icon">{icon}</span><span className="settings-security-method-copy"><strong>{title} <small className={`is-${statusKind}`}>{status}</small></strong><span>{description}</span></span>{action ? <button className="settings-secondary-button" type="button" onClick={action.onClick}>{action.label}</button> : null}</div>;
}

function readFakeSecurityState(userId: string): FakeSecurityState {
  try {
    const saved = JSON.parse(localStorage.getItem(`${FAKE_SECURITY_STORAGE_KEY}${userId}`) ?? "null") as Partial<FakeSecurityState> | null;
    return { phone: typeof saved?.phone === "string" ? saved.phone : undefined, twoFactor: saved?.twoFactor === true };
  } catch {
    return { twoFactor: false };
  }
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

type NotificationPreferenceKey = "email" | "push" | "sms" | "community" | "followers" | "weekly";
type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;
const NOTIFICATION_STORAGE_KEY = "putenggame-notification-preferences:";
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  push: true,
  sms: false,
  community: true,
  followers: true,
  weekly: true,
};

function NotificationSettings({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<NotificationPreferences>(() => readNotificationPreferences(userId));
  const [saved, setSaved] = useState(false);
  const original = readNotificationPreferences(userId);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  useEffect(() => {
    setDraft(readNotificationPreferences(userId));
    setSaved(false);
  }, [userId]);

  function toggle(key: NotificationPreferenceKey): void {
    setDraft((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  }

  function save(): void {
    try { localStorage.setItem(`${NOTIFICATION_STORAGE_KEY}${userId}`, JSON.stringify(draft)); } catch { /* Demo settings remain usable without storage. */ }
    setSaved(true);
  }

  function discard(): void {
    setDraft(original);
    setSaved(false);
  }

  return (
    <div className="settings-notification-form">
      <div className="settings-notification-heading"><h4><Bell size={18} />Notification preferences</h4><p>Choose which channels and events you want to hear about.</p></div>
      <NotificationGroup title="Delivery channels">
        <NotificationItem icon={<InfoCircle size={17} />} title="Email notifications" description="We'll send updates to your registered email" checked={draft.email} onChange={() => toggle("email")} />
        <NotificationItem icon={<Bell size={17} />} title="In-app push" description="Receive reminders inside PutengGame" checked={draft.push} onChange={() => toggle("push")} />
        <NotificationItem icon={<Smartphone size={17} />} title="SMS notifications" description="Receive important security alerts by text" checked={draft.sms} onChange={() => toggle("sms")} />
      </NotificationGroup>
      <NotificationGroup title="Event types">
        <NotificationItem icon={<Globe2 size={17} />} title="Community activity" description="Comments, likes, and mentions" checked={draft.community} onChange={() => toggle("community")} />
        <NotificationItem icon={<ShieldCheck size={17} />} title="New followers" description="When another user follows you" checked={draft.followers} onChange={() => toggle("followers")} />
        <NotificationItem icon={<InfoCircle size={17} />} title="Weekly picks" description="Community highlights delivered each week" checked={draft.weekly} onChange={() => toggle("weekly")} />
      </NotificationGroup>
      <div className="settings-notification-actions">
        {saved ? <p className="settings-success" role="status">Notification settings saved.</p> : null}
        <span />
        <button className="settings-secondary-button" type="button" disabled={!dirty} onClick={discard}>Discard changes</button>
        <button className="settings-primary-button" type="button" disabled={!dirty} onClick={save}>Save notification settings</button>
      </div>
    </div>
  );
}

function NotificationGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-notification-group"><h5>{title}</h5><div className="settings-notification-list">{children}</div></section>;
}

function NotificationItem({ icon, title, description, checked, onChange }: { icon: ReactNode; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="settings-notification-item"><span className="settings-notification-icon">{icon}</span><span className="settings-notification-copy"><strong>{title}</strong><small>{description}</small></span><label className="settings-toggle settings-notification-toggle"><input type="checkbox" checked={checked} onChange={onChange} aria-label={title} /><span /></label></div>;
}

function readNotificationPreferences(userId: string): NotificationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(`${NOTIFICATION_STORAGE_KEY}${userId}`) ?? "null") as Partial<NotificationPreferences> | null;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

type AccountSettingsSection = "profile" | "security" | "notifications";

function AccountTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`settings-account-tab${active ? " is-active" : ""}`} type="button" role="tab" aria-selected={active} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function AccountSettingInfo({ title, description }: { title: string; description: string }) {
  return <div className="settings-account-info"><h4>{title}</h4><p>{description}</p></div>;
}

function AboutSettings({ onOpenNetwork }: { onOpenNetwork: () => void }) {
  const { language } = useLanguage();
  const [update, setUpdate] = useState<DesktopUpdateState | null>(null);
  const [copied, setCopied] = useState(false);
  const updates = window.putengGameDesktop?.updates;
  useEffect(() => {
    if (!updates) return;
    let disposed = false;
    void updates.state().then((state) => { if (!disposed) setUpdate(state); }).catch(() => undefined);
    const unsubscribe = updates.onState(setUpdate);
    return () => { disposed = true; unsubscribe(); };
  }, [updates]);
  const status = update?.status;
  const displayVersion = language === "zh-CN" ? DISPLAY_VERSION_ZH : DISPLAY_VERSION_EN;
  const showUpdates = Boolean(updates && status && status.type !== "idle" && status.type !== "up-to-date");
  const message = status?.type === "up-to-date" ? "You're up to date"
    : status?.type === "checking" ? "Checking for updates..."
      : status?.type === "available" ? `Update available: ${status.version}`
        : status?.type === "downloading" ? `Downloading update (${status.percent}%)`
          : status?.type === "ready" ? `Ready to restart: ${status.version}`
            : status?.type === "installing" ? "Preparing a safe restart..."
              : status?.type === "error" ? status.title : "Not checked yet";
  const busy = status?.type === "checking" || status?.type === "downloading" || status?.type === "installing";
  const retry = () => {
    if (status?.type !== "error" || !updates) return;
    if (status.retry === "download") void updates.download();
    else if (status.retry === "install") void updates.install();
    else void updates.check();
  };
  const copyDetails = async () => {
    if (status?.type !== "error") return;
    await navigator.clipboard.writeText([
      displayVersion,
      `Update ${status.phase}/${status.code}`,
      status.detail,
    ].join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };
  return (
    <section className="settings-panel settings-overview-panel">
      <header className="settings-panel-header"><h3>About</h3></header>
      <div className="settings-about-list">
        <div className="settings-about-row">
          <span>Version</span>
          <strong>{displayVersion}</strong>
        </div>
        {showUpdates ? <div className="settings-about-row">
          <span>Updates</span>
          <div className="settings-about-update">
            <div className="settings-about-status">
              <span>{message}</span>
              {status?.type === "error" ? (
                <div className="settings-update-error" role="alert">
                  <p>{status.message}</p>
                  {status.dataSafe ? <p className="settings-update-data-safe">Your projects and conversations were not deleted.</p> : null}
                  <details>
                    <summary>Technical details</summary>
                    <code>{status.detail}</code>
                  </details>
                </div>
              ) : null}
            </div>
            {updates ? (
              <div className="settings-about-actions">
                {status?.type === "available" ? <button className="settings-primary-button" type="button" onClick={() => void updates.download()}>Download update</button> : null}
                {status?.type === "ready" ? <button className="settings-primary-button" type="button" onClick={() => void updates.install()}>Restart to update</button> : null}
                {status?.type === "error" ? <>
                  <button className="settings-primary-button" type="button" onClick={retry}>Try again</button>
                  {status.code === "network" ? <button className="settings-secondary-button" type="button" onClick={onOpenNetwork}>Network settings</button> : null}
                  <button className="settings-secondary-button" type="button" onClick={() => void copyDetails()}>{copied ? "Copied" : "Copy details"}</button>
                </> : (
                  <button className="settings-secondary-button" type="button" disabled={busy} onClick={() => void updates.check()}>Check for updates</button>
                )}
              </div>
            ) : null}
          </div>
        </div> : null}
      </div>
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
