# Flyleaf Project Guide

## Project Snapshot
- **Goal**: Build a polished web service that helps people design coordinated book-spine covers from a single piece of artwork and export press-ready PDFs.
- **Deployment Target**: Eventually Dockerized, but all development and testing for now happens locally on macOS without containers.
- **Primary Users**
  - *Sellers/Designers*: Upload artwork, configure multi-book layouts, price designs, and manage listings.
  - *Admins*: Define allowable page sizes, price rules, and base fees.
  - *Customers*: Preview designs, customize spine layouts, save/reorder projects, and purchase printable PDFs.

## Tech & Framework Preferences
- **Runtime**: TypeScript/JavaScript.
- **Suggested Web Framework**: Next.js (App Router) with React for the customer-facing designer and seller/admin dashboards. It delivers SSR for SEO, file-based routing, and a simple path to integrate Shopify later via API routes.
- **Backend Services**: Implement API routes with Next.js or extract a lightweight Node.js (Express/Fastify) service if separation is needed. Keep the door open for a Python microservice dedicated to advanced PDF layout if that becomes advantageous.
- **State & Persistence**: Start with PostgreSQL (via Prisma ORM) for designs, books, pricing tables, and user accounts. SQLite is acceptable for the very first prototype, but plan a migration path.
- **PDF Generation**: Consider a headless Chromium renderer (Playwright/Puppeteer) against a dedicated PDF template. If precision requirements tighten, evaluate a specialized tool such as WeasyPrint via a Python sidecar service.
- **UI Layer**: Elevate visuals beyond the wireframes using a component library like Chakra UI or Tailwind CSS + Radix primitives.

## Core Features to Support (Buyer & Preview Experience)
1. **Book Stack Preview Controls**
   - Adjustable book border color so spine outlines stay visible against any artwork.
   - Orientation toggle (future enhancement) and alignment controls that unlock only when vertical orientation is chosen.
   - **Recenter control** resets the artwork to center vertically on the tallest book and horizontally on the total spine width plus every fixed 2 mm gap.
   - Design positioning (up/down/left/right) with minimum clearances: ≥2 mm above the tallest book, alignable with the base, and ≥2 cm beyond both outer edges.
   - Design zoom in/out respects clearance rules. When books are added, the design quietly auto-zooms out just enough to keep the clearances intact—no status message required.
   - Gaps between books are always 2 mm in both preview and output; customers cannot adjust them. Admins can change the global gap later if print alignment needs tuning.
   - Shared font list and color picker for both large and small text (future split is optional).
   - Friendly warning when artwork breaks the full-cover clearance. Offer to switch to "spine only" mode; if declined, revert to the last safe zoom.
   - Large/small text box sizing, positioning, and validation so text never leaves the combined spine area or exceeds the shortest book height. If a user exceeds the limits, block the action with an explanation rather than auto-trimming.
   - Example layout from the stakeholder: four books at 23.5 cm height with spine widths of 4.25 cm, 4 cm, 4.75 cm, and 2.25 cm, centered on the sheet with top/bottom fold guides shown in green. Use this sample to validate spacing math (2 mm gaps, ≥2 cm left/right clearance, ≥2 mm top clearance).
2. **Text Content Options**
   - Large text up to ~500 characters (exact cap still to be confirmed) that must differ from auto-filled book titles when the seller disables that feature.
   - Small text modes: custom free text, auto book titles, Roman numerals, simple numbering, or no text at all. Seller-configured toggles dictate which options appear.
   - Large text extends 2 cm onto the covers for repeating/non-repeating designs whenever cover coverage is allowed.
3. **Book Data Entry**
   - Buyers provide ISBN (13 digits, digits only), spine width, height (≤26 cm), and cover length per book.
   - If ISBN lookup fails, leave the title blank (no error message required).
   - Collection width equals the sum of spine widths plus 2 mm gaps between every pair of books. Always draw the 2 mm gaps in mockups even if the final PDF omits visible separators.
   - Support adding/removing books dynamically. Deleting a book removes it permanently (no undo). Adding a book keeps at least one default entry so price calculations never see zero books.
   - Show inline warning messages (with explanations) for validation issues rather than silently blocking navigation.
4. **Mockup & Output**
   - Live mockup shows transparent spine overlays, large text, small text, fold guides, watermark, and lightly grayed artwork portions that will not appear on spines.
   - Watermark should always read "SAMPLE" in the mockup and preview PDFs until requirements change.
   - Fold guides match the spine edges and are drawn in green (future customization optional). Keep the mockup clean—no rulers unless future requests change this.
   - Preview shows every spine (Book 1, Book 2, …) side by side. When a buyer switches designs in a collection, update the corresponding spine immediately in the lineup while also showing the PDF preview with watermark further down the page.
   - Generate an 11×17 in (28 lb color) printable PDF that conforms to the smallest paper size capable of accommodating the tallest/widest book in the order. Fold guides and 2 cm cover continuation must be precise.
   - Reserve space for the order number in the top-left corner of each PDF page for now.

## Seller & Admin Tools
1. **Seller Dashboard**
   - Tabular view with preview image, design title, views, favorites, orders, and revenue with selectable time frames (today, week, month, year, all time).
   - Quick action to create a new design and manage existing listings.
2. **Design Authoring Flow**
   - Collect title (≤100 characters), listing photos (primary + supplementary), tags (≤20, no auto-suggestions yet), and feature toggles (custom text, book titles, Roman numerals, numbers, large text).
   - Upload assets per book depending on design type: repeating/non-repeating share a single spine upload, individual designs allow per-book spine assets.
   - Mandatory uploads (e.g., spine artwork) must be present before publishing. Allow drafts only when all required files exist.
   - Validate uploaded image resolution so each file meets minimum pixel requirements before saving.
   - Optional collection checkbox unlocks per-book design selection for buyers.
   - Provide background color selection (eye-dropper style) for pages/flaps until dedicated flap uploads exist.
3. **Pricing & Fees**
   - Admin sets base price per order, packaging price, and per-page price per supported page size.
   - Sellers define their own base and per-page fees; buyer-facing price = admin base fee + seller base fee + (page count × (admin page price + admin packaging price + seller page fee)).
   - Estimate calculator lets sellers input anticipated book counts to see pricing across page sizes. Ensure at least one book is always present when computing estimates.
   - When computing page counts, ensure the final PDF surfaces the smallest supported paper size that fits the tallest height and total cover length of the submitted books. Reference the stakeholder sample order when validating.
4. **Admin Settings**
   - Manage page size chart (height/length ranges, page dimensions) and ensure orders auto-select the smallest possible page size that fits the tallest/widest book.
   - Maintain page pricing chart and base fees. Orders already placed retain their original pricing; unpublished designs should adopt updated fees immediately.

## Customer Accounts & Project Lifecycle
- Manual "Save my stack" button for now. Prompt users to save if they attempt to navigate away with unsaved changes. Autosave can arrive later.
- Saved designs require a user-provided name (no automatic cute names at this stage).
- Reorders reopen the saved design for editing. If the seller has updated the underlying artwork since the last order, notify the buyer and guide them into a new order flow for the updated design.
- Version/audit tracking for seller edits is a future enhancement.

## Future Integrations & Enhancements
- Shopify integration for payment processing and order management once pricing rules are stable.
- Optional roadmap items: book orientation and alignment toggles, flap uploads, enhanced mockup backgrounds, deeper ISBN auto-fill, adjustable fold-guide styling, audit logs, autosave, reorder shortcuts, and customizable watermark text.

## Data & Validation Rules (Grounded in Excel Notes & Clarifications)
- **Geometry & Clearances**: Maintain 2 mm gaps between spines and enforce top (≥2 mm) and side (≥2 cm) artwork clearances. Large text box width cannot exceed total collection width; height cannot exceed the shortest book.
- **Book Inputs**: ISBN must be a 13-digit numeric string. Heights ≤26 cm. Cover length ≤(44 cm − spine width)/2 per book.
- **Collections**: Track collection width (sum of spine widths + gaps). Design selection dropdown appears when a collection is enabled. Swapping designs updates the relevant spine preview immediately.
- **Text Boxes**: Small text boxes auto-fit each spine width and remain within the shortest book height. Large text box positioning must stay within combined spine boundaries.
- **Pricing Formula**: Display price = admin base fee + seller base fee + (page count × (admin page price + admin packaging price + seller page fee)).
- **Mockup Metadata**: Include "SAMPLE" watermark overlay, fold guides derived from spine outlines, and order number placeholders on printable outputs. Show 2 mm gaps visually in mockups even if the PDF prints a seamless design.
- **Reference Rendering**: The stakeholder-provided mockup shows top and bottom fold guides (green lines) aligned with spine edges, while the artwork continues past the guides. Replicate this behavior in both the live preview and PDF output.

## Implementation Phases
1. **Discovery & Requirements Clarification**
   - Confirm data model fields for books, designs, pricing, admin settings, and Shopify integration touchpoints.
   - Document PDF layout specs that mirror the manually created example.
2. **Prototype**
   - Build a minimal Next.js app with an interactive canvas/SVG preview, manual design upload, and JSON-backed mock data.
   - Stub PDF generation with placeholder output sized to 11×17 in pages.
3. **Iterate on Business Logic**
   - Implement rule validations based on the Excel sheet (clearances, sizing caps, pricing math).
   - Flesh out admin dashboards, seller management views, and mockup fidelity.
4. **Finalize & Polish**
   - Elevate UI styling beyond the wireframes, including tooltips to guide new users.
   - Integrate the full PDF pipeline and Shopify hand-off.
   - Add authentication/authorization for admins vs. sellers vs. buyers when ready.

## Collaboration Guidelines
- Write clear docstrings and inline comments explaining geometry calculations (spine positioning, scaling, etc.).
- Keep functions small and well-named; prefer pure computations for layout math for easier testing.
- Include unit/integration tests for pricing formulas, geometry conversions, and PDF generation rules where feasible.
- Document manual QA steps for the preview canvas and PDF exports.

## Outstanding Questions for Stakeholder
1. Please confirm the final character limit for large text (placeholder 500) and whether we need per-design overrides.
2. Do we need any PDF requirements beyond 11×17 in, 28 lb color paper (for example, target DPI or color profile guidance)?
3. When should Shopify integration for payments and orders begin (initial MVP vs. later milestone)?
4. For centered layouts, should we ever allow sellers to offset the entire spine block relative to the sheet (e.g., more top margin) or keep it fixed?
5. Do we still need a first-time helper/tutorial inside the designer, or is that a later enhancement?
6. Are there minimum pixel dimensions we should enforce for uploaded artwork beyond the resolution check already noted (e.g., 300 DPI at final print size)?

## Friendly Follow-Up Questions (explained like you’re five)
1. Is the pretend big-text limit of 500 letters okay, or should we count more (or fewer) letters before we say "too much"?
2. When we print on the 11×17 paper, do we need to worry about super-sharp pictures (like a special DPI number), or is "looks nice" good enough for now?
3. Do you want the store buddy, Shopify, to join our game right away, or can we invite them after we build the playground?
4. If we make a helper tour that shows where the buttons are, should it pop up the very first time someone plays, or do we wait until later?
5. For the pictures you upload, should we tell you the smallest width/height in pixels they must be so they print nicely?

## Plain-Language Notes for the Stakeholder
- The recommendation has shifted from Python to a Next.js/TypeScript stack for a smoother web experience and direct Shopify integration. We can still bolt on a Python microservice later if PDF logic demands it.
- Printing targets standard 11×17 in pages on regular 28 lb color paper—no bleed or specialty ink requirements noted.
- Saving uses a simple button for now, paired with a "don’t forget to save" prompt if you try to leave. Autosave can come later.
- Reorders will reopen previous designs for editing, but if a seller changes artwork, we’ll gently warn the buyer and guide them through a fresh order.
- Shopify will handle money and fulfillment once the pricing engine is reliable.
- Still happy to review a PDF example—if direct upload is blocked, sharing key measurements or screenshots will help us mimic the layout precisely.

