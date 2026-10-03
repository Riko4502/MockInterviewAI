"use client";

import {
  getMatchmakingControllerFindIncomingQueryKey,
  getMatchmakingControllerFindOutgoingQueryKey,
  getMatchmakingControllerGetUnreadCountQueryKey,
  getShowcaseControllerFindAllQueryKey,
  getShowcaseControllerFindMyQueryKey,
  useMatchmakingControllerCreate,
} from "@packages/api";
import { MessageSquareIcon } from "@packages/icons";
import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LanguageBadge,
  LevelBadge,
  type ShowcaseCardResponseDto,
  SpecializationBadge,
  useMyShowcaseCards,
} from "@/entities/showcase-card";
import { UserAvatar } from "@/entities/user";
import "@/shared/lib/i18n";

export interface SendMatchRequestDialogProps {
  card: ShowcaseCardResponseDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function SendMatchRequestDialog({
  card,
  open,
  onOpenChange,
  onSuccess,
}: SendMatchRequestDialogProps) {
  const { t } = useTranslation("showcase");
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: myCardsRaw } = useMyShowcaseCards();
  const myCards = Array.isArray(myCardsRaw) ? myCardsRaw : [];
  const myActiveCards = myCards.filter((c) => c.status === "ACTIVE");

  const [senderCardId, setSenderCardId] = useState<string>("none");
  const [preferredTopic, setPreferredTopic] = useState("");
  const [message, setMessage] = useState("");

  const createMutation = useMatchmakingControllerCreate();

  if (!card) return null;

  const displayName =
    card.user.displayName || card.user.username || t("card.anonymousUser");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createMutation.mutate(
      {
        data: {
          targetCardId: card.id,
          senderCardId:
            senderCardId && senderCardId !== "none" ? senderCardId : undefined,
          preferredTopic: preferredTopic.trim() || undefined,
          message: message.trim() || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("matchmaking.sendSuccess"),
          });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: getMatchmakingControllerFindIncomingQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getMatchmakingControllerFindOutgoingQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getMatchmakingControllerGetUnreadCountQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getShowcaseControllerFindAllQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getShowcaseControllerFindMyQueryKey(),
            }),
          ]);
          onSuccess?.();
          onOpenChange(false);
          setPreferredTopic("");
          setMessage("");
          setSenderCardId("none");
        },
        onError: (err: unknown) => {
          const errMsg = extractErrorMessage(err, t("matchmaking.sendError"));
          toast.push({
            status: "error",
            title: errMsg,
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="w-full sm:max-w-lg max-w-lg p-0 overflow-hidden flex flex-col">
        <Dialog.Header className="px-6 pt-6 pb-4 border-b border-border/60">
          <Dialog.Title className="text-xl font-bold">
            {t("matchmaking.dialogTitle")}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mt-1">
            {t("matchmaking.dialogDescription")}
          </Dialog.Description>
        </Dialog.Header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[65vh]">
            {/* Визитка выбранного кандидата */}
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar
                  src={card.user.avatarUrl}
                  name={displayName}
                  size="md"
                  className="ring-2 ring-border/50 shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {displayName}
                  </span>
                  {card.user.username && (
                    <span className="text-xs text-muted-foreground truncate">
                      @{card.user.username}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <SpecializationBadge specialization={card.specialization} />
                <LevelBadge level={card.level} />
                <LanguageBadge language={card.language} />
              </div>
            </div>

            {/* Выбор своей анкеты (если есть активные) */}
            {myActiveCards.length > 0 && (
              <Field>
                <Field.Label>{t("matchmaking.attachCardLabel")}</Field.Label>
                <Field.Content>
                  <Select
                    value={senderCardId}
                    onValueChange={(val: string) => setSenderCardId(val)}
                  >
                    <Select.Trigger className="w-full">
                      <Select.Value
                        placeholder={t("matchmaking.attachCardPlaceholder")}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="none">
                        {t("matchmaking.attachCardPlaceholder")}
                      </Select.Item>
                      {myActiveCards.map((c) => (
                        <Select.Item key={c.id} value={c.id}>
                          {t(`levels.${c.level}`)}{" "}
                          {t(`specializations.${c.specialization}`)}{" "}
                          {c.title ? `— ${c.title}` : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field.Content>
              </Field>
            )}

            {/* Тема интервью */}
            <Field>
              <Field.Label>{t("matchmaking.topicLabel")}</Field.Label>
              <Field.Content>
                <Input
                  value={preferredTopic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPreferredTopic(e.target.value)
                  }
                  placeholder={t("matchmaking.topicPlaceholder")}
                  maxLength={100}
                />
              </Field.Content>
            </Field>

            {/* Сообщение */}
            <Field>
              <Field.Label>{t("matchmaking.messageLabel")}</Field.Label>
              <Field.Content>
                <Textarea
                  value={message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setMessage(e.target.value)
                  }
                  placeholder={t("matchmaking.messagePlaceholder")}
                  maxLength={300}
                  className="min-h-[85px] text-xs leading-relaxed"
                />
              </Field.Content>
            </Field>
          </div>

          <Dialog.Footer className="m-0 shrink-0 rounded-b-xl px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={createMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={createMutation.isPending}
              className="gap-1.5 font-semibold shadow-xs"
            >
              <MessageSquareIcon className="size-3.5" />
              <span>
                {createMutation.isPending
                  ? t("actions.loading")
                  : t("matchmaking.submitSend")}
              </span>
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
