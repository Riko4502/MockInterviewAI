import { NotificationBell } from "./NotificationBell";

export const Header = () => {
  return (
    <header className="flex h-14 items-center border-b border-border px-6">
      {/* TODO: Good evening, {userName} */}

      <div className="ml-auto flex items-center gap-4">
        <NotificationBell />

        {/* TODO: New Interview button */}
      </div>
    </header>
  );
};
