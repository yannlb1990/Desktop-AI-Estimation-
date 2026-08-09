import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  differenceInDays,
  parseISO,
  startOfWeek,
  isBefore,
  isAfter,
} from "date-fns";
import { toast } from "sonner";
import { getUserStorageKey } from "@/lib/localAuth";
import { loadScheduleMerged, syncScheduleToSupabase } from "@/lib/db/schedule";
import { syncProjectToSupabase } from "@/lib/db/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Printer,
  FileDown,
  FileSpreadsheet,
  Calendar,
  CalendarCheck,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SCOPE_OF_WORK_RATES } from "@/data/scopeOfWorkRates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleTask {
  id: string;
  name: string;
  trade: string;
  color: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  progress: number;
  notes: string;
  sowRef?: string;
}

type ViewMode = "daily" | "weekly" | "monthly";

interface GanttScheduleProps {
  projectId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_WIDTHS: Record<ViewMode, number> = { daily: 24, weekly: 80, monthly: 150 };

// ─── Phase grouping ───────────────────────────────────────────────────────────

const PHASE_DEFS = [
  { name: "Structure",      keywords: ["site work", "footing", "slab", "frame", "roof", "concret", "found"] },
  { name: "Envelope",       keywords: ["external", "envelope", "clad", "glazing", "brick", "masonry", "window"] },
  { name: "Services",       keywords: ["plumb", "electr", "insulat", "hydraul", "mechanical", "hvac", "drain"] },
  { name: "Finishes",       keywords: ["plasterboard", "drywall", "gyprock", "joinery", "cabinet", "tile", "paint", "floor", "lining"] },
  { name: "External Works", keywords: ["landscape", "paving", "fence", "external work"] },
];
const PHASE_ORDER = ["Structure", "Envelope", "Services", "Finishes", "External Works", "Other"];

function getPhase(task: ScheduleTask): string {
  const h = (task.name + " " + task.trade).toLowerCase();
  for (const def of PHASE_DEFS) {
    if (def.keywords.some((kw) => h.includes(kw))) return def.name;
  }
  return "Other";
}

// ─── Trade sequence ───────────────────────────────────────────────────────────

const TRADE_SEQUENCE = [
  { keywords: ["site", "earthwork", "excavat", "demolit"],              name: "Site Works",          duration: 5,  color: "#8B6914" },
  { keywords: ["footing", "slab", "concret", "found"],                  name: "Footings & Slab",     duration: 7,  color: "#6B7280" },
  { keywords: ["frame", "framing", "timber", "structural steel"],       name: "Frame",               duration: 10, color: "#92400E" },
  { keywords: ["roof"],                                                  name: "Roofing",             duration: 5,  color: "#1D4ED8" },
  { keywords: ["external", "clad", "window", "glazing", "brick", "masonry"], name: "External Envelope", duration: 7, color: "#B45309" },
  { keywords: ["plumb", "hydraul", "drain"],                            name: "Plumbing Rough-In",   duration: 3,  color: "#0369A1" },
  { keywords: ["electr", "power", "light"],                             name: "Electrical Rough-In", duration: 3,  color: "#CA8A04" },
  { keywords: ["insulat"],                                               name: "Insulation",          duration: 2,  color: "#15803D" },
  { keywords: ["plasterboard", "drywall", "gyprock", "lining"],        name: "Plasterboard",        duration: 5,  color: "#9D174D" },
  { keywords: ["joinery", "cabinet", "kitchen", "vanity", "wardrobe"], name: "Joinery",             duration: 5,  color: "#7C3AED" },
  { keywords: ["tile", "tiling"],                                        name: "Tiling",              duration: 4,  color: "#475569" },
  { keywords: ["paint"],                                                 name: "Painting",            duration: 5,  color: "#BE185D" },
  { keywords: ["floor"],                                                 name: "Flooring",            duration: 3,  color: "#B45309" },
  { keywords: ["landscape", "paving", "fence", "external work"],        name: "Landscaping",         duration: 5,  color: "#166534" },
];

function generateFromEstimate(estimateItems: any[], useWorkDays = false, activeHolSet: Set<string> = new Set()): ScheduleTask[] {
  let cursor = new Date();
  if (useWorkDays) while (!isWorkday(cursor, activeHolSet)) cursor = addDays(cursor, 1);
  return TRADE_SEQUENCE.map((entry) => {
    const startDate = format(cursor, "yyyy-MM-dd");
    const endDate = useWorkDays
      ? format(addWorkingDays(cursor, entry.duration, activeHolSet), "yyyy-MM-dd")
      : format(addDays(cursor, entry.duration - 1), "yyyy-MM-dd");
    const hasItems = estimateItems.some((item) => {
      const h = ((item.trade || "") + " " + (item.category || "") + " " + (item.scope_of_work || "")).toLowerCase();
      return entry.keywords.some((kw) => h.includes(kw));
    });
    const task: ScheduleTask = {
      id: crypto.randomUUID(),
      name: entry.name,
      trade: entry.name,
      color: entry.color,
      startDate,
      endDate,
      durationDays: differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
      progress: 0,
      notes: hasItems ? "" : "No estimate items matched – adjust dates as needed",
    };
    if (useWorkDays) {
      let next = addDays(parseISO(endDate), 1);
      while (!isWorkday(next, activeHolSet)) next = addDays(next, 1);
      cursor = next;
    } else {
      cursor = addDays(cursor, entry.duration);
    }
    return task;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ─── Working-day helpers ──────────────────────────────────────────────────────

type StateCode = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "ACT" | "TAS" | "NT";
interface HolidayEntry { date: string; name: string }

const STATE_HOLIDAYS: Record<StateCode, HolidayEntry[]> = {
  NSW: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-04-18", name: "Good Friday" }, { date: "2025-04-19", name: "Easter Saturday" },
    { date: "2025-04-21", name: "Easter Monday" }, { date: "2025-04-25", name: "Anzac Day" },
    { date: "2025-06-09", name: "King's Birthday" }, { date: "2025-08-04", name: "Bank Holiday" },
    { date: "2025-10-06", name: "Labour Day" }, { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-04-03", name: "Good Friday" }, { date: "2026-04-04", name: "Easter Saturday" },
    { date: "2026-04-06", name: "Easter Monday" }, { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-06-08", name: "King's Birthday" }, { date: "2026-08-03", name: "Bank Holiday" },
    { date: "2026-10-05", name: "Labour Day" }, { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-26", name: "Good Friday" }, { date: "2027-03-27", name: "Easter Saturday" },
    { date: "2027-03-29", name: "Easter Monday" }, { date: "2027-04-26", name: "Anzac Day" },
    { date: "2027-06-14", name: "King's Birthday" }, { date: "2027-08-02", name: "Bank Holiday" },
    { date: "2027-10-04", name: "Labour Day" }, { date: "2027-12-27", name: "Christmas Day" },
    { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-04-14", name: "Good Friday" }, { date: "2028-04-15", name: "Easter Saturday" },
    { date: "2028-04-17", name: "Easter Monday" }, { date: "2028-04-25", name: "Anzac Day" },
    { date: "2028-06-10", name: "King's Birthday" }, { date: "2028-08-07", name: "Bank Holiday" },
    { date: "2028-10-02", name: "Labour Day" }, { date: "2028-12-25", name: "Christmas Day" },
    { date: "2028-12-26", name: "Boxing Day" },
  ],
  VIC: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-03-10", name: "Labour Day" }, { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-19", name: "Easter Saturday" }, { date: "2025-04-21", name: "Easter Monday" },
    { date: "2025-04-25", name: "Anzac Day" }, { date: "2025-06-09", name: "King's Birthday" },
    { date: "2025-09-26", name: "AFL Grand Final Eve" }, { date: "2025-11-04", name: "Melbourne Cup" },
    { date: "2025-12-25", name: "Christmas Day" }, { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-03-09", name: "Labour Day" }, { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-04", name: "Easter Saturday" }, { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" }, { date: "2026-06-08", name: "King's Birthday" },
    { date: "2026-09-25", name: "AFL Grand Final Eve" }, { date: "2026-11-03", name: "Melbourne Cup" },
    { date: "2026-12-25", name: "Christmas Day" }, { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-08", name: "Labour Day" }, { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-27", name: "Easter Saturday" }, { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-04-26", name: "Anzac Day" }, { date: "2027-06-14", name: "King's Birthday" },
    { date: "2027-09-24", name: "AFL Grand Final Eve" }, { date: "2027-11-02", name: "Melbourne Cup" },
    { date: "2027-12-27", name: "Christmas Day" }, { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-03-13", name: "Labour Day" }, { date: "2028-04-14", name: "Good Friday" },
    { date: "2028-04-15", name: "Easter Saturday" }, { date: "2028-04-17", name: "Easter Monday" },
    { date: "2028-04-25", name: "Anzac Day" }, { date: "2028-06-10", name: "King's Birthday" },
    { date: "2028-09-29", name: "AFL Grand Final Eve" }, { date: "2028-11-07", name: "Melbourne Cup" },
    { date: "2028-12-25", name: "Christmas Day" }, { date: "2028-12-26", name: "Boxing Day" },
  ],
  QLD: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-04-18", name: "Good Friday" }, { date: "2025-04-19", name: "Easter Saturday" },
    { date: "2025-04-21", name: "Easter Monday" }, { date: "2025-04-25", name: "Anzac Day" },
    { date: "2025-05-05", name: "Labour Day" }, { date: "2025-08-13", name: "Brisbane Show" },
    { date: "2025-10-27", name: "King's Birthday" }, { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-04-03", name: "Good Friday" }, { date: "2026-04-04", name: "Easter Saturday" },
    { date: "2026-04-06", name: "Easter Monday" }, { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-05-04", name: "Labour Day" }, { date: "2026-08-12", name: "Brisbane Show" },
    { date: "2026-10-26", name: "King's Birthday" }, { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-26", name: "Good Friday" }, { date: "2027-03-27", name: "Easter Saturday" },
    { date: "2027-03-29", name: "Easter Monday" }, { date: "2027-04-26", name: "Anzac Day" },
    { date: "2027-05-03", name: "Labour Day" }, { date: "2027-08-11", name: "Brisbane Show" },
    { date: "2027-10-25", name: "King's Birthday" }, { date: "2027-12-27", name: "Christmas Day" },
    { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-04-14", name: "Good Friday" }, { date: "2028-04-15", name: "Easter Saturday" },
    { date: "2028-04-17", name: "Easter Monday" }, { date: "2028-04-25", name: "Anzac Day" },
    { date: "2028-05-01", name: "Labour Day" }, { date: "2028-08-09", name: "Brisbane Show" },
    { date: "2028-10-23", name: "King's Birthday" }, { date: "2028-12-25", name: "Christmas Day" },
    { date: "2028-12-26", name: "Boxing Day" },
  ],
  WA: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-03-03", name: "Labour Day" }, { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-19", name: "Easter Saturday" }, { date: "2025-04-21", name: "Easter Monday" },
    { date: "2025-04-25", name: "Anzac Day" }, { date: "2025-06-02", name: "WA Day" },
    { date: "2025-09-22", name: "King's Birthday" }, { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-03-02", name: "Labour Day" }, { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-04", name: "Easter Saturday" }, { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" }, { date: "2026-06-01", name: "WA Day" },
    { date: "2026-09-28", name: "King's Birthday" }, { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-01", name: "Labour Day" }, { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-27", name: "Easter Saturday" }, { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-04-26", name: "Anzac Day" }, { date: "2027-06-07", name: "WA Day" },
    { date: "2027-09-27", name: "King's Birthday" }, { date: "2027-12-27", name: "Christmas Day" },
    { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-03-06", name: "Labour Day" }, { date: "2028-04-14", name: "Good Friday" },
    { date: "2028-04-15", name: "Easter Saturday" }, { date: "2028-04-17", name: "Easter Monday" },
    { date: "2028-04-25", name: "Anzac Day" }, { date: "2028-06-05", name: "WA Day" },
    { date: "2028-09-25", name: "King's Birthday" }, { date: "2028-12-25", name: "Christmas Day" },
    { date: "2028-12-26", name: "Boxing Day" },
  ],
  SA: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-04-18", name: "Good Friday" }, { date: "2025-04-19", name: "Easter Saturday" },
    { date: "2025-04-21", name: "Easter Monday" }, { date: "2025-04-25", name: "Anzac Day" },
    { date: "2025-05-12", name: "Adelaide Cup" }, { date: "2025-06-09", name: "King's Birthday" },
    { date: "2025-10-20", name: "Labour Day" }, { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Proclamation Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-04-03", name: "Good Friday" }, { date: "2026-04-04", name: "Easter Saturday" },
    { date: "2026-04-06", name: "Easter Monday" }, { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-05-11", name: "Adelaide Cup" }, { date: "2026-06-08", name: "King's Birthday" },
    { date: "2026-10-19", name: "Labour Day" }, { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Proclamation Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-26", name: "Good Friday" }, { date: "2027-03-27", name: "Easter Saturday" },
    { date: "2027-03-29", name: "Easter Monday" }, { date: "2027-04-26", name: "Anzac Day" },
    { date: "2027-05-10", name: "Adelaide Cup" }, { date: "2027-06-14", name: "King's Birthday" },
    { date: "2027-10-18", name: "Labour Day" }, { date: "2027-12-27", name: "Christmas Day" },
    { date: "2027-12-28", name: "Proclamation Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-04-14", name: "Good Friday" }, { date: "2028-04-15", name: "Easter Saturday" },
    { date: "2028-04-17", name: "Easter Monday" }, { date: "2028-04-25", name: "Anzac Day" },
    { date: "2028-05-08", name: "Adelaide Cup" }, { date: "2028-06-10", name: "King's Birthday" },
    { date: "2028-10-16", name: "Labour Day" }, { date: "2028-12-25", name: "Christmas Day" },
    { date: "2028-12-26", name: "Proclamation Day" },
  ],
  ACT: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-03-10", name: "Canberra Day" }, { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-19", name: "Easter Saturday" }, { date: "2025-04-21", name: "Easter Monday" },
    { date: "2025-04-25", name: "Anzac Day" }, { date: "2025-05-26", name: "Reconciliation Day" },
    { date: "2025-06-09", name: "King's Birthday" }, { date: "2025-10-06", name: "Family & Community Day" },
    { date: "2025-12-25", name: "Christmas Day" }, { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-03-09", name: "Canberra Day" }, { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-04", name: "Easter Saturday" }, { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" }, { date: "2026-05-25", name: "Reconciliation Day" },
    { date: "2026-06-08", name: "King's Birthday" }, { date: "2026-10-05", name: "Family & Community Day" },
    { date: "2026-12-25", name: "Christmas Day" }, { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-08", name: "Canberra Day" }, { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-27", name: "Easter Saturday" }, { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-04-26", name: "Anzac Day" }, { date: "2027-05-31", name: "Reconciliation Day" },
    { date: "2027-06-14", name: "King's Birthday" }, { date: "2027-10-04", name: "Family & Community Day" },
    { date: "2027-12-27", name: "Christmas Day" }, { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-03-13", name: "Canberra Day" }, { date: "2028-04-14", name: "Good Friday" },
    { date: "2028-04-15", name: "Easter Saturday" }, { date: "2028-04-17", name: "Easter Monday" },
    { date: "2028-04-25", name: "Anzac Day" }, { date: "2028-05-29", name: "Reconciliation Day" },
    { date: "2028-06-10", name: "King's Birthday" }, { date: "2028-10-02", name: "Family & Community Day" },
    { date: "2028-12-25", name: "Christmas Day" }, { date: "2028-12-26", name: "Boxing Day" },
  ],
  TAS: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-03-10", name: "Eight Hours Day" }, { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-19", name: "Easter Saturday" }, { date: "2025-04-21", name: "Easter Monday" },
    { date: "2025-04-25", name: "Anzac Day" }, { date: "2025-06-09", name: "King's Birthday" },
    { date: "2025-12-25", name: "Christmas Day" }, { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-03-09", name: "Eight Hours Day" }, { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-04", name: "Easter Saturday" }, { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" }, { date: "2026-06-08", name: "King's Birthday" },
    { date: "2026-12-25", name: "Christmas Day" }, { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-08", name: "Eight Hours Day" }, { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-27", name: "Easter Saturday" }, { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-04-26", name: "Anzac Day" }, { date: "2027-06-14", name: "King's Birthday" },
    { date: "2027-12-27", name: "Christmas Day" }, { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-03-13", name: "Eight Hours Day" }, { date: "2028-04-14", name: "Good Friday" },
    { date: "2028-04-15", name: "Easter Saturday" }, { date: "2028-04-17", name: "Easter Monday" },
    { date: "2028-04-25", name: "Anzac Day" }, { date: "2028-06-10", name: "King's Birthday" },
    { date: "2028-12-25", name: "Christmas Day" }, { date: "2028-12-26", name: "Boxing Day" },
  ],
  NT: [
    { date: "2025-01-01", name: "New Year's Day" }, { date: "2025-01-27", name: "Australia Day" },
    { date: "2025-04-18", name: "Good Friday" }, { date: "2025-04-19", name: "Easter Saturday" },
    { date: "2025-04-21", name: "Easter Monday" }, { date: "2025-04-25", name: "Anzac Day" },
    { date: "2025-05-05", name: "May Day" }, { date: "2025-06-09", name: "King's Birthday" },
    { date: "2025-08-04", name: "Picnic Day" }, { date: "2025-12-25", name: "Christmas Day" },
    { date: "2025-12-26", name: "Boxing Day" },
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-04-03", name: "Good Friday" }, { date: "2026-04-04", name: "Easter Saturday" },
    { date: "2026-04-06", name: "Easter Monday" }, { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-05-04", name: "May Day" }, { date: "2026-06-08", name: "King's Birthday" },
    { date: "2026-08-03", name: "Picnic Day" }, { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day" },
    { date: "2027-01-01", name: "New Year's Day" }, { date: "2027-01-26", name: "Australia Day" },
    { date: "2027-03-26", name: "Good Friday" }, { date: "2027-03-27", name: "Easter Saturday" },
    { date: "2027-03-29", name: "Easter Monday" }, { date: "2027-04-26", name: "Anzac Day" },
    { date: "2027-05-03", name: "May Day" }, { date: "2027-06-14", name: "King's Birthday" },
    { date: "2027-08-02", name: "Picnic Day" }, { date: "2027-12-27", name: "Christmas Day" },
    { date: "2027-12-28", name: "Boxing Day" },
    { date: "2028-01-03", name: "New Year's Day" }, { date: "2028-01-26", name: "Australia Day" },
    { date: "2028-04-14", name: "Good Friday" }, { date: "2028-04-15", name: "Easter Saturday" },
    { date: "2028-04-17", name: "Easter Monday" }, { date: "2028-04-25", name: "Anzac Day" },
    { date: "2028-05-01", name: "May Day" }, { date: "2028-06-10", name: "King's Birthday" },
    { date: "2028-08-07", name: "Picnic Day" }, { date: "2028-12-25", name: "Christmas Day" },
    { date: "2028-12-26", name: "Boxing Day" },
  ],
};

function isWorkday(date: Date, activeHols: Set<string>): boolean {
  const d = date.getDay();
  if (d === 0 || d === 6) return false;
  if (activeHols.has(format(date, "yyyy-MM-dd"))) return false;
  return true;
}

function addWorkingDays(start: Date, n: number, activeHols: Set<string>): Date {
  let d = new Date(start);
  while (!isWorkday(d, activeHols)) d = addDays(d, 1);
  let remaining = n - 1;
  while (remaining > 0) { d = addDays(d, 1); if (isWorkday(d, activeHols)) remaining--; }
  return d;
}

function countWorkingDays(start: Date, end: Date, activeHols: Set<string>): number {
  let count = 0;
  let d = new Date(start);
  while (!isAfter(d, end)) { if (isWorkday(d, activeHols)) count++; d = addDays(d, 1); }
  return count;
}

// ─── Print HTML builder ───────────────────────────────────────────────────────

function buildPrintHTML(
  groupedTasks: { phase: string; tasks: ScheduleTask[] }[],
  projectName: string,
  brand: any,
  viewMode: ViewMode,
  columns: Date[],
  colW: number,
  rangeStart: Date,
  totalDays: number,
  todayPct: number,
  floatMap: Map<string, number> = new Map()
): string {
  const LEFT_W = 210;
  const ROW_H  = 44;
  const PH_H   = 26;
  const HDR_H  = 42;
  const NEAR_CRITICAL_DAYS = 7;
  const totalW = columns.length * colW;
  const totalContentW = LEFT_W + totalW;
  const zoom = Math.min(1, 1350 / totalContentW);
  const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const barPct = (date: Date) =>
    Math.max(0, Math.min(100, (differenceInDays(date, rangeStart) / totalDays) * 100));

  // Date column headers
  const dateHeaders = columns.map((col, i) => {
    const prev = i > 0 ? columns[i - 1] : null;
    let label = "";
    let bg = "transparent";
    if (viewMode === "monthly") {
      label = format(col, "MMM yy");
    } else if (viewMode === "weekly") {
      const newMonth = !prev || format(col, "MMM") !== format(prev, "MMM");
      label = newMonth ? `<strong>${format(col, "MMM")}</strong>` : format(col, "dd");
    } else {
      const wknd = col.getDay() === 0 || col.getDay() === 6;
      label = wknd ? "" : format(col, "d");
      if (wknd) bg = "rgba(0,0,0,0.04)";
    }
    return `<div style="flex-shrink:0;width:${colW}px;height:${HDR_H}px;border-right:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#64748b;background:${bg};">${label}</div>`;
  }).join("");

  // Today line html (reused)
  const todayLine = todayPct > 0 && todayPct < 100
    ? `<div style="position:absolute;top:0;bottom:0;left:${todayPct}%;width:2px;background:rgba(239,68,68,0.65);z-index:5;pointer-events:none;">
         <span style="position:absolute;top:2px;left:3px;font-size:7px;color:#ef4444;font-weight:700;white-space:nowrap;letter-spacing:.05em;">TODAY</span>
       </div>`
    : "";

  // Bar rows per group
  const groupRows = groupedTasks.map(({ phase, tasks: pt }) => {
    const phRow = `
      <div style="display:flex;height:${PH_H}px;">
        <div style="width:${LEFT_W}px;flex-shrink:0;background:#1e293b;border-right:1px solid #334155;border-bottom:1px solid #334155;display:flex;align-items:center;padding:0 10px;">
          <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;">${phase}</span>
        </div>
        <div style="width:${totalW}px;flex-shrink:0;background:#1e293b;border-bottom:1px solid #334155;position:relative;">
          ${todayLine}
        </div>
      </div>`;

    const taskRows = pt.map((task) => {
      const bl = barPct(parseISO(task.startDate));
      const br = barPct(addDays(parseISO(task.endDate), 1));
      const bw = Math.max(0.4, br - bl);
      const showLabel = bw > 5;
      const taskFloat   = floatMap.get(task.id) ?? 999;
      const isCritical  = taskFloat === 0;
      const isNearCrit  = !isCritical && taskFloat <= NEAR_CRITICAL_DAYS;
      const [fr, fg, fb] = hexToRgb(task.color);
      const floatEnd    = taskFloat > 0 && taskFloat < 999 ? Math.min(100, barPct(addDays(parseISO(task.endDate), taskFloat + 1))) : br;
      const floatW      = Math.max(0, floatEnd - br);
      const accentColor = isCritical ? '#ef4444' : isNearCrit ? '#f59e0b' : 'none';
      const dotHtml     = isCritical
        ? `<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;display:inline-block;margin-left:3px;"></span>`
        : isNearCrit
        ? `<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;flex-shrink:0;display:inline-block;margin-left:3px;"></span>`
        : '';
      return `
        <div style="display:flex;height:${ROW_H}px;border-bottom:1px solid #f1f5f9;">
          <div style="width:${LEFT_W}px;flex-shrink:0;border-right:1px solid #e2e8f0;display:flex;align-items:center;padding:0 8px;gap:6px;overflow:hidden;">
            <div style="width:3px;height:28px;flex-shrink:0;background:${task.color};border-radius:2px;"></div>
            <div style="overflow:hidden;flex:1;">
              <div style="font-size:11px;font-weight:600;color:#000000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:3px;">${task.name}${dotHtml}</div>
              <div style="font-size:9px;color:#64748b;">${format(parseISO(task.startDate), "dd MMM")}–${format(parseISO(task.endDate), "dd MMM")} · ${task.durationDays}d${task.progress > 0 ? ` · ${task.progress}%` : ""}${taskFloat < 999 && taskFloat > 0 ? ` · ${taskFloat}d float` : ''}</div>
            </div>
          </div>
          <div style="width:${totalW}px;flex-shrink:0;position:relative;overflow:hidden;">
            ${todayLine}
            ${floatW > 0.5 ? `<div style="position:absolute;left:${br}%;width:${floatW}%;top:50%;transform:translateY(-50%);height:26px;border-radius:0 5px 5px 0;background:rgba(${fr},${fg},${fb},0.18);border:1.5px dashed rgba(${fr},${fg},${fb},0.50);border-left:none;box-sizing:border-box;"></div>` : ''}
            <div style="position:absolute;left:${bl}%;width:${bw}%;top:50%;transform:translateY(-50%);height:26px;background:${task.color};border-radius:5px;overflow:hidden;display:flex;align-items:center;${accentColor !== 'none' ? `border-left:4px solid ${accentColor};` : ''}">
              ${task.progress > 0 ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${task.progress}%;background:repeating-linear-gradient(135deg,transparent 0,transparent 4px,rgba(255,255,255,.2) 4px,rgba(255,255,255,.2) 8px);"></div>` : ""}
              ${showLabel ? `<span style="position:relative;z-index:1;font-size:9px;color:#fff;font-weight:600;padding:0 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${task.name}${task.progress > 0 ? ` · ${task.progress}%` : ""}</span>` : ""}
            </div>
          </div>
        </div>`;
    }).join("");

    return phRow + taskRows;
  }).join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Project Schedule — ${projectName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;padding:16px;background:#fff;color:#111;}
  @page{size:A3 landscape;margin:.8cm;}
  @media print{body{padding:0;}}
</style>
</head><body>

<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #0891b2;">
  <div style="display:flex;align-items:center;gap:14px;">
    ${brand.logo ? `<img src="${brand.logo}" style="max-height:48px;object-fit:contain;">` : ""}
    <div>
      <div style="font-size:20px;font-weight:700;color:#000000;">Project Schedule</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${projectName}</div>
      ${brand.companyName ? `<div style="font-size:11px;color:#94a3b8;">${brand.companyName}${brand.abn ? ` · ABN ${brand.abn}` : ""}</div>` : ""}
    </div>
  </div>
  <div style="font-size:10px;color:#94a3b8;text-align:right;">Generated: ${dateStr}<br>View: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}</div>
</div>

<div style="zoom:${zoom};">
  <div style="width:${totalContentW}px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">

    <!-- Header row -->
    <div style="display:flex;height:${HDR_H}px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <div style="width:${LEFT_W}px;flex-shrink:0;border-right:1px solid #e2e8f0;display:flex;align-items:center;padding:0 10px;">
        <span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;">Task</span>
      </div>
      <div style="width:${totalW}px;flex-shrink:0;display:flex;position:relative;">
        ${todayLine}
        ${dateHeaders}
      </div>
    </div>

    <!-- Task rows -->
    ${groupRows}

  </div>
</div>

<div style="margin-top:10px;display:flex;gap:16px;font-size:9px;color:#94a3b8;flex-wrap:wrap;">
  <span>● Red line = Today</span>
  <span>▨ Diagonal stripe = Progress (done)</span>
  ${groupedTasks.map((g) => `<span>${g.phase}: ${g.tasks.length} tasks</span>`).join("")}
</div>

</body></html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GanttSchedule({ projectId }: GanttScheduleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks]               = useState<ScheduleTask[]>([]);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editDraft, setEditDraft]       = useState<ScheduleTask | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sowSearch, setSowSearch]       = useState("");
  const [sowOpen, setSowOpen]           = useState(false);
  const sowContainerRef                 = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded]             = useState(false);
  const [projectName, setProjectName]   = useState("Project");
  const [viewMode, setViewMode]         = useState<ViewMode>("weekly");
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip]           = useState<{ task: ScheduleTask; x: number; y: number } | null>(null);
  const [workDays, setWorkDays]         = useState(() => localStorage.getItem("gantt_workDays") === "1");
  const [exclHolidays, setExclHolidays] = useState(() => localStorage.getItem("gantt_exclHolidays") === "1");
  const [holidayState, setHolidayState] = useState<StateCode>(() =>
    (localStorage.getItem("gantt_holidayState") as StateCode) || "QLD"
  );
  const [customHolidays, setCustomHolidays] = useState<{ date: string; name: string }[]>(() => {
    try {
      const standalone = localStorage.getItem(`gantt_customHols_${projectId}`);
      if (standalone) return JSON.parse(standalone);
      // Fall back to project record — populated from Supabase when user opens on a new browser
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]");
      const project = projects.find((p: any) => p.id === projectId);
      return project?.custom_holidays ?? [];
    } catch { return []; }
  });
  const [showCustomHolForm, setShowCustomHolForm] = useState(false);
  const [newHolDate, setNewHolDate] = useState("");
  const [newHolName, setNewHolName] = useState("");

  // ─── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    const projectsRaw = localStorage.getItem(getUserStorageKey("local_projects"));
    const projects: any[] = projectsRaw ? JSON.parse(projectsRaw) : [];
    const project = projects.find((p: any) => p.id === projectId);
    if (project?.name) setProjectName(project.name);

    // Cross-browser hydration: if standalone key is missing but project record has holidays
    // (project was fetched from Supabase by the dashboard before this component mounted)
    if (project?.custom_holidays?.length && !localStorage.getItem(`gantt_customHols_${projectId}`)) {
      setCustomHolidays(project.custom_holidays);
      localStorage.setItem(`gantt_customHols_${projectId}`, JSON.stringify(project.custom_holidays));
    }

    loadScheduleMerged(projectId).then((saved) => {
      if (saved && saved.length > 0) { setTasks(saved); setLoaded(true); return; }
      const generated = generateFromEstimate(project?.estimate_items || []);
      setTasks(generated);
      syncScheduleToSupabase(projectId, generated);
      setLoaded(true);
    });
  }, [projectId]);

  const saveTasks = useCallback(
    (updated: ScheduleTask[]) => {
      setTasks(updated);
      syncScheduleToSupabase(projectId, updated);
    },
    [projectId]
  );

  // ─── Active holiday set (state public holidays + custom closures) ─────────

  const activeHols = useMemo(() => {
    if (!exclHolidays) return new Set<string>();
    const s = new Set(STATE_HOLIDAYS[holidayState].map((h) => h.date));
    customHolidays.forEach((h) => s.add(h.date));
    return s;
  }, [exclHolidays, holidayState, customHolidays]);

  const activeHolNames = useMemo(() => {
    if (!exclHolidays) return new Map<string, string>();
    const m = new Map<string, string>();
    STATE_HOLIDAYS[holidayState].forEach((h) => m.set(h.date, h.name));
    customHolidays.forEach((h) => m.set(h.date, h.name || "Custom Closure"));
    return m;
  }, [exclHolidays, holidayState, customHolidays]);

  // Always-on display map — used for visual highlighting regardless of exclHolidays toggle
  const holDisplayMap = useMemo(() => {
    const m = new Map<string, { name: string; isCustom: boolean }>();
    STATE_HOLIDAYS[holidayState].forEach((h) => m.set(h.date, { name: h.name, isCustom: false }));
    customHolidays.forEach((h) => m.set(h.date, { name: h.name || "Custom Closure", isCustom: true }));
    return m;
  }, [holidayState, customHolidays]);

  const syncCustomHolidays = (updated: { date: string; name: string }[]) => {
    localStorage.setItem(`gantt_customHols_${projectId}`, JSON.stringify(updated));
    try {
      const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]");
      const idx = projects.findIndex((p: any) => p.id === projectId);
      if (idx !== -1) {
        projects[idx].custom_holidays = updated;
        localStorage.setItem(getUserStorageKey("local_projects"), JSON.stringify(projects));
        syncProjectToSupabase(projects[idx]);
      }
    } catch { /* non-fatal */ }
  };

  const handleAddCustomHol = () => {
    if (!newHolDate) return;
    const updated = [...customHolidays.filter((h) => h.date !== newHolDate), { date: newHolDate, name: newHolName }];
    setCustomHolidays(updated);
    syncCustomHolidays(updated);
    setNewHolDate("");
    setNewHolName("");
  };

  const handleRemoveCustomHol = (date: string) => {
    const updated = customHolidays.filter((h) => h.date !== date);
    setCustomHolidays(updated);
    syncCustomHolidays(updated);
  };

  // ─── Phase grouping ───────────────────────────────────────────────────────

  const groupedTasks = useMemo(() => {
    const groups: Record<string, ScheduleTask[]> = {};
    tasks.forEach((t) => {
      const p = getPhase(t);
      if (!groups[p]) groups[p] = [];
      groups[p].push(t);
    });
    return PHASE_ORDER.filter((p) => groups[p]).map((p) => ({ phase: p, tasks: groups[p] }));
  }, [tasks]);

  const NEAR_CRITICAL_DAYS = 7;

  const criticalPath = useMemo(() => {
    const floatMap = new Map<string, number>();
    if (tasks.length === 0) return floatMap;

    // Phase-sequential chaining: tasks within each phase sorted by startDate,
    // phases chained in display order. Backward pass determines lateFinish per task.
    const chain: ScheduleTask[] = [];
    for (const { tasks: phaseTasks } of groupedTasks) {
      chain.push(...[...phaseTasks].sort((a, b) => a.startDate < b.startDate ? -1 : 1));
    }
    if (chain.length === 0) return floatMap;

    const projectEndDate = parseISO(
      chain.reduce((m, t) => t.endDate > m ? t.endDate : m, chain[0].endDate)
    );

    // Backward pass: lateFinish[last] = projectEnd; lateFinish[i] = lateFinish[i+1] - duration(i+1)
    const lateFinish: Date[] = new Array(chain.length);
    lateFinish[chain.length - 1] = projectEndDate;
    for (let i = chain.length - 2; i >= 0; i--) {
      const next = chain[i + 1];
      const dur = Math.max(1, differenceInDays(parseISO(next.endDate), parseISO(next.startDate)));
      lateFinish[i] = addDays(lateFinish[i + 1], -dur);
    }

    chain.forEach((task, i) => {
      floatMap.set(task.id, Math.max(0, differenceInDays(lateFinish[i], parseISO(task.endDate))));
    });
    return floatMap;
  }, [tasks, groupedTasks]);

  const togglePhase = (phase: string) =>
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      next.has(phase) ? next.delete(phase) : next.add(phase);
      return next;
    });

  // ─── Gantt geometry (memoized on tasks + viewMode) ───────────────────────

  const { rangeStart, rangeEnd, totalDays, columns, COL_W } = useMemo(() => {
    const now = new Date();
    const allDates = tasks.flatMap((t) => [parseISO(t.startDate), parseISO(t.endDate)]);
    const minStart = allDates.length ? allDates.reduce((a, b) => (isBefore(a, b) ? a : b)) : now;
    const maxEnd   = allDates.length ? allDates.reduce((a, b) => (isAfter(a, b)  ? a : b)) : addDays(now, 112);
    const rangeStart = startOfWeek(minStart, { weekStartsOn: 1 });
    const minEnd     = addDays(rangeStart, 112);
    const rangeEnd   = isAfter(maxEnd, minEnd) ? addDays(maxEnd, 7) : minEnd;
    const totalDays  = differenceInDays(rangeEnd, rangeStart) || 1;

    const columns =
      viewMode === "daily"
        ? eachDayOfInterval({ start: rangeStart, end: rangeEnd })
        : viewMode === "monthly"
        ? eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
        : eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });

    return { rangeStart, rangeEnd, totalDays, columns, COL_W: COL_WIDTHS[viewMode] };
  }, [tasks, viewMode]);

  const today    = new Date();
  const pct      = (d: Date) => Math.max(0, Math.min(100, (differenceInDays(d, rangeStart) / totalDays) * 100));
  const todayPct = pct(today); // calendar-based — used by PDF & print exports

  // Working-day display overrides (daily view + workDays only)
  const wdCols = (viewMode === "daily" && workDays)
    ? eachDayOfInterval({ start: rangeStart, end: rangeEnd }).filter(d => isWorkday(d, activeHols))
    : null;
  const displayColumns  = wdCols ?? columns;
  const displayPct      = wdCols
    ? (d: Date) => {
        const n = wdCols.filter(wd => !isAfter(wd, d)).length;
        return Math.max(0, Math.min(100, (n / (wdCols.length || 1)) * 100));
      }
    : pct;
  const displayTodayPct = displayPct(today);

  // Weekday holidays filtered out in daily + Work Days + Holidays mode — collect for the info strip
  const skippedHolidays = useMemo(() => {
    if (viewMode !== "daily" || !workDays || !exclHolidays) return [] as Date[];
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).filter((d) => {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return false;
      const key = format(d, "yyyy-MM-dd");
      return holDisplayMap.has(key) && activeHols.has(key);
    });
  }, [viewMode, workDays, exclHolidays, rangeStart, rangeEnd, holDisplayMap, activeHols]);

  // ─── Task actions ─────────────────────────────────────────────────────────

  // Sync SOW search field whenever the open task or its SOW ref changes
  useEffect(() => {
    if (editDraft?.sowRef) {
      const rate = SCOPE_OF_WORK_RATES.find((r) => r.id === editDraft.sowRef);
      setSowSearch(rate?.sow ?? "");
    } else {
      setSowSearch("");
    }
    setSowOpen(false);
  }, [editDraft?.id, editDraft?.sowRef]);

  // Close SOW dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sowContainerRef.current && !sowContainerRef.current.contains(e.target as Node)) {
        setSowOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // SOW items grouped by trade, filtered by search query, matching trade sorted first
  const filteredSOW = useMemo(() => {
    const query = sowSearch.trim().toLowerCase();
    const items = query
      ? SCOPE_OF_WORK_RATES.filter(
          (r) =>
            r.sow.toLowerCase().includes(query) ||
            r.trade.toLowerCase().includes(query) ||
            (r.category ?? "").toLowerCase().includes(query)
        )
      : SCOPE_OF_WORK_RATES;

    const groupMap = new Map<string, typeof items>();
    items.forEach((r) => {
      if (!groupMap.has(r.trade)) groupMap.set(r.trade, []);
      groupMap.get(r.trade)!.push(r);
    });

    const entries = Array.from(groupMap.entries()).map(([trade, rateItems]) => ({ trade, items: rateItems }));
    const matchTrade = editDraft?.trade?.trim().toLowerCase();
    if (matchTrade) {
      entries.sort((a, b) => {
        const aM = a.trade.toLowerCase().includes(matchTrade) ? -1 : 0;
        const bM = b.trade.toLowerCase().includes(matchTrade) ? -1 : 0;
        return aM - bM;
      });
    }
    return entries;
  }, [sowSearch, editDraft?.trade]);

  const handleBarClick = (task: ScheduleTask) => {
    if (expandedId === task.id) { setExpandedId(null); setEditDraft(null); setConfirmDelete(null); }
    else { setExpandedId(task.id); setEditDraft({ ...task }); setConfirmDelete(null); }
  };

  const handleSave = () => {
    if (!editDraft) return;
    const s = parseISO(editDraft.startDate), e = parseISO(editDraft.endDate);
    if (isAfter(s, e)) { toast.error("Start must be before end"); return; }
    const durationDays = workDays
      ? countWorkingDays(s, e, activeHols)
      : differenceInDays(e, s) + 1;
    saveTasks(tasks.map((t) => (t.id === editDraft.id ? { ...editDraft, durationDays } : t)));
    setExpandedId(null); setEditDraft(null);
    toast.success("Task updated");
  };

  const handleDelete = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
    setExpandedId(null); setEditDraft(null);
    toast.success("Task removed");
  };

  const handleAddTask = () => {
    const last = tasks[tasks.length - 1];
    const startDate = last ? format(addDays(parseISO(last.endDate), 1), "yyyy-MM-dd") : format(today, "yyyy-MM-dd");
    const endDate   = format(addDays(parseISO(startDate), 4), "yyyy-MM-dd");
    const newTask: ScheduleTask = { id: crypto.randomUUID(), name: "New Task", trade: "", color: "#64748B", startDate, endDate, durationDays: 5, progress: 0, notes: "" };
    saveTasks([...tasks, newTask]);
    setExpandedId(newTask.id); setEditDraft({ ...newTask });
  };

  const handleReset = () => {
    const raw = localStorage.getItem(getUserStorageKey("local_projects"));
    const proj = (JSON.parse(raw || "[]") as any[]).find((p: any) => p.id === projectId);
    saveTasks(generateFromEstimate(proj?.estimate_items || [], workDays, activeHols));
    setExpandedId(null); setEditDraft(null);
    toast.success(`Schedule reset${workDays ? " (working days)" : ""}`);
  };

  // ─── Brand helper ─────────────────────────────────────────────────────────

  const getBrand = () => {
    try { return JSON.parse(localStorage.getItem(getUserStorageKey("quote_brand")) || "{}"); } catch { return {}; }
  };

  // ─── Print — isolated visual Gantt window ────────────────────────────────

  const handlePrint = () => {
    const brand = getBrand();
    const html = buildPrintHTML(groupedTasks, projectName, brand, viewMode, columns, COL_W, rangeStart, totalDays, workDays ? displayTodayPct : todayPct, criticalPath);
    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  // ─── PDF — visual Gantt via jsPDF ────────────────────────────────────────

  const handlePDFExport = () => {
    const brand = getBrand();
    const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    const PW    = doc.internal.pageSize.getWidth();   // 420mm
    const PH    = doc.internal.pageSize.getHeight();  // 297mm
    const ML    = 12, MR = 12, MT = 10, MB = 10;
    const contentW = PW - ML - MR; // 396mm
    const LEFT_W   = 55;           // left task column
    const RIGHT_W  = contentW - LEFT_W; // timeline

    // ── Logo + header ──────────────────────────────────────────────────────
    let logoH = 0;
    if (brand.logo) {
      try {
        const imgType = brand.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
        const logoW   = Math.min((brand.logoSize ?? 1) * 30, 40);
        logoH = logoW * 0.5;
        doc.addImage(brand.logo, imgType, ML, MT, logoW, logoH);
      } catch { /* skip */ }
    }
    const hY = MT + Math.max(logoH, 0);
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("Project Schedule", PW - MR, MT + 6, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(projectName, PW - MR, MT + 13, { align: "right" });
    doc.text(new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }), PW - MR, MT + 19, { align: "right" });
    if (brand.companyName) {
      doc.setFontSize(8);
      doc.text(brand.companyName + (brand.abn ? ` · ABN ${brand.abn}` : ""), PW - MR, MT + 25, { align: "right" });
    }

    // ── Timeline header ────────────────────────────────────────────────────
    // Always use monthly labels for PDF readability
    const pdfMonths  = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    const monthW     = RIGHT_W / pdfMonths.length;
    const timelineX  = ML + LEFT_W;
    const HEADER_Y   = Math.max(hY + 6, MT + 32);
    const HDR_H      = 8;
    const ROW_H      = 9;
    const PH_H       = 6;

    // Header background
    doc.setFillColor(248, 250, 252);
    doc.rect(ML, HEADER_Y, contentW, HDR_H, "F");
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.line(ML, HEADER_Y, ML + contentW, HEADER_Y);
    doc.line(ML, HEADER_Y + HDR_H, ML + contentW, HEADER_Y + HDR_H);

    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
    doc.text("TASK", ML + 2, HEADER_Y + HDR_H - 2);

    pdfMonths.forEach((month, i) => {
      const x = timelineX + i * monthW;
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      doc.line(x, HEADER_Y, x, HEADER_Y + HDR_H);
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
      doc.text(format(month, "MMM yy"), x + 1.5, HEADER_Y + HDR_H - 2);
    });

    // ── Today line (vertical across full height) ───────────────────────────
    const pdfTodayPct = workDays ? displayTodayPct : todayPct;
    if (pdfTodayPct >= 0 && pdfTodayPct <= 100) {
      const todayX = timelineX + (pdfTodayPct / 100) * RIGHT_W;
      doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.5);
      doc.line(todayX, HEADER_Y, todayX, PH - MB);
      doc.setFontSize(5.5); doc.setTextColor(239, 68, 68);
      doc.text("TODAY", todayX + 0.5, HEADER_Y - 0.5);
    }

    // ── Legend (page 1 only) ───────────────────────────────────────────────
    const criticalCount2  = Array.from(criticalPath.values()).filter(f => f === 0).length;
    const nearCritCount2  = Array.from(criticalPath.values()).filter(f => f > 0 && f <= 7).length;
    const hasFloat2       = Array.from(criticalPath.values()).some(f => f > 0 && f < 999);
    let legendX = ML;
    const legendY = HEADER_Y - 5;
    if (criticalCount2 > 0) {
      doc.setFillColor(239, 68, 68);
      doc.rect(legendX, legendY + 0.5, 4, 3, "F");
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text("Critical", legendX + 5, legendY + 3);
      legendX += 22;
    }
    if (nearCritCount2 > 0) {
      doc.setFillColor(245, 158, 11);
      doc.rect(legendX, legendY + 0.5, 4, 3, "F");
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text("Near-critical", legendX + 5, legendY + 3);
      legendX += 28;
    }
    if (hasFloat2) {
      doc.setFillColor(203, 213, 225);
      doc.rect(legendX, legendY + 0.5, 5, 3, "F");
      doc.setFillColor(248, 250, 252);
      doc.rect(legendX + 3, legendY + 0.5, 4, 3, "F");
      doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.3);
      doc.setLineDashPattern([0.8, 0.8], 0);
      doc.rect(legendX + 3, legendY + 0.5, 4, 3, "S");
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text("Float", legendX + 8, legendY + 3);
    }

    // ── Task rows ──────────────────────────────────────────────────────────
    let curY = HEADER_Y + HDR_H;
    let page = 1;

    const checkPage = () => {
      if (curY + ROW_H > PH - MB) {
        doc.addPage();
        page++;
        curY = MT;
        // Redraw timeline header on new page
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, curY, contentW, HDR_H, "F");
        pdfMonths.forEach((month, i) => {
          const x = timelineX + i * monthW;
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
          doc.line(x, curY, x, curY + HDR_H);
          doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
          doc.text(format(month, "MMM yy"), x + 1.5, curY + HDR_H - 2);
        });
        if (pdfTodayPct >= 0 && pdfTodayPct <= 100) {
          const todayX = timelineX + (pdfTodayPct / 100) * RIGHT_W;
          doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.5);
          doc.line(todayX, curY, todayX, PH - MB);
        }
        curY += HDR_H;
      }
    };

    groupedTasks.forEach(({ phase, tasks: pt }) => {
      checkPage();
      // Phase header row
      doc.setFillColor(30, 41, 59);
      doc.rect(ML, curY, contentW, PH_H, "F");
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(148, 163, 184);
      doc.text(phase.toUpperCase(), ML + 2, curY + PH_H - 1.5);
      curY += PH_H;

      pt.forEach((task) => {
        checkPage();
        const rowY = curY;

        // Row background (alternate)
        const rowIdx = tasks.indexOf(task);
        if (rowIdx % 2 === 0) { doc.setFillColor(252, 252, 253); doc.rect(ML, rowY, contentW, ROW_H, "F"); }

        // Row border
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2);
        doc.line(ML, rowY + ROW_H, ML + contentW, rowY + ROW_H);

        // Left: color swatch + task name + dates
        const [r, g, b] = hexToRgb(task.color);
        doc.setFillColor(r, g, b);
        doc.rect(ML, rowY + 1, 1.5, ROW_H - 2, "F");
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        doc.text(task.name, ML + 3.5, rowY + 4.5, { maxWidth: LEFT_W - 5 });
        doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(
          `${format(parseISO(task.startDate), "dd MMM")} – ${format(parseISO(task.endDate), "dd MMM")} · ${task.durationDays}d${task.progress > 0 ? ` · ${task.progress}%` : ""}`,
          ML + 3.5, rowY + 7.5
        );

        // Divider between left col and timeline
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        doc.line(timelineX, rowY, timelineX, rowY + ROW_H);

        // Month grid lines
        pdfMonths.forEach((_, i) => {
          const x = timelineX + i * monthW;
          doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.1);
          doc.line(x, rowY, x, rowY + ROW_H);
        });

        // Task bar
        const barLeft  = (pct(parseISO(task.startDate)) / 100) * RIGHT_W;
        const barRight = (pct(addDays(parseISO(task.endDate), 1)) / 100) * RIGHT_W;
        const barW     = Math.max(1, barRight - barLeft);
        const barX     = timelineX + barLeft;
        const barY     = rowY + (ROW_H - 5) / 2;

        // Critical path classification
        const pdfFloat      = criticalPath.get(task.id) ?? 999;
        const pdfIsCrit     = pdfFloat === 0;
        const pdfIsNearCrit = !pdfIsCrit && pdfFloat <= 7;

        // Float ghost bar (draw before task bar so bar renders on top)
        if (pdfFloat > 0 && pdfFloat < 999) {
          const floatBarLeft = (pct(addDays(parseISO(task.endDate), 1)) / 100) * RIGHT_W;
          const floatBarRight = Math.min(RIGHT_W, (pct(addDays(parseISO(task.endDate), pdfFloat + 1)) / 100) * RIGHT_W);
          const floatW2 = Math.max(0, floatBarRight - floatBarLeft);
          if (floatW2 > 0.5) {
            doc.setFillColor(r, g, b);
            doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
            doc.roundedRect(timelineX + floatBarLeft, barY, floatW2, 5, 0, 0.8, "F");
            doc.setGState(new (doc as any).GState({ opacity: 1 }));
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(0.3);
            doc.setLineDashPattern([0.8, 0.8], 0);
            doc.roundedRect(timelineX + floatBarLeft, barY, floatW2, 5, 0, 0.8, "S");
            doc.setLineDashPattern([], 0);
          }
        }

        doc.setFillColor(r, g, b);
        doc.roundedRect(barX, barY, barW, 5, 0.8, 0.8, "F");

        // Critical left-edge accent (1.2mm wide rect on left side of bar)
        if (pdfIsCrit) {
          doc.setFillColor(239, 68, 68);
          doc.rect(barX, barY, 1.2, 5, "F");
        } else if (pdfIsNearCrit) {
          doc.setFillColor(245, 158, 11);
          doc.rect(barX, barY, 1.2, 5, "F");
        }

        // Progress indicator: white bottom stripe
        if (task.progress > 0) {
          doc.setFillColor(255, 255, 255);
          doc.rect(barX, barY + 3.8, (barW * task.progress) / 100, 1, "F");
        }

        // Bar label
        if (barW > 12) {
          doc.setFontSize(5.5); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
          const label = barW > 25 ? `${task.name}${task.progress > 0 ? ` ${task.progress}%` : ""}` : task.name;
          doc.text(label, barX + (pdfIsCrit || pdfIsNearCrit ? 1.5 : 1), barY + 3.3, { maxWidth: barW - 2 });
        }

        curY += ROW_H;
      });
    });

    // Footer
    doc.setFontSize(6); doc.setTextColor(148, 163, 184);
    for (let p = 1; p <= doc.internal.pages.length - 1; p++) {
      doc.setPage(p);
      doc.text(`${projectName} — Project Schedule · Page ${p} of ${doc.internal.pages.length - 1}`, PW / 2, PH - 4, { align: "center" });
    }

    doc.save(`Schedule_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  // ─── Excel — ExcelJS with logo + coloured rows ────────────────────────────

  const handleExcelExport = async () => {
    const brand = getBrand();
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator  = brand.companyName || "Metricore";
      wb.created  = new Date();
      const ws = wb.addWorksheet("Schedule", { pageSetup: { paperSize: 9, orientation: "landscape" } });

      // Column definitions
      ws.columns = [
        { key: "num",      width: 5  },
        { key: "name",     width: 30 },
        { key: "trade",    width: 18 },
        { key: "start",    width: 14 },
        { key: "end",      width: 14 },
        { key: "duration", width: 16 },
        { key: "progress", width: 13 },
        { key: "notes",    width: 36 },
        { key: "status",   width: 16 },
      ];

      // Logo image
      let logoRow = 1;
      if (brand.logo) {
        try {
          const base64 = brand.logo.split(",")[1];
          const ext    = brand.logo.startsWith("data:image/png") ? "png" : "jpeg";
          const imgId  = wb.addImage({ base64, extension: ext as any });
          ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 3 }, editAs: "oneCell" });
          logoRow = 4;
        } catch { logoRow = 1; }
      }

      // Company header rows
      const addHeaderRow = (label: string, value: string, row: number) => {
        ws.getRow(row).height = 18;
        ws.getCell(`C${row}`).value = label;
        ws.getCell(`C${row}`).font  = { bold: true, size: 10, color: { argb: "FF64748B" } };
        ws.mergeCells(`D${row}:I${row}`);
        ws.getCell(`D${row}`).value = value;
        ws.getCell(`D${row}`).font  = { size: 11, bold: row === logoRow };
      };

      addHeaderRow("Company:", brand.companyName || "—", logoRow);
      addHeaderRow("Project:", projectName, logoRow + 1);
      addHeaderRow("Generated:", new Date().toLocaleDateString("en-AU"), logoRow + 2);

      const dataStartRow = logoRow + 4;

      // Column header row
      const hdr = ws.getRow(dataStartRow);
      hdr.height = 18;
      ["#", "Task", "Trade / Assignee", "Start Date", "End Date", "Duration (days)", "Progress (%)", "Notes", "Status"].forEach((h, i) => {
        const cell = hdr.getCell(i + 1);
        cell.value = h;
        cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: i === 0 ? "center" : "left" };
      });

      // Data rows
      let dataRow = dataStartRow + 1;

      groupedTasks.forEach(({ phase, tasks: pt }) => {
        // Phase header row
        const phRow = ws.getRow(dataRow);
        phRow.height = 16;
        ws.mergeCells(`A${dataRow}:I${dataRow}`);
        const phCell = phRow.getCell(1);
        phCell.value = phase.toUpperCase();
        phCell.font  = { bold: true, size: 9, color: { argb: "FF94A3B8" } };
        phCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        phCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        dataRow++;

        pt.forEach((task, i) => {
          const row = ws.getRow(dataRow);
          row.height = 17;
          const hex = task.color.replace("#", "");
          // Compute a light version of the color for background (mix with white)
          const [r, g, b] = hexToRgb(task.color);
          const lightHex  = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.82).toString(16).padStart(2, "0")).join("").toUpperCase();
          const bgArgb     = "FF" + lightHex;
          const textArgb   = "FF" + hex;

          const xlFloat = criticalPath.get(task.id) ?? 999;
          const xlIsCrit = xlFloat === 0;
          const xlIsNear = !xlIsCrit && xlFloat <= 7;
          const xlStatus = xlIsCrit ? "Critical"
            : xlIsNear ? "Near-critical"
            : xlFloat < 999 ? `Float ${xlFloat}d`
            : "On track";

          const vals: (string | number)[] = [
            i + 1,
            task.name,
            task.trade || "",
            task.startDate,
            task.endDate,
            task.durationDays,
            task.progress,
            task.notes || "",
            xlStatus,
          ];

          vals.forEach((v, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = v;
            const isStatusCol = ci === 8;
            const statusFg = xlIsCrit ? "FFFEE2E2"
              : xlIsNear ? "FFFEF3C7"
              : xlFloat < 999 ? "FFEFF6FF"
              : bgArgb;
            cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: isStatusCol ? statusFg : bgArgb } };
            const statusTextArgb = xlIsCrit ? "FFDC2626"
              : xlIsNear ? "FFD97706"
              : xlFloat < 999 ? "FF1D4ED8"
              : textArgb;
            cell.font  = { color: { argb: isStatusCol ? statusTextArgb : textArgb }, size: 10, bold: ci === 1 || (isStatusCol && xlIsCrit) };
            cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "center" : "left" };
            cell.border = {
              bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            };
          });

          dataRow++;
        });
      });

      // Freeze panes — Sheet 1
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: dataStartRow, activeCell: `A${dataStartRow + 1}` }];

      // ── Sheet 2: Visual Gantt ─────────────────────────────────────────────
      const ws2 = wb.addWorksheet("Gantt View", {
        pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      const ganttWeeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
      const DATA_COL   = 2; // column A = task names, column B+ = weeks
      const totalCols  = ganttWeeks.length + 1;

      // Column widths
      ws2.getColumn(1).width = 28;
      ganttWeeks.forEach((_, i) => { ws2.getColumn(i + DATA_COL).width = 3.4; });

      // Row 1: Title
      ws2.mergeCells(1, 1, 1, totalCols);
      const ttl = ws2.getCell(1, 1);
      ttl.value = `${projectName} — Project Schedule (Visual Gantt)`;
      ttl.font  = { bold: true, size: 13, color: { argb: "FF0F172A" } };
      ttl.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      ttl.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws2.getRow(1).height = 24;

      // Row 2: Month headers
      ws2.getRow(2).height = 15;
      // Task label for col A
      const taskHdrG = ws2.getCell(2, 1);
      taskHdrG.value = "TASK";
      taskHdrG.font  = { bold: true, size: 9, color: { argb: "FF64748B" } };
      taskHdrG.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      taskHdrG.alignment = { vertical: "middle", indent: 1 };

      // Group weeks by month for merging
      const monthGroups: { label: string; s: number; e: number }[] = [];
      let curML = ""; let curMS = DATA_COL;
      ganttWeeks.forEach((wk, i) => {
        const ml = format(wk, "MMM yyyy");
        if (ml !== curML) {
          if (curML) monthGroups.push({ label: curML, s: curMS, e: i + DATA_COL - 1 });
          curML = ml; curMS = i + DATA_COL;
        }
      });
      monthGroups.push({ label: curML, s: curMS, e: ganttWeeks.length + DATA_COL - 1 });

      monthGroups.forEach(({ label, s, e }) => {
        if (s < e) ws2.mergeCells(2, s, 2, e);
        const mc = ws2.getCell(2, s);
        mc.value = label;
        mc.font  = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        mc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        mc.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Row 3: Week date labels
      ws2.getRow(3).height = 12;
      ws2.getCell(3, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

      // Find today's week column index
      const todayWeekIdx = ganttWeeks.findIndex((w, i) => {
        const wEnd = addDays(w, 6);
        return !isAfter(today, wEnd) && !isBefore(today, w);
      });

      ganttWeeks.forEach((wk, i) => {
        const cell = ws2.getCell(3, i + DATA_COL);
        const isTodayWk = i === todayWeekIdx;
        cell.value = format(wk, "d");
        cell.font  = isTodayWk
          ? { size: 7, bold: true, color: { argb: "FFEF4444" } }
          : { size: 7, color: { argb: "FF94A3B8" } };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cell.alignment = { horizontal: "center" };
      });

      // Task & phase rows
      let g2Row = 4;

      groupedTasks.forEach(({ phase, tasks: pt2 }) => {
        // Phase header row
        ws2.mergeCells(g2Row, 1, g2Row, totalCols);
        const phC = ws2.getCell(g2Row, 1);
        phC.value = phase.toUpperCase();
        phC.font  = { bold: true, size: 8, color: { argb: "FF94A3B8" } };
        phC.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        phC.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws2.getRow(g2Row).height = 13;
        g2Row++;

        pt2.forEach((task) => {
          ws2.getRow(g2Row).height = 14;
          const hexStr = task.color.replace("#", "").toUpperCase();

          const xlFloat2   = criticalPath.get(task.id) ?? 999;
          const xlIsCrit2  = xlFloat2 === 0;
          const xlIsNear2  = !xlIsCrit2 && xlFloat2 <= 7;
          const accentArgb = xlIsCrit2 ? "FFEF4444" : xlIsNear2 ? "FFF59E0B" : undefined;

          // Task name
          const nc = ws2.getCell(g2Row, 1);
          nc.value = task.name;
          nc.font  = { size: 9, bold: true, color: { argb: "FF" + hexStr } };
          nc.alignment = { vertical: "middle", horizontal: "left", indent: accentArgb ? 2 : 1 };
          nc.border = {
            right:  { style: "medium", color: { argb: "FFE2E8F0" } },
            bottom: { style: "hair",   color: { argb: "FFEEEEEE" } },
            ...(accentArgb ? { left: { style: "medium", color: { argb: accentArgb } } } : {}),
          };

          const tStart = parseISO(task.startDate);
          const tEnd   = parseISO(task.endDate);
          const tFloatEnd = xlFloat2 > 0 && xlFloat2 < 999 ? addDays(parseISO(task.endDate), xlFloat2) : null;

          ganttWeeks.forEach((wk, i) => {
            const wkEnd    = addDays(wk, 6);
            const overlaps = !isAfter(tStart, wkEnd) && !isBefore(tEnd, wk);
            const isFloat  = tFloatEnd && !overlaps && !isAfter(wk, tFloatEnd) && isAfter(wk, tEnd);
            const isTodayWk = i === todayWeekIdx;
            const cell = ws2.getCell(g2Row, i + DATA_COL);

            const [fr2, fg2, fb2] = hexToRgb(task.color);
            const floatLightHex = [fr2, fg2, fb2].map((c) => Math.round(c + (255 - c) * 0.82).toString(16).padStart(2, "0")).join("").toUpperCase();

            cell.fill = overlaps
              ? { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hexStr } }
              : isFloat
              ? { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + floatLightHex } }
              : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFBFC" } };

            cell.border = {
              right:  { style: "hair",   color: { argb: "FFE2E8F0" } },
              bottom: { style: "hair",   color: { argb: "FFEEEEEE" } },
              ...(isTodayWk ? { left: { style: "medium", color: { argb: "FFEF4444" } } } : {}),
              ...(isFloat && !overlaps ? { top: { style: "dotted", color: { argb: "FFCBD5E1" } } } : {}),
            };
          });

          g2Row++;
        });
      });

      // Freeze: task name column + first 3 header rows
      ws2.views = [{ state: "frozen", xSplit: 1, ySplit: 3, activeCell: "B4" }];

      // Download
      const buffer = await wb.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = url;
      a.download   = `Schedule_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exported");
    } catch (err) {
      console.error(err);
      toast.error("Excel export failed");
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (!loaded) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading schedule…</div>;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const ROW_H = 56;
  const PH_H  = 32;

  const criticalCount     = tasks.filter(t => criticalPath.get(t.id) === 0).length;
  const nearCriticalCount = tasks.filter(t => { const f = criticalPath.get(t.id) ?? 999; return f > 0 && f <= NEAR_CRITICAL_DAYS; }).length;

  return (
    <>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 shadow-2xl text-xs text-white pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: tooltip.task.color }} />
            <span className="font-semibold text-sm">{tooltip.task.name}</span>
          </div>
          {tooltip.task.trade && tooltip.task.trade !== tooltip.task.name && (
            <div className="text-muted-foreground mb-1">{tooltip.task.trade}</div>
          )}
          <div className="text-foreground/60">
            {format(parseISO(tooltip.task.startDate), "dd MMM yyyy")} → {format(parseISO(tooltip.task.endDate), "dd MMM yyyy")}
          </div>
          <div className="text-muted-foreground">
            {tooltip.task.durationDays}d cal
            {workDays && ` · ${countWorkingDays(parseISO(tooltip.task.startDate), parseISO(tooltip.task.endDate), activeHols)}wd`}
            {" · "}<span className="text-[#E1DCC9] font-medium">{tooltip.task.progress}% complete</span>
          </div>
          {(() => {
            const f = criticalPath.get(tooltip.task.id);
            if (f === undefined) return null;
            return (
              <div className={`mt-1 text-[10px] font-semibold ${f === 0 ? 'text-red-400' : f <= NEAR_CRITICAL_DAYS ? 'text-amber-400' : 'text-slate-500'}`}>
                {f === 0 ? 'Critical — no float' : `Float: ${f}d${f <= NEAR_CRITICAL_DAYS ? ' · near-critical' : ''}`}
              </div>
            );
          })()}
          {tooltip.task.notes && (
            <div className="text-slate-500 mt-1 border-t border-border/50 pt-1">{tooltip.task.notes}</div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gantt-no-print">
          <div>
            <h2 className="text-lg font-semibold text-white">{projectName} · Schedule</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tasks.length} tasks
              {criticalCount > 0 && <> · <span className="text-red-400/80">{criticalCount} critical</span></>}
              {nearCriticalCount > 0 && <> · <span className="text-amber-400/70">{nearCriticalCount} near-critical</span></>}
              {' · click bar to edit'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* View mode selector */}
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="h-8 w-32 text-xs bg-card/90 border-border/50 text-foreground/60 gap-1">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-5 bg-muted/60 mx-0.5" />

            {/* Working-day toggles */}
            <Button
              size="sm"
              onClick={() => {
                const next = !workDays;
                setWorkDays(next);
                localStorage.setItem("gantt_workDays", next ? "1" : "0");
                if (!next) { setExclHolidays(false); localStorage.setItem("gantt_exclHolidays", "0"); }
              }}
              className={`h-8 gap-1 text-xs ${workDays ? "bg-[#412D15] hover:bg-[#412D15]/90 border-[#412D15] text-white" : "bg-transparent border border-border/50 text-foreground/60 hover:bg-muted/60 hover:text-foreground"}`}
              title="Exclude weekends. Hit Reset to regenerate with working-day dates."
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Work Days
            </Button>
            {workDays && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    const next = !exclHolidays;
                    setExclHolidays(next);
                    localStorage.setItem("gantt_exclHolidays", next ? "1" : "0");
                    if (!next) setShowCustomHolForm(false);
                  }}
                  className={`h-8 gap-1 text-xs ${exclHolidays ? "bg-[#412D15] hover:bg-[#412D15]/90 border-[#412D15] text-white" : "bg-transparent border border-border/50 text-foreground/60 hover:bg-muted/60 hover:text-foreground"}`}
                  title="Skip public holidays when counting working days"
                >
                  Holidays
                </Button>
                {exclHolidays && (
                  <>
                    <Select value={holidayState} onValueChange={(v) => {
                      setHolidayState(v as StateCode);
                      localStorage.setItem("gantt_holidayState", v);
                    }}>
                      <SelectTrigger className="h-8 w-[72px] text-xs bg-card/90 border-border/50 text-foreground/60 gap-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[10001]">
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => setShowCustomHolForm((v) => !v)}
                      className={`h-8 gap-1 text-xs ${showCustomHolForm ? "bg-violet-900/70 border-violet-700 text-violet-200" : "bg-transparent border border-border/50 text-foreground/60 hover:bg-muted/60 hover:text-foreground"}`}
                      title="Add custom site closure dates"
                    >
                      + Custom{customHolidays.length > 0 ? ` (${customHolidays.length})` : ""}
                    </Button>
                  </>
                )}
              </>
            )}

            <div className="w-px h-5 bg-muted/60 mx-0.5" />

            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-foreground/60 border-border/50 hover:bg-muted/60 hover:text-foreground">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>

            <div className="w-px h-5 bg-muted/60 mx-0.5" />

            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1 text-foreground/60 border-border/50 hover:bg-muted/60 hover:text-foreground">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={handlePDFExport} className="gap-1 text-foreground/60 border-border/50 hover:bg-muted/60 hover:text-foreground">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleExcelExport} className="gap-1 text-foreground/60 border-border/50 hover:bg-muted/60 hover:text-foreground">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>

            <div className="w-px h-5 bg-muted/60 mx-0.5" />

            <Button size="sm" onClick={handleAddTask} className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </Button>
          </div>
        </div>

        {/* ── Custom holiday panel ─────────────────────────────────────────── */}
        {exclHolidays && showCustomHolForm && (
          <div className="flex flex-col gap-2 px-3 py-2.5 bg-card/90/60 rounded-lg border border-violet-800/40 gantt-no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Custom Closures</span>
              <Input
                type="date"
                value={newHolDate}
                onChange={(e) => setNewHolDate(e.target.value)}
                className="h-7 w-36 text-xs bg-card/90 border-border/50"
              />
              <Input
                placeholder="Label (e.g. Site shutdown)"
                value={newHolName}
                onChange={(e) => setNewHolName(e.target.value)}
                className="h-7 w-44 text-xs bg-card/90 border-border/50"
              />
              <Button size="sm" onClick={handleAddCustomHol} className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                Add
              </Button>
            </div>
            {customHolidays.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...customHolidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
                  <span key={h.date} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-violet-900/60 text-violet-300 border border-violet-700/50">
                    {format(parseISO(h.date), "dd MMM yyyy")}{h.name ? ` · ${h.name}` : ""}
                    <button onClick={() => handleRemoveCustomHol(h.date)} className="text-violet-400 hover:text-violet-200 ml-0.5 leading-none">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Skipped holidays strip (daily + Work Days + Holidays mode) ──── */}
        {skippedHolidays.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 bg-amber-950/30 border border-amber-800/30 rounded-lg text-[10px] gantt-no-print">
            <span className="text-amber-500/60 font-semibold uppercase tracking-wider flex-shrink-0">Skipped:</span>
            {skippedHolidays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const hol = holDisplayMap.get(key);
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className="text-amber-400/80 font-medium">{format(d, "dd MMM")}</span>
                  <span className="text-amber-800">·</span>
                  <span style={{ color: hol?.isCustom ? "#c4b5fd" : "#fbbf24" }}>{hol?.name}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* ── Gantt container ──────────────────────────────────────────────── */}
        <div className="border border-border/50 rounded-xl overflow-hidden bg-slate-900 shadow-xl">
          <div className="flex">

            {/* Left fixed column */}
            <div className="flex-shrink-0 w-56 border-r border-border/50 bg-card/90/60">
              <div className="border-b border-border/50 flex items-center px-4 bg-card/90" style={{ height: viewMode === "daily" ? 64 : 48 }}>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Task</span>
              </div>

              {groupedTasks.map(({ phase, tasks: phaseTasks }) => (
                <React.Fragment key={phase}>
                  <button
                    onClick={() => togglePhase(phase)}
                    className="w-full flex items-center gap-2 px-3 border-b border-slate-600 bg-muted/60/40 hover:bg-muted/60/70 transition-colors"
                    style={{ height: PH_H }}
                  >
                    {collapsedPhases.has(phase)
                      ? <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronDown  className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    }
                    <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest flex-1 text-left">{phase}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-600/50 rounded px-1.5 py-0.5">{phaseTasks.length}</span>
                  </button>

                  {!collapsedPhases.has(phase) && phaseTasks.map((task) => {
                    const isNoEstimate = task.notes?.startsWith("No estimate items matched");
                    const taskSowRate = task.sowRef ? SCOPE_OF_WORK_RATES.find((r) => r.id === task.sowRef) : null;
                    const lpFloat = criticalPath.get(task.id) ?? 999;
                    const lpCritical = lpFloat === 0;
                    const lpNearCritical = !lpCritical && lpFloat <= NEAR_CRITICAL_DAYS;
                    return (
                      <div key={task.id}>
                        <div
                          className={`border-b border-border/50 px-3 flex items-center gap-2.5 transition-colors cursor-pointer group ${expandedId === task.id ? "bg-white/[0.04]" : "hover:bg-muted/60/30"}`}
                          style={{ height: ROW_H, borderLeft: `2px solid ${expandedId === task.id ? task.color : "transparent"}` }}
                          onClick={() => handleBarClick(task)}
                        >
                          <div className="w-2 h-7 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate leading-tight">{task.name}</span>
                              {lpCritical    && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Critical — no float" />}
                              {lpNearCritical && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title={`${lpFloat}d float`} />}
                              {isNoEstimate && (
                                <span className="text-[8px] text-amber-400/70 border border-amber-400/30 rounded px-1 leading-tight flex-shrink-0">~est</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {format(parseISO(task.startDate), "dd MMM")} – {format(parseISO(task.endDate), "dd MMM")} · {workDays ? `${countWorkingDays(parseISO(task.startDate), parseISO(task.endDate), activeHols)}wd` : `${task.durationDays}d`}
                            </span>
                            {task.progress > 0 && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <div className="flex-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: task.color }} />
                                </div>
                                <span className="text-[9px] text-slate-500 flex-shrink-0">{task.progress}%</span>
                              </div>
                            )}
                            {taskSowRate && (
                              <span className="text-[9px] text-slate-500/70 truncate leading-tight mt-0.5 italic">
                                {taskSowRate.sow}
                              </span>
                            )}
                          </div>
                          <svg className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Right scrollable timeline */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ minWidth: `${displayColumns.length * COL_W}px` }} className="relative">

                {/* Week/day/month headers */}
                <div className="flex border-b border-border/50 bg-card/90 relative" style={{ height: viewMode === "daily" ? 64 : 48 }}>
                  {displayTodayPct >= 0 && displayTodayPct <= 100 && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-20 pointer-events-none" style={{ left: `${displayTodayPct}%` }}>
                      <span className="absolute top-1 left-1 text-[8px] text-red-400 font-bold tracking-widest whitespace-nowrap">TODAY</span>
                    </div>
                  )}
                  {displayColumns.map((col, i) => {
                    const prev = i > 0 ? displayColumns[i - 1] : null;
                    let label: React.ReactNode = null;
                    let subLabel: React.ReactNode = null;
                    let isWknd = false;

                    const colKey = format(col, "yyyy-MM-dd");
                    // Use holDisplayMap (always populated) for visual highlighting
                    const dispHol = holDisplayMap.get(colKey);
                    const isCustomHol = dispHol?.isCustom === true;
                    const isPublicHol = dispHol !== undefined && !isCustomHol;
                    // For weekly view: collect all holidays in Mon-Sun
                    const weekHols = viewMode === "weekly"
                      ? [0,1,2,3,4,5,6].flatMap((d) => {
                          const dk = format(addDays(col, d), "yyyy-MM-dd");
                          const dh = holDisplayMap.get(dk);
                          return dh ? [dh] : [];
                        })
                      : [];
                    const hasWeekHol = weekHols.length > 0;
                    const weekHolIsCustom = hasWeekHol && weekHols.every((h) => h.isCustom);

                    if (viewMode === "monthly") {
                      label    = format(col, "MMM");
                      subLabel = format(col, "yyyy");
                    } else if (viewMode === "weekly") {
                      const newMonth = !prev || format(col, "MMM") !== format(prev, "MMM");
                      label    = newMonth ? <strong className="text-slate-200">{format(col, "MMM")}</strong> : format(col, "dd");
                      subLabel = hasWeekHol
                        ? <span style={{ fontSize: 8, fontWeight: 600, color: weekHolIsCustom ? "#a78bfa" : "#fbbf24" }}
                            title={weekHols.map((h) => h.name).join(", ")}>
                            {weekHols.length === 1 ? weekHols[0].name : `${weekHols.length} holidays`}
                          </span>
                        : (newMonth ? format(col, "yyyy") : null);
                    } else {
                      isWknd   = col.getDay() === 0 || col.getDay() === 6;
                      const newMonth = !prev || format(col, "MMM") !== format(prev, "MMM");
                      label    = (isPublicHol || isCustomHol)
                        ? <span style={{ fontWeight: 700, fontSize: 9, color: isCustomHol ? "#c4b5fd" : "#fcd34d" }}
                            title={dispHol?.name ?? (isCustomHol ? "Custom Closure" : "Public Holiday")}>
                            {format(col, "d")}
                          </span>
                        : newMonth ? <strong className="text-foreground/60 text-[9px]">{format(col, "d MMM")}</strong> : format(col, "d");
                    }

                    // Compute background color via inline style (immune to Tailwind purge)
                    let colBg = "transparent";
                    if (viewMode === "daily") {
                      if (isCustomHol) colBg = "rgba(139,92,246,0.38)";
                      else if (isPublicHol) colBg = "rgba(245,158,11,0.30)";
                      else if (isWknd) colBg = "rgba(255,255,255,0.03)";
                    } else if (viewMode === "weekly" && hasWeekHol) {
                      colBg = weekHolIsCustom ? "rgba(139,92,246,0.10)" : "rgba(245,158,11,0.10)";
                    } else if (isWknd) {
                      colBg = "rgba(255,255,255,0.03)";
                    }

                    return (
                      <div
                        key={i}
                        className="flex-shrink-0 border-r border-border/50 flex flex-col items-center justify-center gap-0.5 relative"
                        style={{ width: COL_W, backgroundColor: colBg }}
                      >
                        {viewMode === "weekly" && (
                          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${(5 / 7) * 100}%`, width: `${(2 / 7) * 100}%`, backgroundColor: "rgba(255,255,255,0.02)" }} />
                        )}
                        {(isPublicHol || isCustomHol) && (
                          <div className="absolute bottom-0 left-0 right-0" style={{ height: viewMode === "daily" ? 4 : 2, backgroundColor: isCustomHol ? "rgba(167,139,250,0.8)" : "rgba(251,191,36,0.8)" }} />
                        )}
                        {viewMode === "weekly" && hasWeekHol && (
                          <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, backgroundColor: weekHolIsCustom ? "rgba(167,139,250,0.8)" : "rgba(251,191,36,0.8)" }} />
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium relative z-10 leading-tight">{label}</span>
                        {subLabel && <span className="text-[8px] text-slate-600 relative z-10 leading-tight">{subLabel}</span>}
                        {viewMode === "daily" && (isPublicHol || isCustomHol) && dispHol?.name && (
                          <span
                            className="absolute z-10 pointer-events-none select-none"
                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: 7,
                              fontWeight: 700,
                              color: isCustomHol ? "#c4b5fd" : "#fbbf24",
                              lineHeight: 1.1,
                              bottom: 6,
                              maxHeight: 48,
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dispHol.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Task rows */}
                {groupedTasks.map(({ phase, tasks: phaseTasks }) => (
                  <React.Fragment key={phase}>
                    <div className="border-b border-slate-600 bg-muted/60/20 relative" style={{ height: PH_H, minWidth: `${displayColumns.length * COL_W}px` }}>
                      {collapsedPhases.has(phase) && phaseTasks.length > 0 && (() => {
                        const earliest = phaseTasks.reduce((m, t) => t.startDate < m ? t.startDate : m, phaseTasks[0].startDate);
                        const latestEndDate = phaseTasks.reduce((m, t) => t.endDate > m ? t.endDate : m, phaseTasks[0].endDate);
                        const avgProgress = Math.round(phaseTasks.reduce((s, t) => s + t.progress, 0) / phaseTasks.length);
                        const bLeft  = displayPct(parseISO(earliest));
                        const bRight = displayPct(addDays(parseISO(latestEndDate), 1));
                        const bWidth = Math.max(0.4, bRight - bLeft);
                        const phaseColor = phaseTasks[0].color;
                        return (
                          <div
                            className="absolute rounded overflow-hidden"
                            style={{ left: `${bLeft}%`, width: `${bWidth}%`, top: 4, height: 18, backgroundColor: `${phaseColor}55` }}
                            title={`${phase}: ${format(parseISO(earliest), 'dd MMM')} – ${format(parseISO(latestEndDate), 'dd MMM')} · ${phaseTasks.length} tasks · ${avgProgress}% done`}
                          >
                            <div className="h-full" style={{ width: `${avgProgress}%`, backgroundColor: phaseColor }} />
                            {bWidth > 6 && (
                              <div className="absolute inset-0 flex items-center px-1.5">
                                <span className="text-[8px] font-bold text-white truncate whitespace-nowrap drop-shadow-sm">
                                  {phaseTasks.length} tasks{avgProgress > 0 ? ` · ${avgProgress}%` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {!collapsedPhases.has(phase) && phaseTasks.map((task) => {
                      const barLeft  = displayPct(parseISO(task.startDate));
                      const barRight = displayPct(addDays(parseISO(task.endDate), 1));
                      const barWidth = Math.max(0.4, barRight - barLeft);
                      const showLabel    = barWidth > 7;
                      const showDuration = barWidth > 13;

                      const taskFloat    = criticalPath.get(task.id) ?? 999;
                      const isCritical   = taskFloat === 0;
                      const isNearCrit   = !isCritical && taskFloat <= NEAR_CRITICAL_DAYS;
                      const floatBarEnd  = taskFloat > 0 && taskFloat < 999
                        ? Math.min(100, displayPct(addDays(parseISO(task.endDate), taskFloat)))
                        : barRight;
                      const floatWidth   = Math.max(0, floatBarEnd - barRight);
                      const [fr, fg, fb] = hexToRgb(task.color);
                      const floatBgColor     = `rgba(${fr},${fg},${fb},0.18)`;
                      const floatBorderColor = `rgba(${fr},${fg},${fb},0.50)`;

                      return (
                        <div key={task.id}>
                          <div
                            className={`border-b border-border/50/60 relative flex items-center cursor-pointer ${expandedId === task.id ? "bg-white/[0.025]" : ""}`}
                            style={{ height: ROW_H, minWidth: `${displayColumns.length * COL_W}px` }}
                            onClick={() => { if (expandedId !== task.id) { setExpandedId(task.id); setEditDraft({ ...task }); setConfirmDelete(null); } }}
                          >
                            {/* Weekend shading */}
                            {viewMode === "weekly" && displayColumns.map((_, i) => (
                              <div key={i} className="absolute top-0 bottom-0 pointer-events-none bg-white/[0.025]"
                                style={{ left: `${((i + 5 / 7) / displayColumns.length) * 100}%`, width: `${(2 / 7 / displayColumns.length) * 100}%` }} />
                            ))}
                            {/* daily: shade weekends (calendar mode) and holidays in both modes */}
                            {viewMode === "daily" && displayColumns.map((col, i) => {
                              const colKey2 = format(col, "yyyy-MM-dd");
                              const dispHol2 = holDisplayMap.get(colKey2);
                              const isCustomHol2 = dispHol2?.isCustom === true;
                              const isPublicHol2 = dispHol2 !== undefined && !isCustomHol2;
                              const isWknd2 = !workDays && (col.getDay() === 0 || col.getDay() === 6);
                              if (!isWknd2 && !dispHol2) return null;
                              const rowBg = isCustomHol2 ? "rgba(139,92,246,0.28)" : isPublicHol2 ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.04)";
                              return (
                                <div key={i}
                                  className="absolute top-0 bottom-0 pointer-events-none"
                                  style={{ left: `${(i / displayColumns.length) * 100}%`, width: `${(1 / displayColumns.length) * 100}%`, backgroundColor: rowBg }}
                                />
                              );
                            })}

                            {/* Grid lines */}
                            {displayColumns.map((_, i) => (
                              <div key={i} className="absolute top-0 bottom-0 border-r border-border/50/20 pointer-events-none" style={{ left: `${(i / displayColumns.length) * 100}%` }} />
                            ))}

                            {/* Today line */}
                            {displayTodayPct >= 0 && displayTodayPct <= 100 && (
                              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10 pointer-events-none" style={{ left: `${displayTodayPct}%` }} />
                            )}

                            {/* Float window (ghost extension) */}
                            {floatWidth > 0.3 && (
                              <div
                                className="absolute pointer-events-none rounded-r-md"
                                style={{
                                  left: `${barRight}%`, width: `${floatWidth}%`, height: 34,
                                  backgroundColor: floatBgColor,
                                  border: `1.5px dashed ${floatBorderColor}`,
                                  borderLeft: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                            )}

                            {/* Task bar */}
                            <div
                              className="absolute rounded-md cursor-pointer select-none transition-all hover:brightness-110 hover:scale-y-105 hover:shadow-lg overflow-hidden"
                              style={{
                                left: `${barLeft}%`, width: `${barWidth}%`, height: 34, backgroundColor: task.color,
                                borderLeft: isCritical ? '4px solid #ef4444' : isNearCrit ? '4px solid #f59e0b' : undefined,
                              }}
                              onClick={(e) => { e.stopPropagation(); handleBarClick(task); }}
                              onMouseEnter={(e) => setTooltip({ task, x: e.clientX, y: e.clientY })}
                              onMouseMove={(e)  => setTooltip({ task, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {task.progress > 0 && (
                                <div className="absolute left-0 top-0 bottom-0"
                                  style={{ width: `${task.progress}%`, background: "repeating-linear-gradient(135deg,transparent 0,transparent 4px,rgba(255,255,255,.18) 4px,rgba(255,255,255,.18) 8px)" }} />
                              )}
                              {showLabel && (
                                <div className="absolute inset-0 flex items-center px-2 gap-1.5 overflow-hidden">
                                  <span className="text-[10px] text-white font-semibold truncate leading-none drop-shadow">{task.name}</span>
                                  {showDuration && <span className="text-[9px] text-white/60 flex-shrink-0 leading-none">{workDays ? `${countWorkingDays(parseISO(task.startDate), parseISO(task.endDate), activeHols)}wd` : `${task.durationDays}d`}</span>}
                                  {task.progress > 0 && <span className="text-[9px] text-white/80 flex-shrink-0 ml-auto leading-none font-medium">{task.progress}%</span>}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom edit panel ────────────────────────────────────────────── */}
        {expandedId && editDraft && (
          <div className="border border-[#412D15]/80 rounded-xl bg-card/90 px-4 py-3 gantt-no-print">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: editDraft.color }} />
              <span className="text-sm font-semibold text-white truncate">{editDraft.name}</span>
              <button
                onClick={() => { setExpandedId(null); setEditDraft(null); setConfirmDelete(null); }}
                className="ml-auto text-slate-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Task Name</Label>
                <Input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className="h-7 text-sm bg-muted/60 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
                <Input type="date" value={editDraft.startDate} onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })} className="h-7 text-sm bg-muted/60 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                <Input type="date" value={editDraft.endDate} onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })} className="h-7 text-sm bg-muted/60 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Progress (%)</Label>
                <Input type="number" min={0} max={100} value={editDraft.progress} onChange={(e) => setEditDraft({ ...editDraft, progress: Math.min(100, Math.max(0, Number(e.target.value))) })} className="h-7 text-sm bg-muted/60 border-slate-600 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Trade / Assignee</Label>
                <Input value={editDraft.trade} onChange={(e) => setEditDraft({ ...editDraft, trade: e.target.value })} placeholder="e.g. Carpenter" className="h-7 text-sm bg-muted/60 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Bar Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editDraft.color} onChange={(e) => setEditDraft({ ...editDraft, color: e.target.value })} className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-xs text-slate-500">{editDraft.color}</span>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Input
                value={editDraft.notes?.startsWith("No estimate items matched") ? "" : (editDraft.notes ?? "")}
                onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                placeholder="Optional notes…"
                className="h-7 text-sm bg-muted/60 border-slate-600 text-white"
              />
            </div>

            {/* Scope of Works combobox */}
            <div className="mb-3 relative" ref={sowContainerRef}>
              <Label className="text-xs text-muted-foreground mb-1 block">Scope of Works</Label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search scope items…"
                  value={sowSearch}
                  onFocus={() => setSowOpen(true)}
                  onChange={(e) => { setSowSearch(e.target.value); setSowOpen(true); }}
                  className="h-7 text-sm w-full rounded-md border border-slate-600 bg-muted/60 px-3 py-1 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#412D15]"
                />
                {editDraft.sowRef && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setEditDraft({ ...editDraft, sowRef: undefined }); setSowSearch(""); }}
                    className="absolute right-2 top-1.5 text-slate-500 hover:text-white"
                    aria-label="Clear"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {sowOpen && (
                <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                  {filteredSOW.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">No results</div>
                  ) : (
                    filteredSOW.map(({ trade, items: tradeItems }) => (
                      <div key={trade}>
                        <div className="px-3 py-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/60 sticky top-0">
                          {trade}
                        </div>
                        {tradeItems.map((r) => (
                          <button
                            key={r.id}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 flex items-center gap-2 ${editDraft.sowRef === r.id ? "bg-[#412D15]/60 text-white" : "text-slate-300"}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEditDraft({ ...editDraft, sowRef: r.id });
                              setSowSearch(r.sow);
                              setSowOpen(false);
                            }}
                          >
                            <span className="flex-1 truncate">{r.sow}</span>
                            <span className="text-[9px] text-slate-500 flex-shrink-0">{r.unit}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-[#412D15] hover:bg-[#412D15]/90">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setExpandedId(null); setEditDraft(null); setConfirmDelete(null); }} className="h-7 text-xs text-muted-foreground hover:text-foreground">Cancel</Button>
              <div className="ml-auto flex items-center gap-2">
                {confirmDelete === expandedId ? (
                  <>
                    <span className="text-xs text-red-400">Delete this task?</span>
                    <Button size="sm" onClick={() => handleDelete(expandedId)} className="h-7 text-xs bg-red-900/50 hover:bg-red-900/80 text-red-300 border border-red-800/50">Yes, delete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)} className="h-7 text-xs text-muted-foreground hover:text-foreground">No</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(expandedId)} className="h-7 text-xs text-red-400 hover:text-red-300">Delete</Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 gantt-no-print px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-red-500/70 rounded-full" />
            <span className="text-xs text-slate-500">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-4 rounded" style={{ background: "linear-gradient(90deg,#0891b2 55%,transparent 55%),repeating-linear-gradient(135deg,transparent 0,transparent 4px,rgba(255,255,255,.18) 4px,rgba(255,255,255,.18) 8px)", backgroundColor: "#0891b2" }} />
            <span className="text-xs text-slate-500">Progress</span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-4 rounded overflow-hidden" style={{ backgroundColor: '#64748b', borderLeft: '4px solid #ef4444' }} />
              <span className="text-xs text-slate-500">Critical</span>
            </div>
          )}
          {nearCriticalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-4 rounded overflow-hidden" style={{ backgroundColor: '#64748b', borderLeft: '4px solid #f59e0b' }} />
              <span className="text-xs text-slate-500">Near-critical</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="relative w-14 h-4">
              <div className="absolute inset-0 rounded" style={{ backgroundColor: '#64748b' }} />
              <div className="absolute top-0 bottom-0 rounded-r-md" style={{ left: '65%', right: 0, backgroundColor: 'rgba(100,116,139,0.18)', border: '1.5px dashed rgba(148,163,184,0.55)', borderLeft: 'none' }} />
            </div>
            <span className="text-xs text-slate-500">Float</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {groupedTasks.map(({ phase }) => (
              <button key={phase} onClick={() => togglePhase(phase)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${collapsedPhases.has(phase) ? "border-slate-600 text-slate-500 bg-card/90" : "border-slate-600 text-muted-foreground hover:bg-muted/60/50"}`}
              >
                {collapsedPhases.has(phase) ? "▶" : "▼"} {phase}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
