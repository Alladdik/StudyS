import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

/**
 * App-wide crash guard. A render error in any page now shows a friendly fallback
 * with a reload option instead of a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="text-5xl mb-4">😵</div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white mb-2">Щось пішло не так</h1>
          <p className="text-ink-500 dark:text-[#9aa2bd] text-sm mb-6">
            Сталася неочікувана помилка на сторінці. Спробуйте перезавантажити — ваші дані в безпеці.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              Перезавантажити
            </button>
            <button
              onClick={() => { this.setState({ hasError: false }); window.history.back(); }}
              className="btn btn-soft">
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }
}
