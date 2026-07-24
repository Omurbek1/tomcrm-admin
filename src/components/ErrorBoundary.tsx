import { Button, Result } from "antd";
import { Component, type ReactNode } from "react";

import { reportError } from "../lib/report";

interface State {
  failed: boolean;
}

/**
 * Корневая граница ошибок: падение любого компонента → аккуратный экран с
 * повтором/перезагрузкой (а не белый экран), плюс отчёт в мониторинг.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, { boundary: "root" });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Result
        status="warning"
        title="Что-то пошло не так"
        subTitle="Мы уже знаем об ошибке. Попробуйте ещё раз."
        style={{ minHeight: "60vh", display: "grid", placeContent: "center" }}
        extra={[
          <Button
            key="reload"
            type="primary"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </Button>,
          <Button
            key="retry"
            onClick={() => this.setState({ failed: false })}
          >
            Попробовать снова
          </Button>,
        ]}
      />
    );
  }
}
