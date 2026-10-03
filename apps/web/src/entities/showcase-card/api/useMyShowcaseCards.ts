import { useShowcaseControllerFindMy } from "@packages/api";
import type { ShowcaseCardResponseDto } from "@packages/dto";

export function useMyShowcaseCards() {
  return useShowcaseControllerFindMy<ShowcaseCardResponseDto[]>(undefined);
}
