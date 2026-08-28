import type { LucideIcon, LucideProps } from "lucide-react";
import {
  BookOpen,
  Clock,
  Coffee,
  CookingPot,
  DoorOpen,
  Home,
  Info,
  Moon,
  Mountain,
  Sparkles,
  StickyNote,
  TriangleAlert,
  User,
  Users,
  Utensils,
} from "lucide-react";

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
