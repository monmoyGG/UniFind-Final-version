import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Last line of defence: a rendering crash shows a readable screen instead of a
 * blank page (never leave the member staring at nothing).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[UniFind] render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="page page-narrow">
        <div className="state-block raised state-error">
          <div className="state-icon danger">
            <AlertTriangle size={26} />
          </div>
          <h2>UniFind ran into a problem.</h2>
          <p>
            The page could not be displayed. Reloading usually fixes it — if it keeps happening,
            check that the backend is running on port 8000.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={15} /> Reload UniFind
          </button>
        </div>
      </div>
    );
  }
}
