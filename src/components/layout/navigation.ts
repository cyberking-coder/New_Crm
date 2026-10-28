import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BellRing,
  Puzzle,
  Video,
  Plus,
  Layers,
  Film,
  UserPlus,
  Users,
  Activity,
  MessageSquare,
  Target,
  GitBranch,
  ListTodo,
  Building2,
  LayoutTemplate,
  Mail,
  FileText,
  Workflow,
  BarChart3,
  Share2,
  LineChart,
  TrendingUp,
  DollarSign,
  Webhook,
  CreditCard,
  Plug,
  HeartPulse,
  Building,
  UsersRound,
  ShieldCheck,
  KeyRound,
  Receipt,
  ScrollText,
  Settings,
} from "lucide-react";
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Tasks & notifications", href: "/tasks", icon: BellRing },
    ],
  },
  {
    label: "Webinars",
    items: [
      { label: "All webinars", href: "/webinars", icon: Video },
      { label: "Create webinar", href: "/webinars/new", icon: Plus },
      { label: "Webinar series", href: "/webinars/series", icon: Layers },
      { label: "Recordings & replays", href: "/webinars/recordings", icon: Film },
    ],
  },
  {
    label: "Audience",
    items: [
      { label: "Registrations", href: "/audience/registrations", icon: UserPlus },
      { label: "Attendees", href: "/audience/attendees", icon: Users },
      { label: "Engagement", href: "/audience/engagement", icon: Activity },
      { label: "Questions & polls", href: "/audience/questions", icon: MessageSquare },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/sales/leads", icon: Target },
      { label: "Sales pipeline", href: "/sales/pipeline", icon: GitBranch },
      { label: "Follow-up queue", href: "/sales/follow-up", icon: ListTodo },
      { label: "Contacts & companies", href: "/sales/contacts", icon: Building2 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Landing pages", href: "/marketing/landing-pages", icon: LayoutTemplate },
      { label: "Email campaigns", href: "/marketing/campaigns", icon: Mail },
      { label: "Templates", href: "/marketing/templates", icon: FileText },
      { label: "Automation workflows", href: "/marketing/workflows", icon: Workflow },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Webinar performance", href: "/analytics/performance", icon: BarChart3 },
      { label: "Registration sources", href: "/analytics/sources", icon: Share2 },
      { label: "Attendance & engagement", href: "/analytics/engagement", icon: LineChart },
      { label: "Lead conversion", href: "/analytics/conversion", icon: TrendingUp },
      { label: "Revenue & attribution", href: "/analytics/revenue", icon: DollarSign },
    ],
  },
  {
    label: "Integrations",
    items: [
      { label: "Webinar provider", href: "/integrations/webinar", icon: Video },
      { label: "Email provider", href: "/integrations/email", icon: Mail },
      { label: "CRM", href: "/integrations/crm", icon: Plug },
      { label: "Payments", href: "/integrations/payments", icon: CreditCard },
      { label: "Webhooks", href: "/integrations/webhooks", icon: Webhook },
      { label: "Automation health", href: "/integrations/health", icon: HeartPulse },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Organization", href: "/settings/organization", icon: Building },
      { label: "Team members", href: "/settings/team", icon: UsersRound },
      { label: "Roles & permissions", href: "/settings/roles", icon: ShieldCheck },
      { label: "Plugins", href: "/settings/plugins", icon: Puzzle },
      { label: "API keys", href: "/settings/api-keys", icon: KeyRound },
      { label: "Billing", href: "/settings/billing", icon: Receipt },
      { label: "Audit logs", href: "/settings/audit-logs", icon: ScrollText },
    ],
  },
];

export const SETTINGS_ICON = Settings;
