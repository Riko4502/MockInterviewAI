"use client";

import {
  type JoinMeetingResponseDto,
  useProfileControllerGetMyProfile,
  useSessionsControllerEndMeeting,
  useSessionsControllerGetMeetingLobby,
  useSessionsControllerJoinMeeting,
} from "@packages/api";
import { Button, Card, Spin } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MeetingRole } from "@/entities/meeting-participant";
import { useSession } from "@/entities/session";
import { useMeetingChat, useMeetingRoom } from "@/features/meeting-call";
import { paths } from "@/shared/config";
import {
  type MeetingJoinParams,
  MeetingPreFlightLobby,
  MeetingRoomWorkspace,
} from "@/widgets/meeting-room";

interface ActiveMeetingRoomProps {
  connectionData: JoinMeetingResponseDto;
  initialMic: boolean;
  initialCam: boolean;
  sessionTitle?: string;
  isPrivate?: boolean;
  onLeave: () => void;
  onEndCallForAll?: () => void;
}

/**
 * Изолированный контейнер активной встречи.
 * Связывает экземпляр LiveKit комнаты (useMeetingRoom) и DataChannel чат (useMeetingChat).
 */
function ActiveMeetingRoom({
  connectionData,
  initialMic,
  initialCam,
  sessionTitle,
  isPrivate,
  onLeave,
  onEndCallForAll,
}: ActiveMeetingRoomProps) {
  const [raisedHands, setRaisedHands] = useState<Set<string>>(() => new Set());

  const meetingRoom = useMeetingRoom({
    token: connectionData.mediaToken,
    serverUrl: connectionData.serverUrl,
    role: connectionData.role as MeetingRole,
    autoConnect: true,
    initialMicrophoneEnabled: initialMic,
    initialCameraEnabled: initialCam,
    raisedHandParticipantIds: raisedHands,
    onDisconnected: onLeave,
  });

  const chat = useMeetingChat({
    room: meetingRoom.room,
    localParticipantId: connectionData.participantId,
    localParticipantName: connectionData.displayName,
  });

  // Синхронизация списка участников с поднятой рукой
  useEffect(() => {
    setRaisedHands(chat.raisedHandParticipantIds);
  }, [chat.raisedHandParticipantIds]);

  return (
    <MeetingRoomWorkspace
      roomTitle={sessionTitle}
      isPrivate={isPrivate}
      isHost={connectionData.role === "HOST"}
      participants={meetingRoom.participants}
      localParticipant={meetingRoom.localParticipant}
      screenShareParticipant={meetingRoom.screenShareParticipant}
      messages={chat.messages}
      reactions={chat.reactions}
      unreadMessagesCount={chat.unreadCount}
      isMicrophoneEnabled={meetingRoom.isMicrophoneEnabled}
      isCameraEnabled={meetingRoom.isCameraEnabled}
      isScreenSharing={meetingRoom.isScreenSharing}
      isHandRaised={chat.isLocalHandRaised}
      onToggleMicrophone={meetingRoom.toggleMicrophone}
      onToggleCamera={meetingRoom.toggleCamera}
      onToggleScreenShare={meetingRoom.toggleScreenShare}
      onToggleHand={chat.toggleRaiseHand}
      onSendReaction={chat.sendReaction}
      onSendMessage={chat.sendMessage}
      onResetUnreadCount={chat.resetUnreadCount}
      onLeaveCall={async () => {
        await meetingRoom.disconnect();
        onLeave();
      }}
      onEndCallForAll={
        onEndCallForAll
          ? async () => {
              await onEndCallForAll();
              await meetingRoom.disconnect();
              onLeave();
            }
          : undefined
      }
      onSwitchAudioInput={meetingRoom.switchAudioInput}
      onSwitchVideoInput={meetingRoom.switchVideoInput}
      onSwitchAudioOutput={meetingRoom.switchAudioOutput}
    />
  );
}

export interface MeetingPageClientProps {
  /** Идентификатор сессии звонка */
  sessionId: string;
}

/**
 * Клиентский контроллер страницы звонка /meet/[id].
 * Управляет переходами между лобби и звонком, авторизацией и API вызовами.
 */
export function MeetingPageClient({ sessionId }: MeetingPageClientProps) {
  const router = useRouter();
  const session = useSession({ optional: true });
  const isAuthenticated = Boolean(session?.isAuthenticated);

  // Получаем имя текущего пользователя, если он залогинен
  const { data: profile } = useProfileControllerGetMyProfile({
    query: {
      enabled: isAuthenticated,
    },
  });

  // Данные лобби встречи
  const {
    data: lobby,
    isLoading: isLobbyLoading,
    error: lobbyError,
  } = useSessionsControllerGetMeetingLobby(sessionId);

  // Мутации входа и завершения
  const { mutateAsync: joinMeeting, isPending: isJoining } =
    useSessionsControllerJoinMeeting();
  const { mutateAsync: endMeeting } = useSessionsControllerEndMeeting();

  const [view, setView] = useState<"lobby" | "workspace">("lobby");
  const [connectionData, setConnectionData] =
    useState<JoinMeetingResponseDto | null>(null);
  const [initialMedia, setInitialMedia] = useState({ mic: true, cam: true });
  const [joinError, setJoinError] = useState<string | null>(null);

  const defaultName = profile?.displayName || profile?.username || "";

  const handleJoin = async (params: MeetingJoinParams) => {
    setJoinError(null);
    try {
      const response = await joinMeeting({
        id: sessionId,
        data: {
          guestName: params.guestName,
          password: params.password,
        },
      });

      setConnectionData(response);
      setInitialMedia({
        mic: params.initialMicrophoneEnabled,
        cam: params.initialCameraEnabled,
      });
      setView("workspace");
    } catch {
      setJoinError(
        "Не удалось подключиться к встрече. Проверьте пароль или ссылку.",
      );
    }
  };

  const handleLeave = () => {
    setView("lobby");
    setConnectionData(null);
    if (isAuthenticated) {
      router.push(paths.dashboard);
    } else {
      router.push("/");
    }
  };

  const handleEndForAll = async () => {
    try {
      await endMeeting({ id: sessionId });
    } catch {
      // Игнорируем ошибки при завершении
    }
  };

  // Состояние загрузки лобби
  if (isLobbyLoading) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-background">
        <Spin size="lg" />
      </div>
    );
  }

  // Ошибка загрузки или комната не найдена
  if (lobbyError || !lobby) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center p-4 bg-background">
        <Card className="max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">
            Встреча не найдена
          </h1>
          <p className="text-sm text-muted-foreground">
            Ссылка на встречу недействительна или комната была удалена.
          </p>
          <Button
            onClick={() => router.push(isAuthenticated ? paths.dashboard : "/")}
          >
            Вернуться на главную
          </Button>
        </Card>
      </div>
    );
  }

  // Встреча закрыта
  if (lobby.status === "CLOSED") {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center p-4 bg-background">
        <Card className="max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">
            Встреча завершена
          </h1>
          <p className="text-sm text-muted-foreground">
            Организатор уже завершил этот созвон.
          </p>
          <Button
            onClick={() => router.push(isAuthenticated ? paths.dashboard : "/")}
          >
            Вернуться на главную
          </Button>
        </Card>
      </div>
    );
  }

  // Экран звонка
  if (view === "workspace" && connectionData) {
    return (
      <ActiveMeetingRoom
        connectionData={connectionData}
        initialMic={initialMedia.mic}
        initialCam={initialMedia.cam}
        sessionTitle={lobby.title}
        isPrivate={lobby.isPrivate}
        onLeave={handleLeave}
        onEndCallForAll={
          connectionData.role === "HOST" ? handleEndForAll : undefined
        }
      />
    );
  }

  // Экран лобби
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background">
      <MeetingPreFlightLobby
        sessionId={sessionId}
        sessionTitle={lobby.title}
        hostName={lobby.hostName}
        isPasswordRequired={lobby.isPasswordRequired}
        isAuthenticated={isAuthenticated}
        defaultName={defaultName}
        isJoining={isJoining}
        error={joinError}
        onJoin={handleJoin}
      />
    </div>
  );
}
