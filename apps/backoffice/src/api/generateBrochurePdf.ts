import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { ZitePdf } from 'zitejs/pdf';

export default createEndpoint({
  description: 'Generates a premium PDF brochure for Trove — each section on its own page',
  inputSchema: z.object({}),
  outputSchema: z.object({ url: z.string() }),
  execute: async () => {
    const year = new Date().getFullYear();

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; font-size: 9.5pt; line-height: 1.55; }

  /* ── Cover ── */
  .cover {
    width: 100%; height: 297mm; position: relative;
    background: linear-gradient(160deg, #061d0b 0%, #0d3318 35%, #165226 65%, #1a6030 100%);
    color: #fff; page-break-after: always;
  }
  .cover-bar { position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: #43a047; }
  .cover-hdr {
    position: absolute; top: 56px; left: 72px; right: 72px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .cover-logo { font-size: 20pt; font-weight: 800; letter-spacing: -0.04em; }
  .cover-conf { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.3); font-weight: 600; }
  .cover-body { position: absolute; bottom: 110px; left: 72px; right: 72px; }
  .cover-rule { width: 48px; height: 2px; background: #66bb6a; margin-bottom: 28px; }
  .cover h1 { font-size: 44pt; font-weight: 900; line-height: 1.06; letter-spacing: -0.03em; max-width: 480px; margin-bottom: 22px; }
  .cover h1 em { font-style: normal; color: #81c784; }
  .cover .lead { font-size: 11pt; color: rgba(255,255,255,0.5); line-height: 1.7; max-width: 420px; }
  .cover-ft {
    position: absolute; bottom: 44px; left: 72px; right: 72px;
    border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;
    display: flex; justify-content: space-between;
    font-size: 7.5pt; color: rgba(255,255,255,0.25); font-weight: 500;
  }

  /* ── Shared page ── */
  .page { padding: 56px 72px 48px; page-break-after: always; position: relative; min-height: 297mm; }
  .overline { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.22em; color: #2e7d32; font-weight: 700; margin-bottom: 10px; }
  h2 { font-size: 28pt; font-weight: 800; letter-spacing: -0.025em; line-height: 1.1; color: #111; margin-bottom: 10px; }
  .deck { font-size: 10pt; color: #666; line-height: 1.65; max-width: 440px; margin-bottom: 32px; }
  .pg-rule { width: 48px; height: 2px; background: #2e7d32; margin-bottom: 32px; }
  .pg-foot {
    position: absolute; bottom: 24px; left: 72px; right: 72px;
    display: flex; justify-content: space-between;
    font-size: 6.5pt; color: #bbb;
    border-top: 1px solid #eee; padding-top: 8px;
  }

  /* ── Products table ── */
  .prod-table { width: 100%; border-collapse: collapse; }
  .prod-table th {
    font-family: 'Inter', sans-serif; text-align: left; font-size: 7pt;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
    color: #999; border-bottom: 2px solid #111; padding: 0 0 6px;
  }
  .prod-table td {
    padding: 14px 16px 14px 0; border-bottom: 1px solid #eee;
    vertical-align: top; font-size: 8.5pt; color: #444; line-height: 1.5;
  }
  .prod-table td:first-child { width: 26%; }
  .prod-table td.name { font-size: 11pt; font-weight: 700; color: #111; line-height: 1.3; }
  .prod-table .sub { font-size: 7.5pt; color: #2e7d32; font-weight: 600; margin-top: 2px; }

  /* ── Process ── */
  .proc-row { display: grid; grid-template-columns: 60px 1fr; gap: 0; border-bottom: 1px solid #eee; padding: 18px 0; }
  .proc-row:first-child { border-top: 2px solid #111; }
  .proc-num { font-size: 24pt; font-weight: 900; color: #ddd; line-height: 1; }
  .proc-row h3 { font-size: 11.5pt; font-weight: 700; color: #111; margin-bottom: 4px; }
  .proc-row p { font-size: 8.5pt; color: #666; line-height: 1.55; }

  /* ── Audience ── */
  .aud-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 2px solid #111; }
  .aud-cell { padding: 22px 24px; border-bottom: 1px solid #eee; }
  .aud-cell:nth-child(odd) { border-right: 1px solid #eee; }
  .aud-cell h3 { font-size: 12pt; font-weight: 700; color: #111; margin-bottom: 6px; }
  .aud-cell p { font-size: 8.5pt; color: #666; line-height: 1.55; }

  /* ── Advantages ── */
  .adv-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border-top: 2px solid #111; }
  .adv-cell { padding: 18px 20px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; }
  .adv-cell:nth-child(3n) { border-right: none; }
  .adv-cell h4 { font-size: 10.5pt; font-weight: 700; color: #111; margin-bottom: 4px; }
  .adv-cell p { font-size: 7.5pt; color: #666; line-height: 1.5; }

  /* ── Key Figures ── */
  .figures { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0; border-top: 2px solid #111; border-bottom: 1px solid #eee; margin: 32px 0; }
  .fig { padding: 24px 18px; border-right: 1px solid #eee; }
  .fig:last-child { border-right: none; }
  .fig .val { font-size: 30pt; font-weight: 900; color: #0a1f12; letter-spacing: -0.03em; line-height: 1; }
  .fig .lbl { font-size: 7pt; color: #999; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }

  /* ── Back Cover ── */
  .back {
    width: 100%; height: 297mm;
    background: linear-gradient(160deg, #061d0b 0%, #0d3318 35%, #165226 65%, #1a6030 100%);
    color: #fff; display: flex; flex-direction: column;
    justify-content: center; align-items: center; text-align: center;
    padding: 72px; position: relative;
  }
  .back-bar { position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: #43a047; }
  .back-logo { font-size: 22pt; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 48px; }
  .back h2 { font-size: 32pt; font-weight: 800; max-width: 380px; margin-bottom: 16px; letter-spacing: -0.025em; line-height: 1.12; color: #fff; }
  .back .deck { font-size: 11pt; color: rgba(255,255,255,0.45); max-width: 360px; line-height: 1.7; margin-bottom: 36px; }
  .back .cta {
    display: inline-block; border: 1.5px solid rgba(255,255,255,0.25);
    color: #fff; font-weight: 600;
    font-size: 9.5pt; padding: 11px 30px; letter-spacing: 0.04em;
    text-decoration: none; text-transform: uppercase;
  }
  .back .contact-line {
    margin-top: 56px;
    font-size: 8.5pt; color: rgba(255,255,255,0.3); font-weight: 500;
    display: flex; gap: 28px;
  }
  .back .foot { position: absolute; bottom: 36px; font-size: 7pt; color: rgba(255,255,255,0.15); }
</style>
</head>
<body>

<!-- ═══ PAGE 1: COVER ═══ -->
<div class="cover">
  <div class="cover-bar"></div>
  <div class="cover-hdr">
    <div class="cover-logo"><svg viewBox="0 0 24 24" fill="none" style="width:22px;height:22px;vertical-align:middle;margin-right:8px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="white" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="white"/><path d="M3 7v10l9 5V12L3 7z" fill="white" opacity="0.7"/></svg>trove</div>
    <div class="cover-conf">Confidential</div>
  </div>
  <div class="cover-body">
    <div class="cover-rule"></div>
    <h1>Unlocking <em>working capital</em> for Africa</h1>
    <p class="lead">
      A trade finance platform connecting SMEs, anchor corporates, and financial
      institutions &mdash; turning invoices and trade assets into immediate liquidity.
    </p>
  </div>
  <div class="cover-ft">
    <span>contact.felixmwanza@gmail.com &nbsp;&middot;&nbsp; +254 702 719 701</span>
    <span>Nairobi, Kenya &nbsp;&middot;&nbsp; ${year}</span>
  </div>
</div>

<!-- ═══ PAGE 2: PRODUCTS ═══ -->
<div class="page">
  <div class="pg-rule"></div>
  <div class="overline">Product Suite</div>
  <h2>Six financing solutions,<br/>one platform</h2>
  <p class="deck">Purpose-built for African trade ecosystems &mdash; covering invoice-based, asset-backed, and structured financing across the entire supply chain.</p>

  <table class="prod-table">
    <thead><tr><th>Product</th><th>Description</th><th>Key Features</th></tr></thead>
    <tbody>
      <tr>
        <td class="name">Invoice Finance<div class="sub">Buyer &rarr; Seller</div></td>
        <td>Sellers issue invoices to buyers. Sellers finance against verified invoices for immediate working capital.</td>
        <td>Seller uploads invoices &middot; Buyer verifies &middot; FI pays seller early &middot; Real-time limit tracking</td>
      </tr>
      <tr>
        <td class="name">Reverse Factoring<div class="sub">Buyer &rarr; Supplier</div></td>
        <td>Suppliers receive early payment backed by the buyer&rsquo;s creditworthiness. The buyer is the ultimate borrower.</td>
        <td>Supplier uploads invoice &middot; Buyer approves &middot; Supplier paid by FI &middot; Buyer repays at maturity</td>
      </tr>
      <tr>
        <td class="name">Invoice Discounting<div class="sub">Supplier-led</div></td>
        <td>Seller-led invoice-to-cash conversion. Sellers pledge invoices for immediate liquidity at a discount.</td>
        <td>Seller-initiated &middot; Buyer confirmation &middot; Discounted advance &middot; Balance on buyer payment</td>
      </tr>
      <tr>
        <td class="name">Blended Finance<div class="sub">Multi-FI</div></td>
        <td>Multi-FI capital pools for larger transactions. Two or more institutions share funding and risk on a single programme.</td>
        <td>Multi-FI syndication &middot; Risk-sharing &middot; Larger tickets &middot; Coordinated repayment</td>
      </tr>
      <tr>
        <td class="name">Leasing<div class="sub">Asset-backed</div></td>
        <td>Structured lease financing for equipment, vehicles, and capital assets. FIs retain ownership; lessee pays over time.</td>
        <td>Asset-backed &middot; Flexible tenor &middot; FI retains ownership &middot; Periodic schedules</td>
      </tr>
      <tr>
        <td class="name">Warehouse Receipt<div class="sub">Commodity-backed</div></td>
        <td>Commodity-collateralised financing. Goods stored in certified warehouses serve as security for working capital.</td>
        <td>Certified warehouses &middot; Price-indexed limits &middot; Agri &amp; commodity focus</td>
      </tr>
    </tbody>
  </table>

  <div class="pg-foot"><span>Trove</span><span>2</span></div>
</div>

<!-- ═══ PAGE 3: PROCESS ═══ -->
<div class="page">
  <div class="pg-rule"></div>
  <div class="overline">Process</div>
  <h2>From onboarding<br/>to disbursement</h2>
  <p class="deck">A six-step process with maker-checker governance and independent FI screening at every stage.</p>

  <div class="proc-row">
    <div class="proc-num">01</div>
    <div><h3>Invitation &amp; Onboarding</h3><p>Entities are invited via unique codes. Complete KYC, upload documents (CR12, KRA PIN, IDs, bank statements), and submit for review.</p></div>
  </div>
  <div class="proc-row">
    <div class="proc-num">02</div>
    <div><h3>Maker-Checker Review</h3><p>Internal operations team verifies documents and entity details. Dual-approval (Maker then Checker) before advancing to FI.</p></div>
  </div>
  <div class="proc-row">
    <div class="proc-num">03</div>
    <div><h3>FI Entity Screening</h3><p>The financing institution independently screens and approves the entity, reviewing KYC documents, credit profile, and trade history.</p></div>
  </div>
  <div class="proc-row">
    <div class="proc-num">04</div>
    <div><h3>Limit &amp; Offer Letter</h3><p>FI sets a financing limit. An offer letter with approved rates, tenor, and terms is generated and sent for acceptance.</p></div>
  </div>
  <div class="proc-row">
    <div class="proc-num">05</div>
    <div><h3>Invoice Verification</h3><p>Invoices or trade assets are uploaded and verified through the backoffice workflow. Eligible items are marked for financing.</p></div>
  </div>
  <div class="proc-row">
    <div class="proc-num">06</div>
    <div><h3>Financing &amp; Disbursement</h3><p>Entities request financing. After approval, funds are disbursed via bank transfer or M-Pesa &mdash; typically within 48 hours.</p></div>
  </div>

  <div class="pg-foot"><span>Trove</span><span>3</span></div>
</div>

<!-- ═══ PAGE 4: TARGET PARTICIPANTS ═══ -->
<div class="page">
  <div class="pg-rule"></div>
  <div class="overline">Target Participants</div>
  <h2>Every player in<br/>the value chain</h2>
  <p class="deck">Trove serves all participants in trade finance ecosystems &mdash; from large corporates to small suppliers, banks, and platform operators.</p>

  <div class="aud-grid">
    <div class="aud-cell">
      <h3>Program Owners &amp; Corporates</h3>
      <p>Large corporates managing dealer or supplier networks. Upload invoices, invite participants, and ensure timely payments across the supply chain.</p>
    </div>
    <div class="aud-cell">
      <h3>Sellers &amp; Suppliers</h3>
      <p>Businesses on both sides of trade. Access early financing on invoices or assets to improve cash flow and reduce payment uncertainty.</p>
    </div>
    <div class="aud-cell">
      <h3>Financial Institutions</h3>
      <p>Banks and lenders. Deploy capital with full visibility into trade flows. Screen entities, set limits, and manage portfolio risk in real time.</p>
    </div>
    <div class="aud-cell">
      <h3>Platform Operators</h3>
      <p>Managing programmes, onboarding queues, compliance, credit scoring, and the maker-checker governance layer end to end.</p>
    </div>
  </div>

  <div class="pg-foot"><span>Trove</span><span>4</span></div>
</div>

<!-- ═══ PAGE 5: WHY TROVE ═══ -->
<div class="page">
  <div class="pg-rule"></div>
  <div class="overline">Differentiation</div>
  <h2>Purpose-built for<br/>trade finance in Africa</h2>
  <p class="deck">Traditional trade finance is slow, opaque, and excludes SMEs. Trove gives every business in the value chain access to affordable working capital with institutional-grade governance.</p>

  <div class="adv-grid">
    <div class="adv-cell"><h4>Fast Disbursement</h4><p>Funds in as little as 48 hours after approval via bank transfer or M-Pesa.</p></div>
    <div class="adv-cell"><h4>Maker-Checker-FI</h4><p>Triple-layer approval on every onboarding and financing request.</p></div>
    <div class="adv-cell"><h4>Multi-Party Platform</h4><p>One platform for anchors, dealers, suppliers, FIs, and operations teams.</p></div>
    <div class="adv-cell"><h4>Real-Time Visibility</h4><p>Track limits, invoices, financing, loans, and repayments live across the portfolio.</p></div>
    <div class="adv-cell"><h4>Six Product Types</h4><p>Invoice Finance, Reverse Factoring, Discounting, Blended, Leasing, Warehouse Receipt.</p></div>
    <div class="adv-cell"><h4>Built for Africa</h4><p>M-Pesa integration, KES support, Kenyan KYC flows, and local market alignment.</p></div>
    <div class="adv-cell"><h4>Automated Scoring</h4><p>Payment timeliness, trade volume, default rates, and counterparty diversity.</p></div>
    <div class="adv-cell"><h4>Double-Entry Ledger</h4><p>Automatic journal entries on disbursement and repayment for full audit trail.</p></div>
    <div class="adv-cell"><h4>AI-Powered Alerts</h4><p>Anomaly detection, payment pattern shifts, and portfolio risk monitoring.</p></div>
  </div>

  <div class="figures">
    <div class="fig"><div class="val">6</div><div class="lbl">Product Types</div></div>
    <div class="fig"><div class="val">48h</div><div class="lbl">Avg Disbursement</div></div>
    <div class="fig"><div class="val">3-Layer</div><div class="lbl">Governance</div></div>
    <div class="fig"><div class="val">KE</div><div class="lbl">Live in Kenya</div></div>
  </div>

  <div class="pg-foot"><span>Trove</span><span>5</span></div>
</div>

<!-- ═══ PAGE 6: BACK COVER ═══ -->
<div class="back">
  <div class="back-bar"></div>
  <div class="back-logo"><svg viewBox="0 0 24 24" fill="none" style="width:24px;height:24px;vertical-align:middle;margin-right:8px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="white" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="white"/><path d="M3 7v10l9 5V12L3 7z" fill="white" opacity="0.7"/></svg>trove</div>
  <h2>Ready to unlock your working capital?</h2>
  <p class="deck">Join the growing network of African businesses using Trove to accelerate cash flow, reduce risk, and scale.</p>
  <a href="mailto:contact.felixmwanza@gmail.com" class="cta">Get in Touch &rarr;</a>
  <div class="contact-line">
    <span>contact.felixmwanza@gmail.com</span>
    <span>+254 702 719 701</span>
    <span>Nairobi, Kenya</span>
  </div>
  <div class="foot">&copy; ${year} Trove. All rights reserved.</div>
</div>

</body>
</html>`;

    const { url } = await ZitePdf.renderHtml({
      html,
      filename: `Trove-Brochure-${year}.pdf`,
    });

    return { url };
  },
});
