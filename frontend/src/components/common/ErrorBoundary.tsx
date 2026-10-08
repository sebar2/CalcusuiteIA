import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 text-center space-y-4 my-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              {this.props.fallbackTitle || 'Error inesperado al renderizar el módulo'}
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-400 font-mono break-words">
              {this.state.error?.message || 'Inconsistencia en los datos recibidos o cálculo financiero no válido.'}
            </p>
          </div>
          <div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Reintentar carga del componente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
