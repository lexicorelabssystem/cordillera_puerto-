import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  useEffect,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, type, leaving: false }]);

    setTimeout(() => {
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast-item toast-item--${item.type}${item.leaving ? " toast-item--leaving" : ""}`}
          >
            <span className="toast-item__icon">
              {item.type === "success" ? "\u2713" : item.type === "error" ? "\u2717" : item.type === "warning" ? "\u26A0" : "\u2139"}
            </span>
            <span className="toast-item__message">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
