import { h, render, Component } from 'preact';
import { App } from './App';
import './styles/app.css';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style="padding: 20px; color: red; background: white; font-family: monospace;">
          <h2>UI Crash</h2>
          <pre style="white-space: pre-wrap;">{String(this.state.error.stack || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
    rootEl
  );
}
