// Default Australian Tender Template
// Professional tender document template with variable support

export interface TenderTemplate {
  id: string;
  name: string;
  sections: TenderSection[];
}

export interface TenderSection {
  title: string;
  content: string;
  order: number;
  variables: string[]; // e.g., {project_name}, {client_name}
}

export const DEFAULT_TENDER_TEMPLATE: TenderTemplate = {
  id: "default-australian-tender",
  name: "Standard Australian Construction Tender",
  sections: [
    {
      title: "Cover Page",
      content: `# CONSTRUCTION TENDER

**Project:** {project_name}
**Client:** {client_name}
**Site Address:** {site_address}
**Date:** {tender_date}
**Tender Number:** {tender_number}

---

**Submitted by:**
{company_name}
ABN: {company_abn}
{company_address}
{company_phone}

---

**Tender Valid Until:** {validity_date}`,
      order: 1,
      variables: ["project_name", "client_name", "site_address", "tender_date", "tender_number", "company_name", "company_abn", "company_address", "company_phone", "validity_date"]
    },
    {
      title: "Executive Summary",
      content: `## Executive Summary

We are pleased to submit this tender for **{project_name}** on behalf of {company_name}.

Our company has extensive experience in Australian construction, delivering quality projects on time and within budget. We have reviewed the project requirements and are confident in our ability to deliver exceptional results.

**Key Project Details:**
- **Project Name:** {project_name}
- **Client:** {client_name}
- **Location:** {site_address}
- **Estimated Contract Period:** {contract_period}
- **Proposed Start Date:** {start_date}

**Total Tender Price:** {total_price_formatted}
(Includes GST)

This tender is valid for **{validity_days} days** from the date of submission.`,
      order: 2,
      variables: ["project_name", "company_name", "client_name", "site_address", "contract_period", "start_date", "total_price_formatted", "validity_days"]
    },
    {
      title: "Project Scope",
      content: `## Project Scope

This tender covers the complete construction works as described in the project documentation, including but not limited to:

**Scope of Work:**
{scope_of_work_list}

**Standards and Compliance:**
All works will be carried out in accordance with:
- National Construction Code (NCC) 2025
- Australian Standards (AS)
- Local Council regulations and requirements
- Building Code of Australia (BCA)
- Relevant OH&S regulations

**Site Conditions:**
The contractor has inspected the site and is familiar with local conditions, access, and any constraints that may affect construction.`,
      order: 3,
      variables: ["scope_of_work_list"]
    },
    {
      title: "Detailed Pricing Schedule",
      content: `## Detailed Pricing Schedule

{pricing_table}

### Cost Summary

| Description | Amount (AUD) |
|------------|--------------|
| Materials | {total_materials} |
| Labour | {total_labour} |
| **Subtotal** | **{subtotal}** |
| Overheads ({overhead_percentage}%) | {overhead_amount} |
| Margin ({margin_percentage}%) | {margin_amount} |
| **Subtotal (ex GST)** | **{total_ex_gst}** |
| GST ({gst_percentage}%) | {gst_amount} |
| **TOTAL (inc GST)** | **{total_inc_gst}** |

All prices are in Australian Dollars (AUD) and include GST unless stated otherwise.`,
      order: 4,
      variables: ["pricing_table", "total_materials", "total_labour", "subtotal", "overhead_percentage", "overhead_amount", "margin_percentage", "margin_amount", "total_ex_gst", "gst_percentage", "gst_amount", "total_inc_gst"]
    },
    {
      title: "Inclusions",
      content: `## Inclusions

This tender includes the following:

{inclusions_list}

**Standard Inclusions:**
- All materials and labour as specified
- Site supervision and project management
- Public liability insurance (minimum $20,000,000)
- Workers compensation insurance
- Building permits and certifications (where applicable)
- Site cleanup and waste removal
- Warranties as per Australian Consumer Law`,
      order: 5,
      variables: ["inclusions_list"]
    },
    {
      title: "Exclusions",
      content: `## Exclusions

This tender **does not include**:

{exclusions_list}

**Standard Exclusions:**
- Any works not specifically mentioned in this tender
- Asbestos removal (if discovered)
- Unforeseen site conditions or contamination
- Council fees and charges (unless stated)
- Utility connection fees
- Landscaping (unless specified)
- White goods and appliances (unless specified)
- Additional works requested after contract signing

Any additional works will be quoted separately and require client approval before proceeding.`,
      order: 6,
      variables: ["exclusions_list"]
    },
    {
      title: "Payment Terms",
      content: `## Payment Terms

{payment_terms}

**Standard Payment Schedule:**

| Stage | Description | Payment | Timing |
|-------|-------------|---------|--------|
| 1 | Deposit | {deposit_percentage}% | On contract signing |
| 2 | Progress Payment | {progress_payment_percentage}% | At lock-up stage |
| 3 | Final Payment | {final_payment_percentage}% | On practical completion |

**Total:** 100% = {total_inc_gst}

**Payment Methods:**
- Electronic Funds Transfer (EFT) - preferred
- Bank cheque
- Direct deposit

**Payment Terms:**
- Payments are due within 7 days of invoice
- Progress claims will be submitted with supporting documentation
- Final payment due upon issue of Practical Completion Certificate`,
      order: 7,
      variables: ["payment_terms", "deposit_percentage", "progress_payment_percentage", "final_payment_percentage", "total_inc_gst"]
    },
    {
      title: "Project Timeline",
      content: `## Project Timeline

**Estimated Construction Period:** {contract_period}

**Proposed Milestones:**
- Commencement: {start_date}
- Frame Stage: {frame_date}
- Lock-up: {lockup_date}
- Fixing Stage: {fixing_date}
- Practical Completion: {completion_date}

**Working Days:**
- Standard working hours: Monday to Friday, 7:00 AM - 5:00 PM
- Saturday work by prior arrangement only
- No work on Sundays or public holidays (unless approved)

**Timeline Considerations:**
- Subject to weather conditions
- Subject to timely client approvals and selections
- Subject to timely supply of materials
- Subject to council approvals and inspections

Any variations or delays caused by client changes, unforeseen site conditions, or external factors may extend the construction period. We will provide regular updates on progress.`,
      order: 8,
      variables: ["contract_period", "start_date", "frame_date", "lockup_date", "fixing_date", "completion_date"]
    },
    {
      title: "Insurance & Licenses",
      content: `## Insurance & Licenses

{company_name} holds all necessary licenses and insurance required to undertake this project.

**Licenses:**
- Builder License Number: {builder_license}
- ABN: {company_abn}
- All tradespeople are licensed and qualified

**Insurance Coverage:**
- **Public Liability:** $20,000,000 minimum
- **Contract Works:** Full project value
- **Workers Compensation:** As required by law

Copies of insurance certificates and licenses are available upon request.

**OH&S Compliance:**
We maintain full compliance with:
- Work Health and Safety Act 2011
- SafeWork Australia guidelines
- State-specific safety regulations
- Site-specific safety management plans`,
      order: 9,
      variables: ["company_name", "builder_license", "company_abn"]
    },
    {
      title: "Terms & Conditions",
      content: `## Terms & Conditions

**1. Contract Basis**
This tender is subject to a formal construction contract being executed by both parties.

**2. Tender Validity**
This tender remains valid for {validity_days} days from {tender_date}.

**3. Price Validity**
Prices are based on current market rates. Significant material price increases may require price review if not accepted within validity period.

**4. Variations**
Any variations to the scope of work must be approved in writing before proceeding. Variation quotes will be provided within 5 business days.

**5. Warranties**
We provide standard warranties as required by Australian Consumer Law:
- Structural: 7 years
- Major defects: 6 years  
- Minor defects: 2 years

**6. Dispute Resolution**
Any disputes will be resolved through:
1. Good faith negotiation
2. Mediation (if required)
3. Arbitration or legal proceedings (as last resort)

**7. Site Access**
Client to provide clear site access during business hours.

**8. Permits and Approvals**
We will obtain necessary building permits (cost included). Client responsible for planning permits unless stated otherwise.

**9. Client Responsibilities**
- Timely decisions and selections
- Payment as per schedule
- Clear site access
- Approval of variations

**10. Force Majeure**
Neither party liable for delays due to acts of God, government restrictions, pandemics, natural disasters, or other events beyond reasonable control.`,
      order: 10,
      variables: ["validity_days", "tender_date"]
    },
    {
      title: "Acceptance",
      content: `## Tender Acceptance

To accept this tender, please sign below and return a copy with the deposit payment.

---

**Acceptance by Client:**

Client Name: _________________________________

Signature: _________________________________

Date: _________________________________

---

**Accepted by {company_name}:**

Authorized Signatory: _________________________________

Name: _________________________________

Position: _________________________________

Date: _________________________________

---

**Thank you for considering {company_name} for your construction project.**

We look forward to working with you to deliver a quality result.

For any questions or clarifications, please contact:

{company_name}
Phone: {company_phone}
Email: {company_email}
ABN: {company_abn}`,
      order: 11,
      variables: ["company_name", "company_phone", "company_email", "company_abn"]
    }
  ]
};

// Helper function to replace variables in template
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, String(value));
  });
  
  return result;
}

// Helper to extract all unique variables from a template
export function extractTemplateVariables(template: TenderTemplate): string[] {
  const variables = new Set<string>();
  
  template.sections.forEach(section => {
    section.variables.forEach(variable => variables.add(variable));
  });
  
  return Array.from(variables).sort();
}
