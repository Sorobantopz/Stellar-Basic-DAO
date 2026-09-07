import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { scrubPii } from "../../utils/piiScrubber";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Root-level error boundary. Without one, an uncaught render error in any
 * screen tears down the whole React tree and leaves the user staring at a
 * frozen app (or a native redbox). This catches the failure, logs it (PII-
 * scrubbed) and offers a Reload action that resets the boundary.
 *
 * Deliberately self-contained: no theme or provider dependencies, so the
 * fallback still renders when the crash happened inside a provider.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Error messages can embed account addresses or other identifiers —
    // scrub before they reach the console/log pipeline.
    // eslint-disable-next-line no-console
    console.error(
      "[ErrorBoundary]",
      scrubPii(error?.message ?? String(error)),
      info?.componentStack,
    );
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. Your wallet and data are safe — tap
          Reload to continue.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Reload the app"
        >
          <Text style={styles.buttonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    color: "#aaaabb",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
