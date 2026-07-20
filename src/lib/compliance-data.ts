// Compliance documentation library data — SQF Edition 9 + C&D IT/Governance +
// POL-PRIV (Alight/VISO TRUST) + FRM templates + execution checklist.
// Ported verbatim from Lee Zerfass's standalone SQF library viewer (July 2026).

export const GEN = "✅ GENERATED — .docx v1.0 available";
export const GEN_XL = "✅ GENERATED — .xlsx template available";

export interface CdPolicy {
  id: string;
  title: string;
  cat: "IT_GOV" | "RISK" | "DATA" | "OPS";
}

export interface PolPrivDoc {
  id: string;
  title: string;
  covers: string;
}

export interface FrmSheet {
  name: string;
  desc: string;
}

export interface FrmTemplate {
  id: string;
  file: string;
  title: string;
  sheets: FrmSheet[];
}

export interface CdLink {
  id: string;
  note: string;
}

export type GapStatus = "new" | "partial" | "cross-ref";

export interface SopDoc {
  id: string;
  type: "Document" | "Policy" | "SOP" | "Work Instruction";
  section: string;
  title: string;
  mandatory: boolean;
  gapStatus: GapStatus;
  cdLinks: CdLink[];
  description: string;
  keyContent: string[];
  records: string[];
  reviewFrequency: string;
  implementationNote: string;
}

export interface Module13Sop {
  id: string;
  section: string;
  title: string;
  gapStatus: GapStatus;
  cdLinks: CdLink[];
  topics: string;
  implementationNote: string;
}

export type DocStatus = "ready" | "pending" | "gap";

export interface ChecklistItem {
  ref: string;
  text: string;
  mandatory: boolean;
  docStatus: DocStatus;
  note: string;
}

export interface ChecklistCategory {
  category: string;
  items: ChecklistItem[];
}

export interface VersionControlInfo {
  namingConvention: string;
  fields: string[];
  revisionTriggers: string[];
  approvalLevels: Record<string, string>;
  retentionRules: string;
  folderStructure: { folder: string; contents: string }[];
}

export const overview = {
  description:
    "Full SQF Edition 9 documentation library for C&D Printing & Packaging, St. Petersburg FL. 39 SOP/Policy documents generated (Word .docx), 5 FRM record workbooks (Excel .xlsx), org chart, role designations, and the complete Alight Solutions / VISO TRUST POL-PRIV remediation library (11 documents + formal response email). All documents validated. The compliance checklist reflects current document status vs. real-world execution status.",
};

export const cdPolicies: CdPolicy[] = [
  { id: "PWD-2.0r2", title: "Password Policy", cat: "IT_GOV" },
  { id: "PCI-2.0r2", title: "PCI DSS Compliance Policy", cat: "DATA" },
  { id: "PHYS-2.0r2", title: "Physical Security Program", cat: "OPS" },
  { id: "FL-2.0r2", title: "Statement Against Forced Labor", cat: "RISK" },
  { id: "RACD-2.0r2", title: "Request for Access, Correction, or Deletion Policy", cat: "DATA" },
  { id: "RISK-2.0r2", title: "Risk Management Policy", cat: "RISK" },
  { id: "CLEAN-2.0r2", title: "Secure Cleanroom Operations Policy", cat: "OPS" },
  { id: "SA-2.0r2", title: "Security Awareness Policy", cat: "IT_GOV" },
  { id: "SRV-2.0r2", title: "Server Configuration Security Standards Policy", cat: "IT_GOV" },
  { id: "SIEM-2.0r2", title: "SIEM & API Security Integration Policy", cat: "IT_GOV" },
  { id: "SOA-2.0r2", title: "Statement of Applicability", cat: "IT_GOV" },
  { id: "DR-2.0r2", title: "Technology Disaster Recovery Exercise and Testing Program", cat: "RISK" },
  { id: "TPRM-2.0r2", title: "Third Party Risk Management Policy", cat: "RISK" },
  { id: "VULN-2.0r2", title: "Vulnerability Management Policy", cat: "IT_GOV" },
  { id: "WIFI-2.0r2", title: "Wireless Network Policy", cat: "IT_GOV" },
  { id: "EUDS-2.0r2", title: "End User Device Security Policy", cat: "IT_GOV" },
  { id: "BREACH-2.0r2", title: "Enhanced Breach Notification & Remediation Policy", cat: "DATA" },
  { id: "GDPR-2.0r2", title: "GDPR Overview Document", cat: "DATA" },
  { id: "HRSEC-2.0r2", title: "HR Security Policy", cat: "DATA" },
  { id: "REDFLAG-2.0r2", title: "Identity Theft Detection Policy (Red Flags Rule)", cat: "DATA" },
  { id: "IMP-2.0r2", title: "Incident Management Program", cat: "RISK" },
  { id: "INFOSEC-2.0r2", title: "Information Security Policy", cat: "IT_GOV" },
  { id: "LOGMON-2.0r2", title: "Logging and Monitoring Policy", cat: "IT_GOV" },
  { id: "MDM2-2.0r2", title: "Mobile Device Management Policy", cat: "IT_GOV" },
  { id: "NETSEC-2.0r2", title: "Network Security Policy", cat: "IT_GOV" },
  { id: "ORA-2.0r2", title: "Operational Risk Assessment", cat: "RISK" },
  { id: "OPSEC2-2.0r2", title: "Operational Security Policy", cat: "OPS" },
  { id: "BACKUP-2.0r2", title: "Data Backup Policy", cat: "IT_GOV" },
  { id: "DBREACH-2.0r2", title: "Data Breach Response Plan Policy", cat: "DATA" },
  { id: "DCLASS-2.0r2", title: "Data Classification Policy", cat: "DATA" },
  { id: "DHARD-2.0r2", title: "Data Configuration and Hardening Policy", cat: "IT_GOV" },
  { id: "DENC-2.0r2", title: "Data Encryption Policy", cat: "IT_GOV" },
  { id: "DLEAK-2.0r2", title: "Data Leakage Recovery Policy", cat: "DATA" },
  { id: "DLP-2.0r2", title: "Data Loss Prevention (DLP) Policy", cat: "DATA" },
  { id: "DPIE-2.0r2", title: "Data Privacy Incident and Escalation Policy", cat: "DATA" },
  { id: "DPWEB-2.0r2", title: "Data Privacy Policy for Websites", cat: "DATA" },
  { id: "DPRIV-2.0r2", title: "Data Privacy Policy", cat: "DATA" },
  { id: "DPIA-2.0r2", title: "Data Protection Impact Assessment (DPIA) Policy", cat: "DATA" },
  { id: "DRPLAN-2.0r2", title: "Disaster Recovery Plan", cat: "RISK" },
  { id: "DRTEST-2.0r2", title: "Disaster Recovery Testing Examples", cat: "RISK" },
  { id: "DOCCM-2.0r2", title: "Document Change Management Policy", cat: "IT_GOV" },
  { id: "AUP-2.0r2", title: "Acceptable Use Policy", cat: "IT_GOV" },
  { id: "ACP-2.0r2", title: "Access Control Policy", cat: "IT_GOV" },
  { id: "AMP-2.0r2", title: "Access Management Policy", cat: "IT_GOV" },
  { id: "ABC-2.0r2", title: "Anti-Bribery and Corruption Policy", cat: "RISK" },
  { id: "AMW-2.0r2", title: "Anti-Malware Policy", cat: "IT_GOV" },
  { id: "APPSEC-2.0r2", title: "Application Security Policy", cat: "IT_GOV" },
  { id: "AIUSE-2.0r2", title: "Artificial Intelligence Use Policy", cat: "DATA" },
  { id: "BIA-2.0r2", title: "Business Impact Analysis", cat: "RISK" },
  { id: "BRP-2.0r2", title: "Business Resiliency Policy", cat: "RISK" },
  { id: "CCP-2.0r2", title: "Change Control Policy", cat: "IT_GOV" },
  { id: "CSP-2.0r2", title: "Cloud Security Policy", cat: "IT_GOV" },
  { id: "COC-2.0r2", title: "Code of Conduct Policy", cat: "OPS" },
];

export const polPriv: PolPrivDoc[] = [
  { id: "POL-PRIV-001", title: "HIPAA/HITECH Compliance Policy", covers: "HIPAA compliance, Privacy/Security Officer designations, BAAs, PHI training, PHI processing determination" },
  { id: "POL-PRIV-002", title: "Privacy Compliance Program Policy", covers: "DSR process, PIA/DPIA triggers, consent mechanisms, certification status, privacy breach history, external audit commitment, CPO/DPO function" },
  { id: "POL-PRIV-003", title: "Records Retention and Secure Disposal Policy", covers: "Retention schedules by data category, legal hold, secure disposal methods" },
  { id: "POL-PRIV-004", title: "Public Privacy Notice Policy", covers: "Plain-language public notice, data subject rights, annual review commitment" },
  { id: "POL-PRIV-005", title: "GDPR Compliance Program Policy", covers: "GDPR applicability determination, transfer mechanisms (SCCs), RoPA, DPA registration analysis" },
  { id: "POL-PRIV-006", title: "Data Quality and Accuracy Policy", covers: "Accuracy, completeness, fair/unbiased processing, error handling" },
  { id: "POL-PRIV-007", title: "Subcontractor Privacy Compliance Audit Policy", covers: "Third-party privacy compliance auditing, sub-processor controls, audit rights" },
  { id: "POL-PRIV-008", title: "Privacy Awareness Training Policy", covers: "Onboarding + annual training, HIPAA-specific training track, records" },
  { id: "POL-PRIV-009", title: "Cyber Insurance Program Statement", covers: "Coverage commitment, scope, integration with incident response. Certificate of insurance available under NDA." },
  { id: "POL-PRIV-010", title: "Privacy Function Charter and Officer Designation Policy", covers: "CPO/DPO designation, HIPAA officer designations (45 CFR §164.530(a) / §164.308(a)(2)), responsibilities" },
  { id: "POL-PRIV-011", title: "Service Locations Statement", covers: "All services delivered from St. Petersburg, FL USA. No international data transfers in standard operations." },
];

export const polPrivMeta = {
  subtitle: "11 documents generated June 23, 2026 · Formal remediation response email drafted mapping all 46 VISO TRUST control items · Passcode: jgepmYRk2GP6HRsyJG4q",
  openItems: "① Actual cyber insurance certificate or carrier confirmation (POL-PRIV-009). ② GDPR applicability — for standard print/packaging jobs the answer is “not applicable to domestic operations” but confirm with Alight if they send EU-resident data.",
};

export const frmTemplates: FrmTemplate[] = [
  {
    id: "FRM-WB-01", file: "FRM-CAPA-Complaints-NC-v1.0.xlsx", title: "CAPA, Complaints & Non-Conformance",
    sheets: [
      { name: "FRM-001 Complaint Log", desc: "50-row intake log: complaint #, date, customer, product/lot, type, food-safety flag, CAPA link, closure" },
      { name: "FRM-014 CAPA Form", desc: "Single-event form: severity, trigger, containment, 5-Why root cause, corrective action, preventive action, effectiveness verification, closure sign-off" },
      { name: "FRM-014a CAPA Log", desc: "Running register of all CAPAs: number, severity, owner, due date, status, closure date" },
      { name: "FRM-010b NC Log", desc: "Non-conformance log: item, lot, quantity, disposition, CAPA link" },
    ],
  },
  {
    id: "FRM-WB-02", file: "FRM-Supplier-Specs-Legislation-v1.0.xlsx", title: "Supplier, Specifications & Legislation",
    sheets: [
      { name: "FRM-005b Approved Supplier List", desc: "Supplier register: name, material, risk tier (H/M/L), qualification date, GFSI cert, cert expiry, status" },
      { name: "FRM-004b Spec Master List", desc: "Specification index: ID, name, type (RM/FP/Aid/Service), approved suppliers, version, food contact class, location" },
      { name: "FRM-006a Legislation Register", desc: "Pre-seeded with 8 FDA/SQF/EPA/FL DEP regulations. Add customer-specific requirements." },
    ],
  },
  {
    id: "FRM-WB-03", file: "FRM-Traceability-Recall-Audit-v1.0.xlsx", title: "Traceability, Recall & Internal Audit",
    sheets: [
      { name: "FRM-016a Receiving Log", desc: "100-row incoming material log: PO, supplier, lot, internal lot, COA ref, condition, accepted, received by" },
      { name: "FRM-016b Shipping Log", desc: "100-row dispatch log: job #, lot code, customer PO, carrier, BOL, seal #, released by" },
      { name: "FRM-016d Trace Test Record", desc: "Annual trace test form: forward/backward trace, elapsed time, 100% confirmation, CAPA link. PENDING — run August." },
      { name: "FRM-017a Mock Recall Record", desc: "Annual mock recall form: team, lot selected, time to identification, customer notification draft, SQFI draft, gaps, GM sign-off. PENDING — run August." },
      { name: "FRM-015 Audit Checklist", desc: "34-clause internal audit checklist covering all SQF Edition 9 §2.1–2.9 and Module 13 requirements. Auditor sign-off row included." },
    ],
  },
  {
    id: "FRM-WB-04", file: "FRM-Training-Personnel-v1.0.xlsx", title: "Training & Personnel",
    sheets: [
      { name: "FRM-022a Training Record", desc: "Individual training record: topic, description, method, date, trainer, competency method, employee signature" },
      { name: "FRM-022b Training Matrix", desc: "Pre-filled matrix: 11 staff × 10 topics. All required cells show 'Required — Pending'. Replace with training date once delivered." },
    ],
  },
  {
    id: "FRM-WB-05", file: "FRM-GMP-Ops-Master-Register-v1.0.xlsx", title: "GMP Operations & Master Register",
    sheets: [
      { name: "FRM-015b Site Inspection", desc: "20-item quarterly GMP walk-through: floors, walls, pest signs, chemicals, personnel hygiene, glass, waste. Inspector sign-off row." },
      { name: "FRM-M13-003a Calibration Register", desc: "Instrument register: equipment ID, description, location, standard, frequency, last cal, next due, result, certificate #. PENDING — populate." },
      { name: "FRM-M13-010a Chemical Register", desc: "Chemical inventory: name, supplier, use, storage location, SDS date, food-grade flag. PENDING — site walk needed." },
      { name: "FRM-M13-004b Pest Sighting Log", desc: "Sighting log: date, reporter, location, pest type, PCO notified, action taken, CAPA #." },
      { name: "FRM-002 Document Register", desc: "Master document register: pre-populated with all 39 SOP/Policy documents + 13 Module 13 SOPs. Update file path column when saving." },
    ],
  },
];

export const sopLibrary: SopDoc[] = [
  { id: "SQF-ORG-001", type: "Document", section: "2.1.1.3", title: "Organizational Chart & SQF Roles", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Org chart showing Benjy Waxman and Nitay Laor (Co-Owners) → Suzanne Alvarez (GM / SQF Practitioner Backup) → Darrin Blackburn (Production / SQF Practitioner Primary), Lee Zerfass (Sales / Internal Audit Coordinator), Shayla Smith (Shipping & Receiving), Denise Nessmith (Controller) → full staff roster. Satisfies §2.1.1.3.",
    keyContent: ["Rendered org chart diagram", "Role & responsibility table for all 13 named staff", "Back-up coverage assignments", "SQF system roles clearly marked"],
    records: ["Signed document on file", "Living document — update as staff changes"], reviewFrequency: "Upon personnel change",
    implementationNote: GEN + " — SQF-ORG-001-v1.0_Organizational-Chart.docx. Gayle's last name still TBD." },
  { id: "SQF-DESIG-001", type: "Document", section: "2.1.1.4–5", title: "SQF Role Designations", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Formally designates SQF Practitioner (Darrin Blackburn, Primary; Suzanne Alvarez, Backup), HACCP Team (Suzanne, Darrin, Denise, Lee), Recall Team, Internal Audit Coordinator (Lee Zerfass), and Food Defense Responsible Manager (Darrin Blackburn). Satisfies §2.1.1.4–5 and all named-role requirements.",
    keyContent: ["SQF Practitioner designation with HACCP training status checkboxes", "HACCP team by name and function", "Recall team with explicit responsibilities", "All named SQF system roles in one document"],
    records: ["Signed designation form", "Training records for Darrin & Suzanne (HACCP cert)"], reviewFrequency: "Upon personnel change",
    implementationNote: GEN + " — SQF-DESIG-001-v1.0_Role-Designations.docx. HACCP training status for Darrin Blackburn and Suzanne Alvarez still pending confirmation." },
  { id: "POL-001", type: "Policy", section: "2.1.1", title: "Food Safety & Quality Policy Statement", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Senior management-signed statement committing to safe packaging supply, food safety culture, continuous improvement, and regulatory compliance.",
    keyContent: ["Signed by Suzanne Alvarez (GM)", "4 pillars: safe supply, culture, improvement, compliance", "Display and distribution requirements"],
    records: ["Signed policy statement", "Distribution/posting log"], reviewFrequency: "Annual",
    implementationNote: GEN + " — POL-001-v1.0_Food-Safety-Quality-Policy-Statement.docx. Still needs physical signature, site posting, and posting log completed." },
  { id: "POL-002", type: "Policy", section: "2.1.2", title: "Management Review Policy", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Annual management review (October, chaired by Suzanne Alvarez with Darrin, Lee, Benjy, Nitay) and monthly SQF Practitioner update cadence.",
    keyContent: ["Review team: Suzanne Alvarez, Darrin Blackburn, Lee Zerfass, Benjy Waxman, Nitay Laor", "Annual review month: October 2027", "Monthly practitioner update topics"],
    records: ["Annual review minutes", "Monthly update logs"], reviewFrequency: "Annual — October",
    implementationNote: GEN + " — POL-002-v1.0_Management-Review-Policy.docx. First review meeting not yet held." },
  { id: "SOP-001", type: "SOP", section: "2.1.3", title: "Customer Complaint Handling", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Intake, investigation, CAPA linkage, and trend analysis for all food safety complaints. Lee Zerfass (Sales) is first point of contact; Darrin Blackburn leads investigation.",
    keyContent: ["FRM-001 Complaint Log", "24-hr food-safety escalation", "SQFI notification protocol", "Monthly trend review"],
    records: ["FRM-001 Complaint Log", "CAPA records"], reviewFrequency: "Annual or upon trend",
    implementationNote: GEN + " — SOP-001-v1.0_Customer-Complaint-Handling.docx. FRM-001 template is in FRM-CAPA-Complaints-NC-v1.0.xlsx." },
  { id: "SOP-002", type: "SOP", section: "2.2", title: "Document Control & Records Management", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "DOCCM-2.0r2", note: "CRB approval workflow adapted for SQF document changes" }, { id: "CCP-2.0r2", note: "Change classification reused for SOP revisions" }],
    description: "Governs creation, approval, versioning, distribution, retention, and disposal of all SQF documents. Extends DOCCM-2.0r2 and CCP-2.0r2 to cover physical operational SOPs.",
    keyContent: ["Naming convention: TYPE-###-vX.X", "Approval authority matrix", "FRM-002 Master Document Register (pre-populated)", "Record retention schedule"],
    records: ["FRM-002 Master Document Register", "Change log"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-002-v1.0_Document-Control-Records-Management.docx. FRM-002 is pre-populated in FRM-GMP-Ops-Master-Register-v1.0.xlsx — update file path column." },
  { id: "SOP-003", type: "SOP", section: "2.3.1", title: "Product Design, Development & Realization", mandatory: false, gapStatus: "new", cdLinks: [],
    description: "8-step workflow from customer brief through food safety review, trial production, artwork approval, commercial launch, and change validation.",
    keyContent: ["FRM-003a Design Brief", "FRM-003b Trial Record", "FRM-003c Artwork Approval", "Golden standard sample"],
    records: ["Design Brief", "Trial Record", "Artwork Approval", "Golden standard samples"], reviewFrequency: "Annual or upon change",
    implementationNote: GEN + " — SOP-003-v1.0_Product-Design-Development-Realization.docx." },
  { id: "SOP-004", type: "SOP", section: "2.3.2", title: "Specification Management", mandatory: false, gapStatus: "new", cdLinks: [],
    description: "Creation, approval, and change control for all RM, FP, processing aid, plate/cylinder, and contract service specifications. FRM-004b Specification Master List tracks all specs.",
    keyContent: ["FRM-004a Specification Template", "FRM-004b Spec Master List (in FRM-Supplier-Specs xlsx)", "Food-contact classification required field", "Customer notification for FP spec changes"],
    records: ["FRM-004a per item", "FRM-004b Spec Master List"], reviewFrequency: "As changes occur",
    implementationNote: GEN + " — SOP-004-v1.0_Specification-Management.docx. FRM-004b is in FRM-Supplier-Specs-Legislation-v1.0.xlsx — needs populating with all current RMs and SKUs." },
  { id: "SOP-005", type: "SOP", section: "2.3.4", title: "Approved Supplier Program", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "TPRM-2.0r2", note: "Vendor due diligence and monitoring backbone reused" }, { id: "ABC-2.0r2", note: "Anti-bribery vetting folded in" }, { id: "FL-2.0r2", note: "Forced labor zero-tolerance applied" }],
    description: "Risk-based supplier qualification (HIGH/MEDIUM/LOW tiers), COA requirements, ongoing monitoring, and ethical sourcing checks.",
    keyContent: ["FRM-005b Approved Supplier List (in FRM-Supplier-Specs xlsx)", "HIGH tier: GFSI cert preferred; COA every shipment", "Supplier non-conformance → CAPA"],
    records: ["FRM-005a Supplier Questionnaire", "FRM-005b Approved Supplier List"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-005-v1.0_Approved-Supplier-Program.docx. FRM-005b in FRM-Supplier-Specs-Legislation-v1.0.xlsx — Shayla Smith to populate." },
  { id: "SOP-006", type: "SOP", section: "2.4.1", title: "Food Safety Legislation Monitoring", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Monthly monitoring of FDA, SQF, and customer requirements. 24-hour SQFI notification protocol (foodsafetycrisis@sqfi.com). FRM-006a Legislation Register pre-seeded with 8 regulations.",
    keyContent: ["FRM-006a Legislation Register (pre-seeded in xlsx)", "24-hr notification: foodsafetycrisis@sqfi.com + CB", "Certification Body name/contact TBD"],
    records: ["FRM-006a Legislation Register", "FRM-006b Notification Log"], reviewFrequency: "Ongoing + annual",
    implementationNote: GEN + " — SOP-006-v1.0_Food-Safety-Legislation-Monitoring.docx. Legislation Register in FRM-Supplier-Specs-Legislation-v1.0.xlsx (pre-seeded). Insert CB contact before going live." },
  { id: "SOP-007", type: "SOP", section: "2.4.2", title: "Good Manufacturing Practices (GMP) — Master", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Governing document for all 13 Module 13 SOPs (M13-001 through M13-013). References exemption justification process and links GMP compliance to quarterly site inspections.",
    keyContent: ["M13 SOP index", "GMP exemption risk justification process", "Quarterly GMP inspection cadence"],
    records: ["GMP inspection records (FRM-015b)", "Exemption justifications"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-007-v1.0_Good-Manufacturing-Practices.docx." },
  { id: "SOP-008", type: "SOP", section: "2.4.3", title: "HACCP / Food Safety Plan Framework", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Codex 12-step HACCP framework for 3 product groups: Folded Carton, Flexible Packaging, Commercial Offset. HACCP Team: Suzanne, Darrin, Denise, Lee.",
    keyContent: ["HACCP team roster named", "Scope per product group", "FRM-008a Hazard Analysis Worksheet (per group)", "FRM-008b CCP Worksheet", "FRM-008c CCP Monitoring Log", "Annual review: October"],
    records: ["FRM-008a–e (Hazard Analysis, CCP, Monitoring, Deviation, Annual Review)"], reviewFrequency: "Annual — October",
    implementationNote: GEN + " — SOP-008-v1.0_HACCP-Food-Safety-Plan.docx. Framework document complete. ⚠️ LARGEST OPEN ITEM: HACCP Team floor walk, verified flow diagrams, and completed hazard analysis worksheets (FRM-008a/b) for all 3 product groups still required." },
  { id: "SOP-009", type: "SOP", section: "2.4.4", title: "Product Sampling, Inspection & Analysis", mandatory: false, gapStatus: "new", cdLinks: [],
    description: "Sampling plans by stage (incoming/in-process/finished), approved test methods (CIELab, ISO barcode grading, TAPPI dimensional), and ISO/IEC 17025 external lab requirements.",
    keyContent: ["FRM-009a–c Inspection Records", "Accredited external lab requirement", "Sample retention and destruction protocol"],
    records: ["FRM-009a Incoming Inspection", "FRM-009b In-Process Inspection", "FRM-009c Finished Product Inspection"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-009-v1.0_Product-Sampling-Inspection-Analysis.docx. ISO/IEC 17025 external lab not yet contracted." },
  { id: "SOP-010", type: "SOP", section: "2.4.5 / 2.4.6", title: "Non-Conforming Material & Rework Control", mandatory: false, gapStatus: "new", cdLinks: [],
    description: "Red HOLD tag system, quarantine area, disposition authority matrix (Darrin Blackburn), rework supervision with re-identification, and returned product handling.",
    keyContent: ["FRM-010a Hold Tag", "FRM-010b NC Log (in CAPA-Complaints xlsx)", "Designated quarantine area (location TBD)", "Rework re-identification and re-inspection"],
    records: ["FRM-010a Hold Tag (copy filed)", "FRM-010b NC Log"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-010-v1.0_Non-Conforming-Material-Rework-Control.docx. FRM-010b in FRM-CAPA-Complaints-NC-v1.0.xlsx. Quarantine area location must be designated and marked." },
  { id: "SOP-011", type: "SOP", section: "2.4.7", title: "Product Release", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Release authority matrix (Darrin Blackburn primary; Todd Pembrook backup for standard release). Certificate of Conformance (FRM-011a) required on all releases.",
    keyContent: ["Release authority: Darrin Blackburn / Todd Pembrook (backup — confirm)", "FRM-011a Certificate of Conformance", "CCP records must be complete and clean before release"],
    records: ["FRM-011a Certificate of Conformance"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-011-v1.0_Product-Release.docx. Todd Pembrook backup authority needs formal confirmation from Suzanne Alvarez." },
  { id: "SOP-012", type: "SOP", section: "2.4.8", title: "Environmental Monitoring Program", mandatory: false, gapStatus: "partial",
    cdLinks: [{ id: "RISK-2.0r2", note: "Risk identification/assessment methodology used for go/no-go decision" }],
    description: "Risk-assessment-driven framework. Current decision: formal EMP NOT required at baseline for a commercial printing site. Triggered if customer spec requires it or product line changes to higher-risk food contact.",
    keyContent: ["Risk assessment documented — LOW baseline", "Customer spec check required (Lee Zerfass)", "Triggered program framework ready if needed"],
    records: ["FRM-012a Risk Assessment (annual)", "FRM-012b Test Results (if triggered)"], reviewFrequency: "Annual — October",
    implementationNote: GEN + " — SOP-012-v1.0_Environmental-Monitoring-Program.docx. Confirm with Lee Zerfass whether any current customer contract requires EMP." },
  { id: "SOP-013", type: "SOP", section: "2.5.1 / 2.5.2", title: "Validation & Verification Activities", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Validation methodology for GMPs and CCP critical limits. Verification schedule: CCP records reviewed weekly, full re-validation annually in October, trace test and mock recall in August.",
    keyContent: ["FRM-013a Validation Study", "FRM-013b Verification Schedule & Log", "9-item verification schedule with owners and months"],
    records: ["FRM-013a Validation Study", "FRM-013b Verification Log"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-013-v1.0_Validation-Verification-Activities.docx. Cannot run validation until HACCP plan (SOP-008) is finalized and CCPs are identified." },
  { id: "SOP-014", type: "SOP", section: "2.5.3", title: "Corrective & Preventive Action (CAPA)", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "IMP-2.0r2", note: "Classify/contain/investigate/lessons-learned structure adapted from Incident Management Program" }],
    description: "CAPA procedure with severity tiers (Critical/Major/Minor), response timelines, 5-Why root cause analysis, effectiveness verification. CAPA log in FRM-014a.",
    keyContent: ["FRM-014 CAPA Form (in CAPA-Complaints xlsx)", "FRM-014a CAPA Log (in CAPA-Complaints xlsx)", "Critical: containment 24hrs / root cause 72hrs"],
    records: ["FRM-014 CAPA Form", "FRM-014a CAPA Log"], reviewFrequency: "Ongoing",
    implementationNote: GEN + " — SOP-014-v1.0_CAPA.docx. FRM-014 and FRM-014a are in FRM-CAPA-Complaints-NC-v1.0.xlsx — ready to use." },
  { id: "SOP-015", type: "SOP", section: "2.5.4", title: "Internal Audit & Site Inspection Program", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "SOA-2.0r2", note: "Audit governance pattern referenced; scope expanded from ISO 27001 to full SQF code" }],
    description: "Annual internal audit (September) covering all SQF clauses. 8-area schedule with named auditors maintaining independence. Quarterly GMP site inspections using FRM-015b.",
    keyContent: ["Annual schedule: September (8 areas)", "FRM-015 Audit Checklist — 34 clause items pre-built", "FRM-015b Site Inspection Form — 20 items pre-built", "Lee Zerfass = Internal Audit Coordinator"],
    records: ["FRM-015 Audit Checklist", "FRM-015a Audit Report", "FRM-015b Site Inspection"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-015-v1.0_Internal-Audit-Site-Inspection.docx. FRM-015 and FRM-015b in FRM-Traceability-Recall-Audit-v1.0.xlsx. Auditor training for Lee Zerfass and Suzanne Alvarez still needed." },
  { id: "SOP-016", type: "SOP", section: "2.6.1 / 2.6.2", title: "Product Identification & Traceability", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Lot coding system (YYYYMMDD+Job#), job traveler linking RM lots to finished product, forward/backward trace capability. Annual trace test target: August.",
    keyContent: ["FRM-016a Receiving Log (100 rows, in Traceability xlsx)", "FRM-016b Shipping Log (100 rows, in Traceability xlsx)", "FRM-016c Job Traveler", "FRM-016d Annual Trace Test Record"],
    records: ["FRM-016a–d (Receiving, Shipping, Traveler, Trace Test)"], reviewFrequency: "Annual test required",
    implementationNote: GEN + " — SOP-016-v1.0_Product-Identification-Traceability.docx. Confirm job numbering system generates unique non-reused identifiers (Mike Matroka). First trace test: August." },
  { id: "SOP-017", type: "SOP", section: "2.6.3", title: "Product Withdrawal & Recall", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "BRP-2.0r2", note: "Crisis communication protocol and team activation structure reused" }, { id: "BIA-2.0r2", note: "Critical-process impact mapping informs recall prioritization" }],
    description: "12-step recall procedure. Recall team: Suzanne (Lead), Darrin (product), Shayla (logistics), Lee (customer/SQFI notification), Denise (records), Benjy/Nitay (final authority). SQFI within 24 hours.",
    keyContent: ["FRM-017a Mock Recall Record (in Traceability xlsx)", "12-step procedure", "SQFI: foodsafetycrisis@sqfi.com", "Annual mock recall target: August"],
    records: ["FRM-017a Mock Recall Record", "Actual recall records if any"], reviewFrequency: "Annual test required",
    implementationNote: GEN + " — SOP-017-v1.0_Product-Withdrawal-Recall.docx. FRM-017a in FRM-Traceability-Recall-Audit-v1.0.xlsx. First mock recall: August." },
  { id: "SOP-018", type: "SOP", section: "2.6.4", title: "Crisis Management Plan", mandatory: false, gapStatus: "cross-ref",
    cdLinks: [{ id: "BRP-2.0r2", note: "Team structure and continuity plans directly adopted" }, { id: "BIA-2.0r2", note: "Critical-process analysis directly adopted" }, { id: "DRPLAN-2.0r2", note: "Recovery procedures reused" }, { id: "DR-2.0r2", note: "Annual exercise cadence reused" }, { id: "DRTEST-2.0r2", note: "Test scenarios reused as template" }],
    description: "Product-safety addendum to BRP-2.0r2/BIA-2.0r2/DRPLAN-2.0r2. Adds food-safety-specific scenario table and product release/quarantine rules during crisis.",
    keyContent: ["5-scenario food-safety response table", "No release during crisis without SOP-011 decision", "Annual review at October management review"],
    records: ["Crisis plan review record (in management review minutes)"], reviewFrequency: "Annual test required",
    implementationNote: GEN + " — SOP-018-v1.0_Crisis-Management-Plan.docx. Lowest-effort item — adopts existing BRP/BIA/DR structure directly." },
  { id: "SOP-019", type: "SOP", section: "2.7.1", title: "Food Defense Plan", mandatory: true, gapStatus: "cross-ref",
    cdLinks: [{ id: "PHYS-2.0r2", note: "Badge/camera/perimeter controls directly satisfy physical food-defense requirements" }, { id: "ACP-2.0r2", note: "Least-privilege logged access extended to sensitive production points" }, { id: "CLEAN-2.0r2", note: "Restricted-access, monitored environment model reused" }],
    description: "Threat assessment (7 sensitive points assessed — all ADEQUATE with current PHYS/ACP controls), responsible manager: Darrin Blackburn, staff training requirements.",
    keyContent: ["FRM-019a Threat Assessment (signed by Darrin Blackburn)", "7-point assessment table in document", "Food defense training for all staff"],
    records: ["FRM-019a Threat Assessment (annual)", "Access logs (PHYS-2.0r2)", "Training records"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-019-v1.0_Food-Defense-Plan.docx. Threat assessment table is in the document — Darrin Blackburn must sign and date it. Food defense training not yet delivered." },
  { id: "SOP-020", type: "SOP", section: "2.7.2", title: "Food Fraud Vulnerability Assessment & Mitigation", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "RISK-2.0r2", note: "Risk scoring methodology reused" }, { id: "TPRM-2.0r2", note: "Supplier due-diligence data feeds vulnerability inputs" }],
    description: "5-category vulnerability table (inks, coatings, adhesives, substrates, solvents). HIGH/MEDIUM: food-contact inks and coatings. Mitigation: COA every shipment, GFSI-certified suppliers preferred.",
    keyContent: ["FRM-020a Fraud Risk Register", "5-row assessment table in document", "COA-every-shipment control for HIGH/MEDIUM materials"],
    records: ["FRM-020a Fraud Risk Register (annual)", "Training records"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-020-v1.0_Food-Fraud-Vulnerability-Assessment.docx. Assessment table in document — Darrin Blackburn must review and sign. Confirm current ink/coating supplier list." },
  { id: "SOP-021", type: "SOP", section: "2.8.1", title: "Allergen Management Program", mandatory: true, gapStatus: "new", cdLinks: [],
    description: "Big-9 allergen assessment table (9 rows). Non-allergen site classification. Two MEDIUM items (wheat in starch adhesives, soy in some inks) flagged for COA confirmation. Introduced allergen mitigation plan in place.",
    keyContent: ["FRM-021a Allergen Risk Assessment", "9-row Big-9 assessment table in document", "Introduced allergen mitigation plan", "COA allergen declaration required from suppliers"],
    records: ["FRM-021a Allergen Risk Assessment (annual)", "Training records"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-021-v1.0_Allergen-Management-Program.docx. Review current ink/coating/adhesive COAs for wheat and soy declarations before signing assessment." },
  { id: "SOP-022", type: "SOP", section: "2.9", title: "Training Program", mandatory: true, gapStatus: "partial",
    cdLinks: [{ id: "SA-2.0r2", note: "Onboarding + periodic refresher cadence and accountability model reused" }],
    description: "Training needs matrix: 11 staff × 10 topics. All cells show 'Required — Pending' in FRM-022b. FRM-022a Individual Training Record template ready.",
    keyContent: ["FRM-022a Training Record (in Training xlsx)", "FRM-022b Training Matrix pre-filled — 11 staff, 10 topics (in Training xlsx)", "Annual refresher by December 31"],
    records: ["FRM-022a Training Records (per session)", "FRM-022b Training Matrix"], reviewFrequency: "Annual",
    implementationNote: GEN + " — SOP-022-v1.0_Training-Program.docx. FRM-022a/b in FRM-Training-Personnel-v1.0.xlsx. ⚠️ No food-safety training has been delivered yet — highest-priority action before audit." },
];

export const module13SOPs: Module13Sop[] = [
  { id: "M13-001", section: "13.1", title: "Site Premises & Facilities Standards", gapStatus: "new", cdLinks: [{ id: "PHYS-2.0r2", note: "Perimeter/fencing/gate security reused for facility-security slice" }], topics: "Location risk assessment, building structure (floors/walls/ceilings/drains/lighting/ventilation), grounds maintenance, pest-proofing of openings", implementationNote: GEN + " — M13-001-v1.0_Site-Premises-Facilities-Standards.docx. FRM-M13-001a (location risk assessment) and FRM-M13-001b (facility inspection) still need to be completed on the floor." },
  { id: "M13-002", section: "13.2.1", title: "Facility & Equipment Maintenance", gapStatus: "new", cdLinks: [], topics: "Planned maintenance schedule (FRM-M13-002a), equipment failure log, food-grade lubricants, temporary repair controls, contractor induction requirements", implementationNote: GEN + " — M13-002-v1.0_Facility-Equipment-Maintenance.docx. Populate FRM-M13-002a with all equipment and maintenance intervals (Darrin, Todd, Mike)." },
  { id: "M13-003", section: "13.2.3", title: "Calibration Program", gapStatus: "new", cdLinks: [], topics: "Calibration register (FRM-M13-003a in GMP xlsx), NIST-traceable standards, out-of-calibration response, equipment protection", implementationNote: GEN + " — M13-003-v1.0_Calibration-Program.docx. FRM-M13-003a in FRM-GMP-Ops-Master-Register-v1.0.xlsx — populate with all instruments." },
  { id: "M13-004", section: "13.2.4", title: "Pest Prevention Program", gapStatus: "new", cdLinks: [], topics: "Licensed PCO contractor (name TBD), site map of devices (FRM-M13-004a), chemical approvals and SDS, FRM-M13-004b Pest Sighting Log, quarterly trend review", implementationNote: GEN + " — M13-004-v1.0_Pest-Prevention-Program.docx. FRM-M13-004b in FRM-GMP-Ops-Master-Register-v1.0.xlsx. PCO contractor must be engaged and named." },
  { id: "M13-005", section: "13.2.5", title: "Cleaning & Sanitation Program", gapStatus: "new", cdLinks: [], topics: "Cleaning schedule by area/frequency (FRM-M13-005a), pre-operational inspection (FRM-M13-005b), cleaning agent controls", implementationNote: GEN + " — M13-005-v1.0_Cleaning-Sanitation-Program.docx. Populate FRM-M13-005a with actual chemicals, dilution rates, and responsible persons." },
  { id: "M13-006", section: "13.3", title: "Personnel Hygiene & Welfare", gapStatus: "partial", cdLinks: [{ id: "COC-2.0r2", note: "Professionalism standards extended to hygiene expectations" }], topics: "Illness exclusion, handwashing procedure (20-sec), PPE/jewelry policy, colored bandage requirement, visitor induction, amenities standards", implementationNote: GEN + " — M13-006-v1.0_Personnel-Hygiene-Welfare.docx. Physical check of handwashing stations at all production entry points still needed." },
  { id: "M13-007", section: "13.4", title: "Personnel Processing Practices", gapStatus: "cross-ref", cdLinks: [{ id: "PHYS-2.0r2", note: "Badge entry/exit and door control directly satisfy this requirement" }, { id: "ACP-2.0r2", note: "Logged least-privilege access reused for production floor" }], topics: "Designated entry/exit, door controls, no eating/drinking/smoking in production, waste removal end-of-shift, cross-contamination prevention", implementationNote: GEN + " — M13-007-v1.0_Personnel-Processing-Practices.docx. Largely satisfied by existing PHYS/ACP controls. Food-specific rules (eating/smoking) overlaid." },
  { id: "M13-008", section: "13.5", title: "Water, Ice & Air Quality", gapStatus: "new", cdLinks: [], topics: "Municipal potable water (St. Petersburg), annual microbiological/chemical testing, non-potable segregation, compressed air filter monitoring and annual quality check", implementationNote: GEN + " — M13-008-v1.0_Water-Ice-Air-Quality.docx. Annual water test not yet scheduled — engage accredited lab." },
  { id: "M13-009", section: "13.6.1", title: "Storage & Stock Rotation", gapStatus: "new", cdLinks: [], topics: "FIFO/FEFO rotation, storage plan (FRM-M13-009a), off-floor storage requirement, temperature/humidity monitoring where specified, printing plate/cylinder storage", implementationNote: GEN + " — M13-009-v1.0_Storage-Stock-Rotation.docx." },
  { id: "M13-010", section: "13.6.2", title: "Hazardous Chemical Control", gapStatus: "new", cdLinks: [], topics: "Chemical register (FRM-M13-010a in GMP xlsx), SDS at point of use, locked segregated storage, trained handlers, spill response kit and procedure", implementationNote: GEN + " — M13-010-v1.0_Hazardous-Chemical-Control.docx. FRM-M13-010a in FRM-GMP-Ops-Master-Register-v1.0.xlsx — conduct site walk to compile full chemical inventory. Confirm spill kit location." },
  { id: "M13-011", section: "13.6.3", title: "Loading, Transport & Unloading", gapStatus: "partial", cdLinks: [{ id: "PHYS-2.0r2", note: "Perimeter/dock access control reused for loading-area security" }], topics: "Vehicle inspection before loading (FRM-M13-011a), tamper-evident sealing, loading practices, incoming delivery inspection and rejection record (FRM-M13-011b)", implementationNote: GEN + " — M13-011-v1.0_Loading-Transport-Unloading.docx." },
  { id: "M13-012", section: "13.7", title: "Foreign Matter Prevention", gapStatus: "new", cdLinks: [], topics: "Glass/brittle plastic inventory and monthly inspection (FRM-M13-012a), wooden pallet controls, knife/cutting tool log (FRM-M13-012b), 5-step breakage response (FRM-M13-012c)", implementationNote: GEN + " — M13-012-v1.0_Foreign-Matter-Prevention.docx. FRM-M13-012a glass/brittle-plastic inventory not yet compiled — site survey needed." },
  { id: "M13-013", section: "13.8", title: "Waste Management", gapStatus: "partial", cdLinks: [{ id: "PHYS-2.0r2", note: "Secure shredding/destruction extended to trademarked packaging waste" }], topics: "5-category waste table (general/NC/trademarked/hazardous/recycling), trademarked packaging shred/destruction certificate (FRM-M13-013a), hazardous waste manifests", implementationNote: GEN + " — M13-013-v1.0_Waste-Management.docx." },
];

export const versionControl: VersionControlInfo = {
  namingConvention: "TYPE-###-vX.X — e.g., SOP-008-v2.1",
  fields: ["Document ID", "Title", "Version", "Effective Date", "Review Date", "Author", "Approver", "Change Summary"],
  revisionTriggers: ["Annual scheduled review", "Process or equipment change", "New or revised regulatory requirement", "Internal or external audit finding", "CAPA outcome requiring procedure update", "Customer specification change"],
  approvalLevels: { Policy: "Senior Site Manager (Suzanne Alvarez)", SOP: "SQF Practitioner (Darrin Blackburn) + Dept Head", "Work Instruction": "Department Supervisor" },
  retentionRules: "Minimum product shelf life; superseded versions archived 3 years minimum. Folder: 99_Archived_Versions.",
  folderStructure: [
    { folder: "01_Policies", contents: "POL-001, POL-002, SQF-ORG-001, SQF-DESIG-001" },
    { folder: "02_System_SOPs", contents: "SOP-001 through SOP-022" },
    { folder: "03_Module13_GMPs", contents: "M13-001 through M13-013" },
    { folder: "04_HACCP_Plans", contents: "One subfolder per product group (Folded Carton / Flexible Packaging / Commercial Offset)" },
    { folder: "05_Specifications", contents: "FRM-004a templates by item; FRM-004b Spec Master List" },
    { folder: "06_Forms_Records", contents: "5 FRM .xlsx workbooks" },
    { folder: "07_Training_Materials", contents: "FRM-022a/b; training decks, sign-off sheets" },
    { folder: "08_CD_IT_Governance", contents: "53 C&D v2.0r2 IT/Governance policies" },
    { folder: "09_Privacy_PRIV_Series", contents: "POL-PRIV-001 through POL-PRIV-011 + Alight remediation response" },
    { folder: "99_Archived_Versions", contents: "Superseded documents with 'SUPERSEDED — Date' notation" },
  ],
};

export const checklist: ChecklistCategory[] = [
  { category: "Management & Governance", items: [
    { ref: "2.1.1.3", text: "Org chart with roles, responsibilities, and back-ups", mandatory: true, docStatus: "ready", note: "SQF-ORG-001-v1.0 generated — Gayle last name TBD, GM backup TBD" },
    { ref: "2.1.1.4–5", text: "Primary and substitute SQF Practitioner designated and HACCP-trained", mandatory: true, docStatus: "pending", note: "SQF-DESIG-001 generated — HACCP training confirmation for Darrin & Suzanne still needed" },
    { ref: "2.1.1.1", text: "Food safety policy statement signed, displayed, translated", mandatory: true, docStatus: "pending", note: "POL-001 generated — needs physical signature, site posting, and posting log" },
    { ref: "2.1.1.2", text: "Food safety culture objectives and measures documented", mandatory: true, docStatus: "ready", note: "Covered in POL-001" },
    { ref: "2.1.1.6–7", text: "Training needs resourced; system integrity during personnel changes assured", mandatory: true, docStatus: "pending", note: "SOP-022 and SQF-DESIG-001 cover this — resourcing decision still open" },
    { ref: "2.1.1.8", text: "Blackout dates submitted to Certification Body ≥1 month before re-cert window", mandatory: true, docStatus: "gap", note: "Operational action — submit to CB once CB is named in SOP-006" },
    { ref: "2.1.2.1", text: "Annual management review conducted and documented", mandatory: true, docStatus: "pending", note: "POL-002 generated — first review scheduled October 2027" },
    { ref: "2.1.2.2", text: "Monthly SQF Practitioner updates to management documented", mandatory: true, docStatus: "pending", note: "POL-002 generated — no monthly logs yet" },
  ]},
  { category: "Document & Records Control", items: [
    { ref: "2.2.1.1", text: "SQF System documentation package complete (policies, procedures, specs, plans)", mandatory: true, docStatus: "ready", note: "39 SOP/Policy documents + 5 FRM workbooks generated" },
    { ref: "2.2.1.2", text: "All changes validated/justified before implementation; reasons documented", mandatory: true, docStatus: "ready", note: "SOP-002 (extends DOCCM-2.0r2 / CCP-2.0r2)" },
    { ref: "2.2.2.1", text: "Document control procedure in place; current documents accessible to staff", mandatory: true, docStatus: "ready", note: "SOP-002 — FRM-002 Master Document Register pre-populated in GMP Ops xlsx" },
    { ref: "2.2.3.1–3", text: "Records legible, accurate, securely stored with defined retention periods", mandatory: true, docStatus: "ready", note: "SOP-002 retention schedule; BACKUP-2.0r2 and DCLASS-2.0r2 retention rules" },
  ]},
  { category: "Specifications & Supplier Approval", items: [
    { ref: "2.3.1", text: "Product design and realization procedure documented; trials/validation records maintained", mandatory: false, docStatus: "ready", note: "SOP-003-v1.0 generated" },
    { ref: "2.3.2.1–10", text: "Specifications current for RM, packaging, processing aids, finished products, services", mandatory: false, docStatus: "pending", note: "SOP-004 and FRM-004b generated — specs themselves must be populated" },
    { ref: "2.3.2.3", text: "Labels and printed materials approved, compliant, and controlled", mandatory: false, docStatus: "pending", note: "SOP-004 and SOP-003 cover approval process — approvals not yet run" },
    { ref: "2.3.3", text: "Contract manufacturer agreements documented and compliance verified", mandatory: false, docStatus: "gap", note: "Add if/when contract manufacturers are used" },
    { ref: "2.3.4.1–6", text: "Approved supplier program documented; list current; audits risk-based", mandatory: true, docStatus: "pending", note: "SOP-005 generated; FRM-005b in FRM-Supplier-Specs xlsx — Shayla to populate" },
  ]},
  { category: "Food Safety System", items: [
    { ref: "2.4.1.1–3", text: "Legislation register current; monitoring in place; 24-hr notification protocol ready", mandatory: true, docStatus: "ready", note: "SOP-006 generated; FRM-006a pre-seeded with 8 regs in xlsx" },
    { ref: "2.4.2.1–2", text: "GMP program documented per Module 13; exemptions justified", mandatory: true, docStatus: "ready", note: "SOP-007 + all 13 M13 SOPs generated" },
    { ref: "2.4.3.1–16", text: "HACCP plan complete (all 12 steps); CCPs monitored; annual review completed", mandatory: true, docStatus: "pending", note: "SOP-008 framework generated. ⚠️ Floor walk, flow diagrams, hazard analysis (FRM-008a/b) for all 3 product groups still needed." },
    { ref: "2.4.4.1–6", text: "Sampling and inspection procedures documented; ISO 17025 labs used", mandatory: false, docStatus: "pending", note: "SOP-009 generated — accredited external lab not yet contracted" },
    { ref: "2.4.5", text: "Non-conforming material quarantine and disposition procedure in place", mandatory: false, docStatus: "ready", note: "SOP-010 generated — quarantine area location must be designated" },
    { ref: "2.4.6", text: "Rework procedure documented; traceability maintained", mandatory: false, docStatus: "ready", note: "SOP-010 generated" },
    { ref: "2.4.7.1–2", text: "Product release procedure documented; authorized personnel only", mandatory: true, docStatus: "ready", note: "SOP-011 generated — Todd Pembrook backup authority needs confirmation" },
    { ref: "2.4.8.1–4", text: "Environmental monitoring risk assessment done; program implemented if required", mandatory: false, docStatus: "ready", note: "SOP-012 generated — risk assessment documented (LOW; no program required at baseline). Confirm with Lee re: customer specs." },
  ]},
  { category: "Verification & Corrective Action", items: [
    { ref: "2.5.1.1", text: "Validation of GMPs and critical limits documented; annual re-validation completed", mandatory: true, docStatus: "pending", note: "SOP-013 generated — cannot validate until HACCP CCPs are identified" },
    { ref: "2.5.2.1–2", text: "Verification schedule documented; records maintained", mandatory: true, docStatus: "ready", note: "SOP-013 verification schedule documented (9 activities with owners and target months)" },
    { ref: "2.5.3.1–2", text: "CAPA procedure documented; root cause and resolution records maintained", mandatory: true, docStatus: "ready", note: "SOP-014 generated; FRM-014 and FRM-014a in FRM-CAPA-Complaints-NC xlsx — ready to use" },
    { ref: "2.5.4.1–4", text: "Internal audit annual; trained auditors; site inspections planned and recorded", mandatory: true, docStatus: "pending", note: "SOP-015 generated; FRM-015 (34-clause checklist) in Traceability xlsx — auditor training still needed" },
  ]},
  { category: "Traceability, Recall & Crisis", items: [
    { ref: "2.6.1", text: "Product identification system covers all stages; changeover inspections documented", mandatory: true, docStatus: "ready", note: "SOP-016 generated — confirm lot coding system with Mike Matroka" },
    { ref: "2.6.2.1", text: "Traceability one step forward + one step back; annual trace test completed", mandatory: true, docStatus: "pending", note: "SOP-016 generated; FRM-016d in Traceability xlsx — first trace test target: August" },
    { ref: "2.6.3.1–4", text: "Recall procedure documented; annual mock recall completed; SQFI notified within 24 hrs for public events", mandatory: true, docStatus: "pending", note: "SOP-017 generated; FRM-017a in Traceability xlsx — first mock recall target: August" },
    { ref: "2.6.4.1–2", text: "Crisis management plan documented; annual review/test completed", mandatory: false, docStatus: "ready", note: "SOP-018 generated — adopts BRP-2.0r2/BIA-2.0r2/DR-2.0r2 which already carry annual test cadence" },
  ]},
  { category: "Food Defense & Food Fraud", items: [
    { ref: "2.7.1.1–4", text: "Food defense threat assessment completed and signed; plan tested annually", mandatory: true, docStatus: "pending", note: "SOP-019 generated with 7-point assessment table — Darrin Blackburn must sign and date it. Food defense training not yet delivered." },
    { ref: "2.7.2.1–4", text: "Food fraud vulnerability assessment completed; mitigation plan in place", mandatory: true, docStatus: "pending", note: "SOP-020 generated with 5-row assessment table — Darrin Blackburn must review and sign. Confirm ink/coating supplier list." },
  ]},
  { category: "Allergen Management", items: [
    { ref: "2.8.1.1", text: "Allergen risk analysis completed; allergen list by country maintained", mandatory: true, docStatus: "pending", note: "SOP-021 generated with Big-9 table — confirm wheat/soy status from current COAs before signing" },
    { ref: "2.8.1.2", text: "Staff trained on allergen identification, handling, and segregation", mandatory: true, docStatus: "gap", note: "FRM-022b shows all relevant staff as Required — Pending. Training delivery needed." },
    { ref: "2.8.1.3", text: "Non-allergen site: introduced allergen mitigation plan in place", mandatory: true, docStatus: "ready", note: "SOP-021 mitigation plan covers this directly" },
  ]},
  { category: "Training", items: [
    { ref: "2.9.1.1–2", text: "Training needs defined by role; competency requirements documented", mandatory: false, docStatus: "ready", note: "SOP-022 generated; FRM-022b pre-filled matrix in Training xlsx" },
    { ref: "2.9.2.1", text: "Training program covers all 9 topic areas; refresher provisions included", mandatory: true, docStatus: "ready", note: "SOP-022 covers all 9 SQF-required training topics" },
    { ref: "2.9.2.2", text: "Training materials available in all staff languages", mandatory: true, docStatus: "pending", note: "Currently English only. Confirm no non-English-speaking staff with Suzanne Alvarez." },
    { ref: "2.9.2.3", text: "Training records complete: name, skill, description, date, trainer, competency verification", mandatory: true, docStatus: "gap", note: "FRM-022a template ready in Training xlsx — no training delivered yet. ⚠️ Priority 1 action before audit." },
  ]},
  { category: "Module 13 — GMP (Facilities & Operations)", items: [
    { ref: "13.1.1", text: "Site location risk assessment completed and approved by authority", mandatory: false, docStatus: "gap", note: "M13-001 generated — FRM-M13-001a (location risk assessment) must be completed on site" },
    { ref: "13.1.2", text: "Floors, walls, ceilings, doors, drains inspected and compliant", mandatory: false, docStatus: "gap", note: "M13-001 generated — physical facility inspection (FRM-M13-001b) needed" },
    { ref: "13.1.3", text: "Lighting adequate and shatterproof in production/storage areas", mandatory: false, docStatus: "gap", note: "Physical verification required — part of FRM-M13-001b inspection" },
    { ref: "13.1.4", text: "Pest and dust proofing on all external openings verified", mandatory: false, docStatus: "gap", note: "Physical verification required" },
    { ref: "13.1.5–6", text: "Adequate ventilation; equipment specs documented; food-safe contact surfaces", mandatory: false, docStatus: "gap", note: "Equipment spec compilation needed (SOP-004 / Mike Matroka)" },
    { ref: "13.2.1", text: "Maintenance schedule in place; failures documented; food-grade lubricants used", mandatory: false, docStatus: "pending", note: "M13-002 generated — FRM-M13-002a must be populated with all equipment and intervals" },
    { ref: "13.2.2", text: "Maintenance contractors trained in food safety; tools/debris removed post-work", mandatory: false, docStatus: "gap", note: "Contractor induction process in M13-002 — current contractors not yet inducted" },
    { ref: "13.2.3", text: "Calibration register maintained; equipment calibrated to national standards", mandatory: false, docStatus: "pending", note: "M13-003 generated; FRM-M13-003a in GMP Ops xlsx — instrument inventory needed" },
    { ref: "13.2.4", text: "Pest prevention program implemented; contractor licensed; records maintained", mandatory: false, docStatus: "pending", note: "M13-004 generated; FRM-M13-004b in GMP Ops xlsx — PCO contractor must be engaged" },
    { ref: "13.2.5", text: "Cleaning and sanitation schedule documented; pre-op inspections conducted", mandatory: false, docStatus: "pending", note: "M13-005 generated — FRM-M13-005a must be populated with actual chemicals and responsible persons" },
    { ref: "13.3.1–4", text: "Illness exclusion, handwashing, clothing, jewelry, and visitor policies in place", mandatory: false, docStatus: "ready", note: "M13-006 generated and ready to enforce" },
    { ref: "13.3.5", text: "Staff amenities (toilets, break rooms, change areas) compliant and documented", mandatory: false, docStatus: "gap", note: "Physical verification of handwashing stations and amenity compliance still needed" },
    { ref: "13.4", text: "Personnel processing practices (entry/exit, door control, waste, eating/drinking) enforced", mandatory: false, docStatus: "ready", note: "M13-007 generated — largely satisfied by existing PHYS-2.0r2/ACP-2.0r2" },
    { ref: "13.5", text: "Potable water tested annually; compressed air/gas quality monitored annually", mandatory: false, docStatus: "pending", note: "M13-008 generated — annual water test not yet scheduled. Engage accredited lab." },
    { ref: "13.6.1", text: "Storage plan and stock rotation procedure in place", mandatory: false, docStatus: "ready", note: "M13-009 generated" },
    { ref: "13.6.2", text: "Chemical register, SDS, locked storage, trained handlers, spill kit confirmed", mandatory: false, docStatus: "pending", note: "M13-010 generated; FRM-M13-010a in GMP Ops xlsx — site walk to compile chemical inventory needed" },
    { ref: "13.6.3", text: "Vehicle inspection before loading; tamper-evident sealing in place", mandatory: false, docStatus: "ready", note: "M13-011 generated" },
    { ref: "13.7", text: "Glass inventory compiled; knife controls in place; breakage response procedure posted", mandatory: false, docStatus: "pending", note: "M13-012 generated — FRM-M13-012a glass/brittle-plastic site survey still needed" },
    { ref: "13.8", text: "Waste segregation, trademarked packaging destruction, hazardous disposal procedures in place", mandatory: false, docStatus: "ready", note: "M13-013 generated" },
  ]},
];

// Overview tab content (ported verbatim from the source viewer's hardcoded arrays)

export const openItemsBeforeAudit: { n: string; title: string; desc: string }[] = [
  { n: "1", title: "Training delivery", desc: "No food-safety training has been delivered or recorded. FRM-022b shows all staff as 'Required — Pending'. This is the most frequently pulled evidence in a SQF audit." },
  { n: "2", title: "HACCP Team floor walk", desc: "SOP-008 framework is drafted. The HACCP Team (Suzanne, Darrin, Denise, Lee) must walk each production line, verify flow diagrams, and complete FRM-008a hazard analysis worksheets for Folded Carton, Flexible Packaging, and Commercial Offset." },
  { n: "3", title: "HACCP training confirmation", desc: "Darrin Blackburn and Suzanne Alvarez must confirm formal HACCP certification before the audit. Untrained SQF Practitioner is a common Major finding." },
  { n: "4", title: "Approved Supplier List", desc: "FRM-005b in FRM-Supplier-Specs-Legislation xlsx must be populated with all current suppliers. Shayla Smith to compile." },
  { n: "5", title: "Populate registers", desc: "Chemical Register (FRM-M13-010a), Calibration Register (FRM-M13-003a), and Specification Master List (FRM-004b) all need site-walk data populated." },
  { n: "6", title: "PCO contractor", desc: "Licensed pest control contractor must be named and contracted (M13-004). Insert name in SOP document." },
  { n: "7", title: "Sign off assessments", desc: "Food Defense threat assessment (SOP-019) and Food Fraud vulnerability assessment (SOP-020) have tables drafted in the documents — Darrin Blackburn must sign and date each." },
  { n: "8", title: "POL-001 signature and posting", desc: "Food Safety Policy Statement needs physical signature from Suzanne Alvarez and posting at facility entry, break room, and production floor." },
];

export const executionTimeline: { month: string; actions: string }[] = [
  { month: "July 2026", actions: "Deliver first round of food-safety training (GMP, HACCP awareness, food defense) · Get HACCP certs scheduled for Darrin and Suzanne · Populate Approved Supplier List and Chemical Register" },
  { month: "August 2026", actions: "HACCP Team floor walk and flow diagram verification · Complete hazard analysis worksheets (FRM-008a/b) for all 3 product groups · Run annual trace test (FRM-016d) · Run first mock recall (FRM-017a)" },
  { month: "September 2026", actions: "First internal audit (FRM-015 checklist) · Sign and date Food Defense and Food Fraud assessments · Post and sign Food Safety Policy Statement · Engage PCO contractor" },
  { month: "October 2026", actions: "First management review (POL-002) · Complete CCP critical limit validation studies (FRM-013a) · Annual HACCP plan review" },
];

// Display metadata

export const CD_CAT_LABELS: Record<CdPolicy["cat"], string> = {
  IT_GOV: "IT & Governance",
  RISK: "Risk & Continuity",
  DATA: "Data & Privacy",
  OPS: "Physical & Ops",
};

export const GAP_LABELS: Record<GapStatus, string> = {
  new: "Newly Drafted",
  partial: "Drafted — C&D Cross-Ref",
  "cross-ref": "Strong C&D Cross-Ref",
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  ready: "Ready",
  pending: "Doc Drafted — Evidence Pending",
  gap: "Action Needed",
};

export function findCdPolicy(id: string): CdPolicy | undefined {
  return cdPolicies.find((p) => p.id === id);
}

export function checklistItemKey(category: string, ref: string): string {
  return `${category}-${ref}`;
}
