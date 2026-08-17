import { Stack } from "@packages/ui";

export default function Home() {
  return (
    <main className="p-10">
      <Stack direction="column" gap="64" align="center" className="border p-6">
        <div className="bg-gray-200 p-4">Первый элемент</div>
        <div className="bg-gray-200 p-4">Второй элемент</div>
        <div className="bg-gray-200 p-4">Третий элемент</div>
      </Stack>
    </main>
  );
}
