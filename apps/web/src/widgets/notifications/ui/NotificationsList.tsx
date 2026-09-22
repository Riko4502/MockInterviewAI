"use client";

import type { NotificationsControllerGetNotificationsParams } from "@packages/api";
import { BellIcon } from "@packages/icons";
import {
  Button,
  Empty,
  Pagination,
  Skeleton,
  Tabs,
  Typography,
} from "@packages/ui";
import { type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useNotificationsQuery } from "@/entities/notification";
import { NotificationActions } from "@/features/notification-actions";

type Category = NotificationsControllerGetNotificationsParams["category"];
const NotificationsPanel = ({ category }: { category?: Category }) => {
  const { t } = useTranslation("common");
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isFetching, refetch } =
    useNotificationsQuery({
      page,
      limit: 20,
      category,
    });

  useEffect(() => {
    if (data === undefined) return;

    const lastPage = Math.max(1, data.totalPages);
    if (page > lastPage) setPage(lastPage);
  }, [data, page]);

  const totalPages = Math.max(1, data?.totalPages ?? page);
  const visiblePages =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : [...new Set([1, page - 1, page, page + 1, totalPages])]
          .filter((value) => value >= 1 && value <= totalPages)
          .sort((a, b) => a - b);
  const previousDisabled = page === 1 || isFetching;
  const nextDisabled = page >= (data?.totalPages ?? 0) || isFetching;
  const changePage =
    (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (!isFetching && target >= 1 && target <= totalPages) setPage(target);
    };
  if (isPending) {
    return (
      <output
        aria-label={t("notifications.loading")}
        className="block space-y-3"
      >
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </output>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-8">
        <Typography.Muted>{t("notifications.loadError")}</Typography.Muted>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("notifications.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!data?.items.length ? (
        <Empty title={t("notifications.empty")} media={<BellIcon />} />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {data.items.map((notification) => (
            <li key={notification.id} className="last:[&>div]:border-b-0">
              <NotificationActions notification={notification} />
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || (data?.totalPages ?? 0) > 1) && (
        <Pagination aria-label={t("notifications.pagination.label")}>
          <Pagination.Content className="flex-wrap">
            <Pagination.Item>
              <Pagination.Previous
                href="#"
                label={t("actions.back")}
                aria-label={t("notifications.pagination.previousAria")}
                aria-disabled={previousDisabled}
                tabIndex={previousDisabled ? -1 : 0}
                className={
                  previousDisabled
                    ? "pointer-events-none opacity-50"
                    : undefined
                }
                onClick={changePage(page - 1)}
              />
            </Pagination.Item>
            {visiblePages.map((value, index) => (
              <Pagination.Item key={value} className="flex items-center gap-1">
                {index > 0 && value - visiblePages[index - 1] > 1 && (
                  <Pagination.Ellipsis />
                )}
                <Pagination.Link
                  href="#"
                  aria-label={t("notifications.pagination.page", {
                    page: value,
                  })}
                  isActive={page === value}
                  aria-disabled={isFetching}
                  tabIndex={isFetching ? -1 : 0}
                  className={
                    isFetching ? "pointer-events-none opacity-50" : undefined
                  }
                  onClick={changePage(value)}
                >
                  {value}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                href="#"
                label={t("notifications.pagination.next")}
                aria-label={t("notifications.pagination.nextAria")}
                aria-disabled={nextDisabled}
                tabIndex={nextDisabled ? -1 : 0}
                className={
                  nextDisabled ? "pointer-events-none opacity-50" : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (!nextDisabled) setPage(page + 1);
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
};

export const NotificationsList = () => {
  const { t } = useTranslation("common");
  const FILTERS: { value: "ALL" | NonNullable<Category>; label: string }[] = [
    { value: "ALL", label: t("notifications.filters.all") },
    { value: "INTERVIEW", label: t("notifications.filters.interview") },
    { value: "MESSAGE", label: t("notifications.filters.message") },
    { value: "SYSTEM", label: t("notifications.filters.system") },
  ];

  return (
    <Tabs defaultValue="ALL">
      <div className="overflow-x-auto">
        <Tabs.List aria-label={t("notifications.categories")}>
          {FILTERS.map(({ value, label }) => (
            <Tabs.Trigger key={value} value={value}>
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      {FILTERS.map(({ value }) => (
        <Tabs.Content key={value} value={value} className="mt-6">
          <NotificationsPanel category={value === "ALL" ? undefined : value} />
        </Tabs.Content>
      ))}
    </Tabs>
  );
};
