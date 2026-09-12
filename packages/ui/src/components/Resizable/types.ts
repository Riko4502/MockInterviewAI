import type {
  GroupProps,
  PanelProps,
  SeparatorProps,
} from "react-resizable-panels";

export type ResizablePanelGroupProps = Omit<GroupProps, "orientation"> & {
  /**
   * Направление разделения панелей ("horizontal" или "vertical").
   * По умолчанию "horizontal".
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Псевдоним для orientation (для совместимости со стилем shadcn).
   */
  direction?: "horizontal" | "vertical";
};

export type ResizablePanelProps = PanelProps;

export type ResizableHandleProps = SeparatorProps & {
  /** Отображать ли визуальную плашку захвата с точками (Grip). */
  withHandle?: boolean;
};
