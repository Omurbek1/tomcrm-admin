import type { useAppProps } from "antd/es/app/context";

/**
 * Закрыть окно редактирования: если есть несохранённые правки — сначала
 * спросить (случайный клик мимо окна или Esc больше не теряет ввод).
 */
export const confirmDiscard = (
  modal: useAppProps["modal"],
  dirty: boolean,
  close: () => void,
): void => {
  if (!dirty) {
    close();
    return;
  }
  modal.confirm({
    title: "Закрыть без сохранения?",
    content: "Изменения в этом окне не сохранены и пропадут.",
    okText: "Закрыть",
    okButtonProps: { danger: true },
    cancelText: "Продолжить правку",
    autoFocusButton: "cancel",
    onOk: close,
  });
};
