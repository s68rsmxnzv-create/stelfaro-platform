// @ts-nocheck
import {
  Boxes,
  BookText,
  ClipboardList,
  FileText,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-vue-next';

export const mobileIcons = {
  home: Home,
  documents: FileText,
  plus: Plus,
  workshop: Wrench,
  management: LayoutGrid,
  more: MoreHorizontal,
  customers: Users,
  catalog: BookText,
  inventory: Boxes,
  cash: Wallet,
  event: Zap,
  order: ClipboardList,
};

export function iconFor(name) {
  return mobileIcons[name] ?? FileText;
}
