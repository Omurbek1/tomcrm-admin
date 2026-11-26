import { Alert, Button } from "antd";

/**
 * Данные не загрузились — честно говорим об этом и даём «Повторить», вместо
 * пустой таблицы или нулей, которые выглядят как настоящие («дел нет»).
 */
export const QueryError = ({
  what = "данные",
  onRetry,
  style,
}: {
  what?: string;
  onRetry?: () => unknown;
  style?: React.CSSProperties;
}) => (
  <Alert
    type="error"
    showIcon
    style={{ marginBottom: 12, ...style }}
    title={`Не удалось загрузить ${what}`}
    description="Проверьте интернет и попробуйте ещё раз. Если не помогает — сообщите разработчику."
    action={
      onRetry ? (
        <Button size="small" onClick={() => void onRetry()}>
          Повторить
        </Button>
      ) : undefined
    }
  />
);
