import { ArrowLeft, Bell } from "./icons.js";
import { WindowDragRegion } from "./window-drag-region.js";

export function SystemMessagesPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="home-shell settings-page-shell system-messages-shell">
      <aside className="home-sidebar settings-page-sidebar">
        <div className="home-sidebar-header-spacer" aria-hidden="true" />
        <button className="settings-page-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>Back to app</span>
        </button>
      </aside>
      <section className="settings-page-content">
        <WindowDragRegion />
        <div className="settings-page-inner">
          <section className="settings-panel settings-overview-panel system-messages-panel">
            <header className="settings-panel-header"><h3>System messages</h3></header>
            <div className="system-messages-empty">
              <Bell size={24} />
              <strong>No system messages</strong>
              <p>System messages will appear here.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
