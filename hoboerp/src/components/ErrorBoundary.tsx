import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {appErrorDialog, type AppDialogRequest} from './AppDialog';
import {logger} from '../services/logger';

type Props = {
  children: React.ReactNode;
  onShowDialog?: (dialog: AppDialogRequest) => void;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('Screen boundary caught an error', error, info.componentStack);
    this.props.onShowDialog?.(
      appErrorDialog(
        'Something went wrong',
        [error.message, info.componentStack].filter(Boolean).join('\n\n'),
      ),
    );
  }

  reset = () => {
    this.setState({error: null});
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            This section could not be rendered. The rest of the app is still
            available.
          </Text>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
