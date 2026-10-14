// disiliskiler içerik tipleri: content/regulation-packages ve content/supplier-program (veri, kod değil — kural 5/6).
import { contentOf } from "@/lib/content";

export type SourceStatus = "verified" | "unverified" | "draft";
export type PublicationStatus = "draft" | "consultation" | "in_force" | "unknown";

export interface PackageRule {
  id: string;
  text: string;
  threshold: { value: string; unit: string } | null;
  source_ref: string;
  source_status: SourceStatus;
  effective_from: string | null;
  last_checked: string | null;
  publication_status: PublicationStatus;
}
export interface PackageQuestion {
  id: string;
  text: { tr: string };
  options: { value: string; label: string }[];
  applies_when: string[];
  excludes_when: string[];
  rule_ref: string | null;
  hint: string | null;
}
export interface PackageObligation {
  id: string;
  text: { tr: string };
  evidence: string[];
  rule_ref: string | null;
  task_role_hint: string | null;
}
export interface RegulationPackage {
  id: string;
  version: string;
  status: "draft" | "active" | "retired";
  title: { tr: string };
  scope: { tr: string };
  decision_owner: { decision_ref: string | null; role: string };
  spec_sections: string[];
  sources: string[];
  applicability_questions: PackageQuestion[];
  obligations: PackageObligation[];
  required_evidence: string[];
  rules: PackageRule[];
}

export const PACKAGES: RegulationPackage[] = contentOf<RegulationPackage>("regulation-packages");
export function packageById(id: string): RegulationPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

export interface SegmentationContent {
  id: "segmentation";
  version: string;
  intensity_classes: { value: "high" | "medium" | "low" | "unknown"; label: string; weight: number; note: string }[];
  first_wave_percent: number;
  note: string;
}
export interface RiskRulesContent {
  id: "risk-rules";
  version: string;
  status: string;
  note: string;
  questions: { id: string; text: { tr: string }; options: { value: string; label: string; points: number }[] }[];
  unanswered_points: number;
  outcomes: { level: "low" | "medium" | "high"; min_points: number; label: string; action: string }[];
  overrides: { question_id: string; equals: string; level: "low" | "medium" | "high"; reason: string }[];
}
export interface TemplateField {
  id: string;
  label: string;
  hint: string;
  required: boolean;
  kind: "text" | "textarea" | "select";
  options?: string[];
}
export interface RequestTemplateContent {
  id: "request-template";
  version: string;
  confidentiality: { title: string; text: string; aggregated_use_text: string };
  fields: TemplateField[];
  response_fields: TemplateField[];
}
export interface ExampleTemplateContent {
  id: "example-template";
  version: string;
  lesson_id: string;
  note: string;
  fields: Record<string, string>;
  response: Record<string, string>;
}

type SupplierContent = SegmentationContent | RiskRulesContent | RequestTemplateContent | ExampleTemplateContent;
const SUPPLIER_CONTENT = contentOf<SupplierContent>("supplier-program");
function pick<T extends SupplierContent>(id: T["id"]): T {
  const c = SUPPLIER_CONTENT.find((x) => x.id === id);
  if (!c) throw new Error(`content/supplier-program/${id}.yaml eksik`);
  return c as T;
}
export const SEGMENTATION = pick<SegmentationContent>("segmentation");
export const RISK_RULES = pick<RiskRulesContent>("risk-rules");
export const REQUEST_TEMPLATE = pick<RequestTemplateContent>("request-template");
export const EXAMPLE_TEMPLATE = pick<ExampleTemplateContent>("example-template");
