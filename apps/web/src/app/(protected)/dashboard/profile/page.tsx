import { redirect } from "next/navigation";
import { paths } from "@/shared/config/paths";

export default function DashboardProfilePage() {
  redirect(paths.profile);
}
