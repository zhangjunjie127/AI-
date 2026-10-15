import { ArrowDownToLine, Bell, Check, CircleHelp, Copy, Gamepad2, Globe2, InfoCircle, RefreshCw, Settings, UserRound } from "./icons.js";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "./auth.js";
import { messagesHash, settingsHash, type AppNavigationTarget, type SidebarPage } from "./routes.js";
import { UserAvatar } from "./user-avatar.js";
import type { DesktopUpdateState } from "../shared/desktop-update.js";
import brandMark from "../shared/assets/putenggame-mark-v2.svg";

interface AppSidebarProps {
  active: SidebarPage;
  onNavigate: (page: AppNavigationTarget) => void;
}

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 272;
const SIDEBAR_WIDTH_STORAGE_KEY = "putenggame-sidebar-width";

export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  const auth = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [update, setUpdate] = useState<DesktopUpdateState | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const resizingRef = useRef(false);

  useLayoutEffect(() => {
    sidebar.current?.parentElement?.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      sidebar.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!account.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountMenuOpen]);

  useEffect(() => {
    const updates = window.putengGameDesktop?.updates;
    if (!updates) return;
    let disposed = false;
    void updates.state().then((state) => {
      if (!disposed) setUpdate(state);
    }).catch(() => undefined);
    const unsubscribe = updates.onState(setUpdate);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const updateStatus = update?.status.type;
  const updateAction = updateStatus === "available"
    ? { label: "Update", icon: <ArrowDownToLine size={15} />, action: () => void window.putengGameDesktop?.updates.download() }
    : updateStatus === "ready"
      ? { label: "Restart", icon: <RefreshCw size={14} />, action: () => void window.putengGameDesktop?.updates.install() }
      : updateStatus === "error"
        ? { label: "Issue", icon: <InfoCircle size={15} />, action: () => { window.location.hash = settingsHash("about"); } }
        : undefined;

  const updatePercent = updateStatus === "downloading" ? update!.status.percent : undefined;
  const updateButton = updateAction ? (
    <button className="home-sidebar-update" type="button" aria-label={updateAction.label} onClick={updateAction.action}>
      {updateAction.icon}<span>{updateAction.label}</span>
    </button>
  ) : updatePercent !== undefined ? (
    <div className="home-sidebar-update-progress" role="progressbar" aria-valuenow={updatePercent} aria-valuemin={0} aria-valuemax={100}>
      <div className="home-sidebar-update-progress-fill" style={{ width: `${updatePercent}%` }} />
      <span className="home-sidebar-update-progress-text">{updatePercent}%</span>
    </div>
  ) : null;

  function resize(clientX: number): void {
    const shell = sidebar.current?.parentElement;
    const bounds = shell?.getBoundingClientRect();
    if (!shell || !bounds) return;
    const width = clampSidebarWidth(Math.round(clientX - bounds.left));
    sidebarWidthRef.current = width;
    shell.style.setProperty("--sidebar-width", `${width}px`);
  }

  function finishResize(): void {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    setResizing(false);
    setSidebarWidth(sidebarWidthRef.current);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current));
  }

  function resetWidth(): void {
    sidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(DEFAULT_SIDEBAR_WIDTH));
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const nextWidth = clampSidebarWidth(sidebarWidthRef.current + direction * 8);
    sidebarWidthRef.current = nextWidth;
    setSidebarWidth(nextWidth);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
  }

  return (
    <aside className={`home-sidebar${resizing ? " home-sidebar-resizing" : ""}`} ref={sidebar}>
      {resizing ? <div className="home-sidebar-resize-shield" /> : null}
      <div className="home-sidebar-header-spacer" aria-hidden="true" />
      <div className="home-sidebar-brand">
        <img src={brandMark} alt="PutengGame" />
        <span>PutengGame</span>
      </div>
      <nav aria-label="Main navigation">
        <NavigationItem active={active === "home"} icon="home" label="Home" onClick={() => onNavigate("home")} />
        <NavigationItem active={active === "projects"} icon="project" label="Projects" onClick={() => onNavigate("projects")} />
        <NavigationItem active={active === "library"} icon="library" label="Library" onClick={() => onNavigate("library")} />
        <NavigationItem active={active === "community"} icon="community" label="Community" onClick={() => onNavigate("community")} />
        <div className="home-nav-label home-nav-label-spaced">STUDIOS</div>
        <NavigationItem active={active === "web-game"} icon="web-game" label="Web Game" onClick={() => onNavigate("web-game")} />
        <NavigationItem active={active === "interactive-story"} icon="interactive-story" label="Interactive Story" onClick={() => onNavigate("interactive-story")} />
        <NavigationItem active={active === "godot"} icon="godot" label="Godot" onClick={() => onNavigate("godot")} />
        <NavigationItem active={active === "asset-canvas"} icon="asset-canvas" label="Asset Canvas" onClick={() => onNavigate("asset-canvas")} />
        <NavigationItem active={active === "general"} icon="general" label="General Game" onClick={() => onNavigate("general")} />
      </nav>
      {auth.state.status === "signed-in" ? (
        <div className="home-sidebar-account" ref={account}>
          <button className="home-sidebar-account-main" type="button" aria-label="Open account menu" aria-expanded={accountMenuOpen} onClick={() => {
            setAccountMenuOpen((open) => !open);
          }}>
            <UserAvatar className="home-sidebar-avatar" name={auth.state.user.name} avatarUrl={auth.state.user.avatarUrl} />
            <span className="home-sidebar-account-name" title={auth.state.user.email}>{auth.state.user.name}</span>
          </button>
          <button
            className="home-sidebar-message"
            type="button"
            aria-label="System messages"
            title="System messages"
            onClick={() => { window.location.hash = messagesHash(); }}
          >
            <Bell size={16} />
          </button>
          {updateButton}
          {accountMenuOpen ? <AccountPopover auth={auth} update={update} onNavigate={onNavigate} onClose={() => setAccountMenuOpen(false)} /> : null}
        </div>
      ) : (
        <div className="home-sidebar-account" ref={account}>
          <button className="home-sidebar-sign-in-main" type="button" onClick={auth.openSignIn} disabled={auth.state.status === "loading"}>
            <span className="home-sidebar-signed-out-icon" aria-hidden="true"><UserRound size={16} /></span>
            <span className="home-sidebar-account-name">{auth.state.status === "loading" ? "Loading account" : "Sign in"}</span>
          </button>
          {updateButton}
        </div>
      )}
      <div
        className="home-sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onDoubleClick={resetWidth}
        onKeyDown={resizeWithKeyboard}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          resizingRef.current = true;
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientX);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          finishResize();
        }}
        onPointerCancel={finishResize}
        onLostPointerCapture={finishResize}
      />
    </aside>
  );
}

function AccountPopover({
  auth,
  update,
  onNavigate,
  onClose,
}: {
  auth: ReturnType<typeof useAuth>;
  update: DesktopUpdateState | null;
  onNavigate: (page: AppNavigationTarget) => void;
  onClose: () => void;
}) {
  const updateStatus = update?.status.type;
  const [copiedId, setCopiedId] = useState(false);
  const accountId = auth.state.status === "signed-in" ? auth.state.user.email ?? auth.state.user.id : "PutengGame";

  async function copyAccountId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1500);
    } catch {
      setCopiedId(false);
    }
  }

  function checkForUpdates(): void {
    onClose();
    void window.putengGameDesktop?.updates.check();
  }

  function openFeedback(): void {
    onClose();
    window.open("https://github.com/zhangjunjie127/tool/issues/new", "_blank", "noopener,noreferrer");
  }

  async function signOut(): Promise<void> {
    onClose();
    await auth.signOut();
  }

  return (
    <div className="home-sidebar-account-popover home-sidebar-account-popover-rich" role="menu">
      <div className="home-account-popover-profile">
        <UserAvatar className="home-account-popover-avatar" name={auth.state.status === "signed-in" ? auth.state.user.name : "PutengGame"} avatarUrl={auth.state.status === "signed-in" ? auth.state.user.avatarUrl : undefined} />
        <div className="home-account-popover-profile-copy">
          <strong>{auth.state.status === "signed-in" ? auth.state.user.name : "PutengGame"}</strong>
          {auth.state.status === "signed-in" ? (
            <div className="home-account-popover-id">
              <span>{accountId}</span>
              <button type="button" aria-label={copiedId ? "Copied" : "Copy ID"} title={copiedId ? "Copied" : "Copy ID"} onClick={() => void copyAccountId()}>
                {copiedId ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="home-account-popover-plan">
        <div>
          <span>Current plan</span>
          <strong>Trial</strong>
        </div>
        <div>
          <span>Points balance</span>
          <strong>1,306</strong>
        </div>
        <div className="home-account-popover-plan-actions">
          <button type="button" onClick={() => { onClose(); window.location.hash = "#/settings/billing"; }}>Upgrade plan</button>
          <button type="button" onClick={() => { onClose(); window.location.hash = "#/settings/points"; }}>Buy points</button>
        </div>
      </div>

      <div className="home-account-popover-divider" />
      <div className="home-account-popover-actions">
        <button type="button" role="menuitem" onClick={() => { onClose(); onNavigate("settings"); }}>
          <Settings size={17} />
          <span>Settings</span>
        </button>
        <button type="button" role="menuitem" onClick={openFeedback}>
          <CircleHelp size={17} />
          <span>Feedback</span>
        </button>
        <button type="button" role="menuitem" onClick={checkForUpdates}>
          <RefreshCw size={17} />
          <span>Check for updates</span>
          {updateStatus === "available" ? <small>Available</small> : null}
        </button>
      </div>

      <div className="home-account-popover-divider" />
      <button className="home-account-popover-sign-out" type="button" role="menuitem" onClick={() => void signOut()}>
        <UserRound size={17} />
        <span>Sign out</span>
      </button>
    </div>
  );
}

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function readSidebarWidth(): number {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : DEFAULT_SIDEBAR_WIDTH;
}

function NavigationItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: "home" | "project" | "library" | "general" | "web-game" | "interactive-story" | "godot" | "asset-canvas" | "community";
  label: string;
  onClick: () => void;
}) {
  const content = <>{icon === "web-game" || icon === "general" ? <span className="home-nav-symbol" aria-hidden="true">{icon === "general" ? <Gamepad2 size={16} /> : <Globe2 size={16} />}</span> : <span className={`home-nav-icon home-nav-icon-${icon}`} aria-hidden="true" />}<span>{label}</span></>;
  return (
    <button
      className={`home-nav-item${active ? " home-nav-item-active" : ""}`}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  );
}
