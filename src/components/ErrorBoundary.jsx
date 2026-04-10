import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 16, color: '#DC2626' }}>
        Erreur : {this.state.error.message}
      </div>
    );
    return this.props.children;
  }
}
