import { useState } from "react";
import { useRuntimeConnection } from "./runtime-connection.js";

export function RuntimeNotice() {
  const state = useRuntimeConnection();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  if (
    !window.putengGameDesktop?.runtimeService ||
    state.status === "ready" ||
    state.status === "stopped"
  )
    return null;
  const recovering =
    state.status === "starting" || state.status === "recovering" || pending;
  return (
    <aside
      className="runtime-notice"
      role={recovering ? "status" : "alert"}
      aria-live="polite"
    >
      <div>
        <strong>
          {recovering
            ? "Reconnecting to the background service…"
            : "The background service stopped"}
        </strong>
        <p>
          {recovering
            ? "Your current view and unsent message are kept open."
            : "You can restart the service and continue from this view."}
        </p>
        {state.error || error ? (
          <details>
            <summary>Error details</summary>
            <pre>{error ?? state.error}</pre>
          </details>
        ) : null}
      </div>
      {!recovering ? (
        <button
          type="button"
          onClick={() => {
            setPending(true);
            setError(undefined);
            void window
              .putengGameDesktop!.runtimeService!.restart()
              .catch((cause) =>
                setError(
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          Restart service
        </button>
      ) : null}
    </aside>
  );
}
