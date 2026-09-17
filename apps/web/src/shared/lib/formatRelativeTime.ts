export const formatRelativeTime = (date: string): string => {
  const now = Date.now();
  const createdAt = new Date(date).getTime();

  const diffInSeconds = Math.floor((now - createdAt) / 1000);

  if (diffInSeconds < 60) {
    return "только что";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} мин. назад`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInHours < 24) {
    return `${diffInHours} ч. назад`;
  }

  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays === 1) {
    return "вчера";
  }

  if (diffInDays < 7) {
    return `${diffInDays} дн. назад`;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
};
