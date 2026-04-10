import React from "react";
import { logger } from "@/utils/logger";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("ErrorBoundary", `渲染錯誤：${error.message}`, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh]  items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-error">
              Something went wrong
            </h1>
            <p className="mt-2 text-base-content/60">
              An unexpected error occurred.
            </p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
