# Local Shore Delivery Partner Hub

Local Shore Delivery Partner Hub is the delivery-operations app for the LocalShoree marketplace. Delivery partners use it to register, work online, accept and complete deliveries, share live location, manage documents, and review earnings. It also includes vendor dispatch and delivery-admin operations.

> This app shares one Supabase project with \`ShorelineShopper\` and \`SellerHub\`. It is not an isolated database application.

## Contents

- [Features](#features)
- [Roles and routes](#roles-and-routes)
- [Delivery lifecycle](#delivery-lifecycle)
- [Live location](#live-location)
- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Shared database and migrations](#shared-database-and-migrations)
- [Storage](#storage)
- [Commands](#commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security and contribution notes](#security-and-contribution-notes)

## Features

### Delivery partners

- Sign up and sign in.
- Complete a multi-step profile covering identity, address, vehicle, bank, and operating zones.
- Upload or replace verification documents.
- Go online/offline after admin approval.
- Receive a timed delivery request, then accept or reject it.
- View pickup/drop information, map previews, and external navigation links.
- Progress through pickup, delivery, OTP/photo proof, and completion.
- See active/history deliveries, earnings, and payouts.

### Vendors

- View their recent orders.
- Mark eligible orders ready for pickup.
- Dispatch or re-broadcast a delivery request to nearby eligible partners.

### Delivery administrators

- Review partner applications and documents.
- Approve, reject, suspend, or request more information.
- Monitor active deliveries.
- Review and mark payouts as paid.

## Roles and routes

| Route | Audience | Purpose |
| --- | --- | --- |
| \`/\` | Everyone | Landing and onboarding entry point. |
| \`/auth\` | Partners | Sign in or create an account. |
| \`/register\` | Partners | Complete or update partner registration. |
| \`/partner\` | Partners | Dashboard, availability switch, and incoming delivery requests. |
| \`/partner/deliveries\` | Partners | Active delivery workflow, route, proof, and history. |
| \`/partner/earnings\` | Partners | Earnings ledger and payout history. |
| \`/partner/documents\` | Partners | Document uploads and verification state. |
| \`/vendor\` | Vendor users | Ready orders and delivery dispatch. |
| \`/admin\` | Admin users | Partner, document, delivery, and payout operations. |

Route visibility is a convenience only. Supabase Row Level Security (RLS) policies and authenticated RPCs are the access-control boundary.

## Delivery lifecycle

~~~text
Customer places an order
  → Vendor prepares it and marks it ready for pickup
  → Backend selects a nearby eligible online partner
  → Partner receives a timed request
  → Partner accepts
  → navigating_to_vendor
  → reached_vendor
  → picked_up
  → out_for_delivery
  → delivered
~~~

Rules enforced by the backend:

- A partner must be approved and online before they can receive a request.
- Only one active delivery can exist per partner.
- A request can expire, be rejected, or be accepted by another partner.
- The backend, not the UI, authorizes and commits acceptance, status changes, and completion.
- Completion requires either the correct customer OTP or a proof photo.
- An accepted partner becomes \`busy\`, but remains allowed to submit live location.

The important RPCs are \`accept_delivery_request\`, \`reject_delivery_request\`, \`advance_delivery_assignment\`, \`complete_delivery\`, and \`submit_partner_location\`.

## Live location

Location is used for partner dispatch, navigation origin, and assignment tracking.

1. Going online requests an immediate location.
2. A browser location watch continues while the partner is online or busy.
3. The app asks for a fresh position every 45 seconds as a fallback.
4. When **Accept** is pressed, the app saves a fresh position before it accepts the order.
5. It sends another update immediately after acceptance, linking the first tracking point to that assignment.
6. The delivery map uses the saved partner coordinates as its origin and the vendor/customer as its destination.

The app tries high-accuracy GPS first. If that times out, it retries with the browser/network provider. Invalid coordinates or unusable accuracy values are rejected/normalized before dispatch can use them.

### Device requirements

- Use HTTPS in deployed environments; geolocation is unavailable on ordinary HTTP except localhost.
- Allow location permission for the app domain.
- Keep device location services enabled.
- Prefer precise location on Android/iOS.
- Disable browser battery restrictions that prevent background location.
- Validate on a physical device. Desktop browsers often provide coarse or simulated positions.

If a fresh location cannot be saved, order acceptance pauses and tells the rider to enable permission, GPS, or connectivity. This prevents a delivery from being assigned with a stale previous-session location.

## Architecture

| Area | Implementation |
| --- | --- |
| Front end | React 19, TypeScript, Vite, TanStack Start/Router |
| UI | Tailwind CSS, Radix UI, Lucide, Sonner |
| Backend | Supabase Auth, Postgres, RLS, Realtime, Storage, RPCs |
| Maps | OpenStreetMap embeds and directions links |
| Deployment build | Cloudflare-compatible Nitro output |

~~~text
src/
  components/delivery/       Delivery shell, maps, statuses, statistics
  components/ui/             Shared UI primitives
  hooks/usePartner.ts        Session, partner, and admin access hooks
  integrations/supabase/     Browser/server clients and generated types
  lib/delivery.ts            Status flow, money, distance, map helpers
  lib/shared-orders.ts       Shared marketplace order normalization
  routes/                    Partner, vendor, and admin routes
  styles.css                 Global styles
~~~

Key files:

- \`src/routes/partner.tsx\`: availability, incoming requests, and continuous location submission.
- \`src/routes/partner.deliveries.tsx\`: delivery steps and OTP/photo completion.
- \`src/routes/vendor.tsx\`: seller ready/dispatch workflow.
- \`src/routes/admin.tsx\`: approval, document review, monitoring, and payouts.
- \`src/lib/delivery.ts\`: client-side delivery flow helpers; RPCs remain authoritative.

## Setup

### Prerequisites

- Node.js 20+ (current LTS recommended).
- npm.
- Access to the shared LocalShoree Supabase project.
- For backend changes, a sibling checkout of \`SellerHub\`.

### Start locally

1. Install packages:

   ~~~bash
   npm install
   ~~~

2. Create \`.env\` using the values in the next section. Use the same Supabase project as \`ShorelineShopper\` and \`SellerHub\`.

3. Start development:

   ~~~bash
   npm run dev
   ~~~

4. Open the Vite URL. \`localhost\` can use browser geolocation without HTTPS.

5. Use accounts with the correct role. A partner cannot go online until approved by an admin.

## Environment variables

Never commit real credentials or a service-role key.

| Variable | Required | Description |
| --- | --- | --- |
| \`VITE_SUPABASE_URL\` | Yes | Shared Supabase URL used by the browser. |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Yes | Shared Supabase publishable/anon key used by the browser. |
| \`VITE_SUPABASE_PROJECT_ID\` | Recommended | Shared project ID for tooling. |
| \`SUPABASE_URL\` | Server use | Same URL without the \`VITE_\` prefix. |
| \`SUPABASE_PUBLISHABLE_KEY\` | Server use | Same publishable key without the \`VITE_\` prefix. |
| \`SUPABASE_PROJECT_ID\` | Recommended | Same project ID without the \`VITE_\` prefix. |

Example placeholders:

~~~dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_PROJECT_ID=your-project-id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_PROJECT_ID=your-project-id
~~~

Never put a Supabase \`service_role\` key in a \`VITE_*\` value.

## Shared database and migrations

### Source of truth

The shared delivery backend is maintained in:

~~~text
../SellerHub/supabase/migrations/
~~~

Begin with \`20260801090000_delivery_partner_shared_integration.sql\`, then apply later delivery migrations in timestamp order. They define delivery tables, RLS, storage policies, dispatch, acceptance, location updates, status transitions, completion, and Realtime.

### Critical warning

Do **not** run the old full-schema migrations under this repository's \`supabase/migrations/\` directory against the shared production project. They belong to the earlier standalone prototype and can conflict with the marketplace schema.

For backend work:

1. Add an additive timestamped migration in \`SellerHub/supabase/migrations/\`.
2. Prefer idempotent SQL where practical.
3. Apply and validate it in staging first.
4. Test partner, vendor, and admin roles under RLS.
5. Apply through the team's approved Supabase migration process.
6. Update/regenerate Supabase types if an RPC signature or schema changes.

### Core entities

| Entity | Responsibility |
| --- | --- |
| \`delivery_partners\` | Profile, approval, availability, current location, and performance totals. |
| \`delivery_documents\` | Verification documents and review state. |
| \`delivery_assignments\` | Requests and active delivery state. |
| \`delivery_tracking\` | Status timeline events. |
| \`delivery_locations\` | Time-stamped location points, optionally tied to an assignment. |
| \`delivery_earnings\` | Completed-delivery earnings ledger. |
| \`delivery_payouts\` | Settlement records. |
| \`delivery_notifications\` | Partner notifications. |
| \`orders\` | Shared marketplace orders, delivery coordinates, and assigned partner. |

## Storage

The private \`delivery-docs\` Supabase bucket stores partner documents and delivery proof photos.

- Paths are namespaced by authenticated user ID.
- Partner documents accept images and PDFs.
- Delivery proof accepts images and can replace OTP entry.
- Admin previews use short-lived signed URLs.
- Do not make the bucket public to simplify previews; preserve the shared storage policies.

## Commands

| Command | Purpose |
| --- | --- |
| \`npm run dev\` | Start development server. |
| \`npm run build\` | Build production client/server artifacts. |
| \`npm run build:dev\` | Build in Vite development mode. |
| \`npm run preview\` | Preview a completed build. |
| \`npm run lint\` | Run ESLint. |
| \`npm run format\` | Format the repository with Prettier. Review its full diff before committing. |

Before handoff, run:

~~~bash
npm run build
git diff --check
~~~

## Testing

### Registration and documents

- [ ] New user can register through every step.
- [ ] Incomplete registrations resume correctly.
- [ ] Unapproved partners cannot go online.
- [ ] Admin can approve/reject/request information/suspend.
- [ ] Documents upload, replace, sign, and review correctly.
- [ ] Bicycle partners are not required to add licence, RC, or insurance.

### Location and dispatch

- [ ] On a physical HTTPS device, going online prompts for and stores location.
- [ ] Denial, timeout, unavailable location, and network failure show useful errors.
- [ ] An eligible partner with fresh coordinates receives a ready order.
- [ ] Vendor dispatch works and a request is visible to the selected partner.
- [ ] Dismiss/reject/expiry/another partner accepting removes the request.

### Acceptance and delivery

- [ ] Accept saves a fresh location before assignment.
- [ ] After acceptance the partner is busy and cannot receive another active request.
- [ ] A post-accept location point is tied to the assignment.
- [ ] Pickup navigation targets vendor; post-pickup navigation targets customer.
- [ ] Status can advance only in order.
- [ ] Delivery completes with either correct OTP or proof photo.
- [ ] A completed delivery creates one earning record, including a retry.

### Operations

- [ ] Dashboard, history, earnings, and payout figures refresh correctly.
- [ ] Only admins reach \`/admin\`; vendors only act on their own orders.
- [ ] Build succeeds: \`npm run build\`.

## Deployment

1. Confirm the required shared SellerHub migrations are applied to the target Supabase project.
2. Add the environment variables to the hosting provider.
3. Run \`npm run build\`.
4. Deploy using the team's approved Cloudflare/Nitro workflow.
5. After deployment, test sign-in, one real-device location update, one complete delivery, document upload, and admin access.

Production location requires HTTPS. Use labeled test accounts/orders in staging whenever possible.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot turn online | Partner approval status, RLS update response, and session role. |
| No delivery request | Permission, fresh \`location_updated_at\`, availability, eligible order, assignment expiry, and dispatch result. |
| Accept shows location error | HTTPS, permission, device GPS, connectivity, and \`submit_partner_location\` RPC response. |
| Route begins in wrong place | Fresh accept-location update, stored partner latitude/longitude, and precise-location setting. |
| Tracking stops after acceptance | Browser background/battery limits, location permission, \`busy\` availability support, and current shared location migration. |
| Vendor cannot dispatch | Seller ownership, order status, eligible partners, and dispatch RPC output. |
| Status will not progress | Assignment ownership, current state, and \`advance_delivery_assignment\` error. |
| Completion fails | OTP, proof upload, private bucket policy, and assignment state. |
| Admin sees no data | \`user_roles\`, RLS policies, and Realtime configuration. |

For production diagnosis, record route, authenticated role, order ID, assignment ID, timestamp, console error, and RPC/network response. Never include secrets, tokens, OTPs, identity/bank numbers, customer phone numbers, or raw location history in tickets.

## Security and contribution notes

- Keep authorization in RLS policies and security-definer RPCs; UI checks are not security controls.
- Treat location, contact, documents, bank information, and identity data as sensitive.
- Use short-lived signed URLs for private files.
- Do not log credentials, tokens, OTPs, identity numbers, bank data, or raw tracking history.
- Review RLS whenever changing a table, role, or RPC.
- This is a Lovable-connected project: never force-push, rebase, amend, or squash already-pushed history.
- Keep feature changes focused and preserve unrelated user changes.
- For backend changes, update the shared SellerHub migration source rather than the standalone migrations here.
- In a pull request, include role/RLS impact, migration steps, and tests performed.
