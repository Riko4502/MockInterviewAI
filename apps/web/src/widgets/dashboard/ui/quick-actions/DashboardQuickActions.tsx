"use client";

import { CameraIcon, CodeIcon, UsersIcon, ZapIcon } from "@packages/icons";
import { Badge, Button, Card, Dialog, Typography } from "@packages/ui";
import Link from "next/link";
import { lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

const QuickAiInterviewDialog = lazy(() => import("./QuickAiInterviewDialog"));
const CreateMeetingDialog = lazy(() =>
  import("@/features/meeting-call").then((m) => ({
    default: m.CreateMeetingDialog,
  })),
);
const actionClassName =
  "h-full min-h-36 w-full flex-col items-start gap-3 whitespace-normal rounded-xl p-5 text-left";

export function DashboardQuickActions() {
  const { t } = useTranslation(["dashboard", "meeting"]);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);

  return (
    <section aria-labelledby="dashboard-quick-actions" className="space-y-4">
      <Typography as="h2" variant="large" id="dashboard-quick-actions">
        {t("quickActions.title")}
      </Typography>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-0">
          <Button
            variant="ghost"
            onClick={() => setMeetingDialogOpen(true)}
            className={actionClassName}
          >
            <div className="flex w-full items-center justify-between">
              <CameraIcon aria-hidden="true" className="size-6 text-primary" />
              <Badge
                variant="outline"
                className="text-xs font-normal border-primary/40 text-primary"
              >
                {t("meeting:createMeeting.instantCall", "Мгновенно")}
              </Badge>
            </div>
            <span className="text-base font-semibold">
              {t("meeting:createMeeting.title", "Создать встречу")}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {t(
                "meeting:createMeeting.description",
                "Мгновенный созвон 1-на-1 или групповой митап по ссылке без регистрации",
              )}
            </span>
          </Button>
          {meetingDialogOpen && (
            <Suspense fallback={null}>
              <CreateMeetingDialog
                open={meetingDialogOpen}
                onOpenChange={setMeetingDialogOpen}
              />
            </Suspense>
          )}
        </Card>
        <Card className="p-0">
          <Dialog open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" className={actionClassName}>
                <div className="flex w-full items-center justify-between">
                  <ZapIcon aria-hidden="true" className="size-6 text-primary" />
                  <Badge variant="secondary" className="text-xs font-normal">
                    {t("aiDialog.soon")}
                  </Badge>
                </div>
                <span className="text-base font-semibold">
                  {t("quickActions.aiInterview")}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {t("quickActions.aiDescription")}
                </span>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content
              showCloseButton={false}
              className="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none"
            >
              <Dialog.Header>
                <Dialog.Title>{t("aiDialog.title")}</Dialog.Title>
                <Dialog.Description>
                  {t("aiDialog.description")}
                </Dialog.Description>
              </Dialog.Header>
              {open && (
                <Suspense fallback={<p>{t("loading.section")}</p>}>
                  <QuickAiInterviewDialog />
                </Suspense>
              )}
              <p
                id={`${id}-unavailable`}
                className="text-sm text-muted-foreground"
              >
                {t("aiDialog.unavailable")}
              </p>
              <Dialog.Footer>
                <Dialog.Close asChild>
                  <Button variant="outline">{t("aiDialog.close")}</Button>
                </Dialog.Close>
                <Button disabled aria-describedby={`${id}-unavailable`}>
                  {t("aiDialog.start")}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </Card>
        <Card className="p-0">
          <Button asChild variant="ghost" className={actionClassName}>
            <Link href={paths.partners}>
              <UsersIcon aria-hidden="true" className="size-6 text-primary" />
              <span className="text-base font-semibold">
                {t("quickActions.findPartner")}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {t("quickActions.partnersDescription")}
              </span>
            </Link>
          </Button>
        </Card>
        <Card className="p-0">
          <Button asChild variant="ghost" className={actionClassName}>
            <Link href={paths.sandbox}>
              <CodeIcon aria-hidden="true" className="size-6 text-primary" />
              <span className="text-base font-semibold">
                {t("quickActions.sandbox")}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {t("quickActions.sandboxDescription")}
              </span>
            </Link>
          </Button>
        </Card>
      </div>
    </section>
  );
}
