# C&D Packaging

Packaging Production Tracking for C&D Printing (cndprinting.com).

Track packaging jobs from quote through delivery. Internal staff manage production workflows; customers log in to see their order status, approve proofs, and track shipments.

## Quick Start

```bash
npm install
npm run dev -- -p 3001
```

Visit http://localhost:3001. Runs with demo data (25 jobs, 5 customers) without a database.

### Demo Credentials

| Email | Password | Role |
|---|---|---|
| admin@cndpackaging.com | demo123 | Admin |
| mike@cndpackaging.com | demo123 | Production Manager |
| tom@freshfoods.com | demo123 | Customer |

## Workflow Stages

Quote > Artwork > Structural Design > Proofing > Approval > Prepress > Plating > Materials > Scheduled > Printing > Coating > Die Cutting > Gluing > QA > Packed > Shipped > Delivered > Invoiced

## App Areas

- **Internal Dashboard** (`/dashboard`) - KPIs, jobs, orders, schedule, inventory, proofing, production, QA, shipping, customers, reports
- **Customer Portal** (`/portal`) - order tracking, proof approvals, shipments, documents
