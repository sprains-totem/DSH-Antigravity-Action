import { h, render } from 'preact';
import { App } from './App';
import './styles/app.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  render(<App />, rootEl);
}
