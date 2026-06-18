import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erro desconhecido' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado nesta página</h2>
            <p className="text-sm text-muted-foreground">{this.state.message}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleRetry}>
              Tentar novamente
            </Button>
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recarregar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
