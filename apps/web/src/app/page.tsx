import { redirect } from "next/navigation";
import { paths } from "@/shared/config";

export default function RootPage() {
  redirect(paths.login);
}
