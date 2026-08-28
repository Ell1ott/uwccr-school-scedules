import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Atom,
  BookMarked,
  BookOpen,
  BookText,
  Brain,
  Calculator,
  Clock,
  Coffee,
  CookingPot,
  DoorOpen,
  Drama,
  FlaskConical,
  Home,
  Info,
  Landmark,
  Languages,
  Leaf,
  Lightbulb,
  Microscope,
  Moon,
  Mountain,
  Palette,
  Scale,
  Sparkles,
  StickyNote,
  TriangleAlert,
  TrendingUp,
  User,
  Users,
  Utensils,
  Variable,
} from "lucide-react";
import { usePalette } from "./palette";
import { subjectKey, type SubjectKey } from "./tones";

const ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  utensils: Utensils,
  "cooking-pot": CookingPot,
  users: Users,
  mountain: Mountain,
  home: Home,
  clock: Clock,
  moon: Moon,
  sparkles: Sparkles,
  "book-open": BookOpen,
  user: User,
  "door-open": DoorOpen,
  info: Info,
  warning: TriangleAlert,
  "sticky-note": StickyNote,
};

const LESSON_ICONS: Record<SubjectKey, LucideIcon> = {
  biology: Microscope,
  chemistry: FlaskConical,
  physics: Atom,
  ess: Leaf,
  psychology: Brain,
  "math-aa": Variable,
  "math-ai": Calculator,
  "english-lit": BookOpen,
  "english-ll": BookText,
  "english-b": Languages,
  "spanish-b": Languages,
  "spanish-ll": Languages,
  "spanish-ab": Languages,
  "french-b": Languages,
  ssst: Languages,
  history: Landmark,
  economics: TrendingUp,
  "global-politics": Scale,
  anthropology: Users,
  "visual-arts": Palette,
  theatre: Drama,
  tok: Lightbulb,
  fallback: BookMarked,
};

export const LESSON_ICON_PREVIEWS = ["Biology", "Chemistry", "Physics"] as const;

export function EventIcon({
  name,
  size = 12,
  className,
  ...props
}: { name?: string } & LucideProps) {
  const Icon = (name && ICONS[name]) || Info;
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
      {...props}
    />
  );
}

export function LessonIcon({
  subject,
  size = 16,
  className,
  ...props
}: { subject: string } & LucideProps) {
  const Icon = LESSON_ICONS[subjectKey(subject)];
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
      {...props}
    />
  );
}

export function LessonMark({
  subject,
  size = 16,
  className,
}: {
  subject: string;
  size?: number;
  className?: string;
}) {
  const { showLessonIcons } = usePalette();
  if (!showLessonIcons) return null;
  return <LessonIcon subject={subject} size={size} className={className} />;
}
