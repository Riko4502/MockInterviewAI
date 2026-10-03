"use client";

import {
  Alert,
  Avatar,
  Button,
  Card,
  Typography,
  useToast,
} from "@packages/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  useAcceptMatchMutation,
  useRejectMatchMutation,
} from "../../model/use-dashboard-mutations";
import { useMatchRequests } from "../../model/use-dashboard-queries";
import { DashboardMatchRequestsSkeleton } from "./DashboardMatchRequestsSkeleton";

export function DashboardMatchRequests() {
  const { t } = useTranslation("dashboard");
  const query = useMatchRequests();
  const accept = useAcceptMatchMutation();
  const reject = useRejectMatchMutation();
  const toast = useToast();
  // Синхронная блокировка по идентификатору также защищает от кликов до следующего рендеринга React.
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());

  async function respond(id: string, action: "accept" | "reject") {
    if (locks.current.has(id)) return;
    locks.current.add(id);
    setPending(new Set(locks.current));
    try {
      if (action === "accept") await accept.mutateAsync({ id });
      else await reject.mutateAsync({ id, data: {} });
    } catch {
      toast.push({
        status: "error",
        title: t(
          action === "accept" ? "errors.acceptMatch" : "errors.rejectMatch",
        ),
      });
    } finally {
      // Удаление оптимистического слоя восстанавливает неизменённые серверные данные при ошибке.
      locks.current.delete(id);
      setPending(new Set(locks.current));
    }
  }

  if (query.isPending) return <DashboardMatchRequestsSkeleton />;
  const items = query.data?.items.filter((item) => !pending.has(item.id)) ?? [];
  return (
    <Card className="min-h-64 gap-4">
      <Typography as="h2" variant="large">
        {t("matchRequests.title")}
      </Typography>
      {!query.data ? (
        <Alert variant="destructive">
          <Alert.Description>{t("errors.matchRequests")}</Alert.Description>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("errors.retry")}
          </Button>
        </Alert>
      ) : items.length === 0 ? (
        <output className="text-sm text-muted-foreground">
          {t("emptyStates.matchRequests")}
        </output>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const name =
              item.senderName?.trim() || t("matchRequests.senderFallback");
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-3 border-b border-border pb-4 last:border-0"
              >
                <Avatar className="size-10 shrink-0">
                  {item.senderAvatarUrl && (
                    <Avatar.Image src={item.senderAvatarUrl} alt="" />
                  )}
                  <Avatar.Fallback>
                    {name.slice(0, 1).toLocaleUpperCase()}
                  </Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-medium">{name}</p>
                  {item.specialization && (
                    <p className="text-sm">
                      {t(`specializations.${item.specialization}`)}
                    </p>
                  )}
                  {item.skills.length > 0 && (
                    <p className="break-words text-sm text-muted-foreground">
                      {item.skills.join(", ")}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t("matchRequests.timeUnspecified")}
                  </p>
                  {item.message && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {item.message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      disabled={pending.has(item.id)}
                      onClick={() => void respond(item.id, "accept")}
                    >
                      {t("matchRequests.accept")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending.has(item.id)}
                      onClick={() => void respond(item.id, "reject")}
                    >
                      {t("matchRequests.reject")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
