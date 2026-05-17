import {
  Baby,
  Car,
  Dumbbell,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Laptop,
  Gift,
  PawPrint,
  Plane,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  baby: Baby,
  car: Car,
  dumbbell: Dumbbell,
  gift: Gift,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "heart-pulse": HeartPulse,
  home: Home,
  laptop: Laptop,
  "paw-print": PawPrint,
  plane: Plane,
  "play-circle": PlayCircle,
  shield: ShieldCheck,
  sparkles: Sparkles,
  utensils: UtensilsCrossed,
  wallet: Wallet,
};

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICON_MAP[name] ?? Package;
}
