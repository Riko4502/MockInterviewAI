import type {
  ExperienceLevel,
  InterviewLanguage,
  PublicUserCardDto,
  ShowcaseCardResponseDto,
  ShowcaseCardStatsDto,
  ShowcaseCardStatus,
  Specialization,
} from "@packages/dto";

export type {
  ExperienceLevel,
  InterviewLanguage,
  PublicUserCardDto,
  ShowcaseCardResponseDto,
  ShowcaseCardStatsDto,
  ShowcaseCardStatus,
  Specialization,
};

export interface ShowcaseCardProps {
  card: ShowcaseCardResponseDto;
  isOwner?: boolean;
  onRespond?: (card: ShowcaseCardResponseDto) => void;
  onManage?: (card: ShowcaseCardResponseDto) => void;
  isRequested?: boolean;
  className?: string;
  testId?: string;
}
