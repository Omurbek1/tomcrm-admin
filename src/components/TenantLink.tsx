import { Button } from "antd";

import { openTenant } from "../lib/nav";

/** Название компании — кнопкой-ссылкой в её карточку (доступно с клавиатуры). */
export const TenantLink = ({
  id,
  name,
}: {
  id: string;
  name: string | null | undefined;
}) => (
  <Button
    type="link"
    size="small"
    style={{ padding: 0, height: "auto", maxWidth: "100%" }}
    onClick={(e) => {
      e.stopPropagation();
      openTenant(id);
    }}
  >
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {name || "Без названия"}
    </span>
  </Button>
);
