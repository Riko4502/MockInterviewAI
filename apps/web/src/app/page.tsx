import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold text-foreground">Mock Interview AI</h1>

      <nav className="flex gap-4">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Войти
        </Link>

        <Link
          href="/register"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-background transition-colors hover:bg-primary/80"
        >
          Зарегистрироваться
        </Link>
      </nav>
    </main>
  );
}
