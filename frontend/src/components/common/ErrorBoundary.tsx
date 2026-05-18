import { Component, type ReactNode } from "react";

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error.message, info.componentStack);
    }
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
          <strong style={{ fontSize: 18, marginBottom: 8, display: "block" }}>
            Algo salio mal
          </strong>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            {this.state.error?.message || "Error inesperado al cargar este modulo."}
          </p>
          <button className="btn btn--secondary" onClick={this.handleReset}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
