import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { ZitePdf } from 'zitejs/pdf';

export default createEndpoint({
  description: 'Generates a YC-style investor pitch deck PDF for Trove',
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
  @page { size: 297mm 210mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; font-size: 10pt; line-height: 1.5; }

  /* ── Slide base ── */
  .slide {
    width: 297mm; height: 210mm; padding: 48px 64px;
    page-break-after: always; position: relative; overflow: hidden;
    display: flex; flex-direction: column; justify-content: center;
  }
  .slide:last-child { page-break-after: auto; }
  .slide-num {
    position: absolute; bottom: 24px; right: 64px;
    font-size: 8pt; color: #ccc; font-weight: 600;
  }
  .slide-logo {
    position: absolute; top: 36px; left: 64px;
    font-size: 14pt; font-weight: 800; letter-spacing: -0.04em; color: #1a1a1a;
  }
  .dark .slide-logo { color: #fff; }

  /* ── Dark slide ── */
  .dark {
    background: linear-gradient(160deg, #061d0b 0%, #0d3318 35%, #165226 65%, #1a6030 100%);
    color: #fff;
  }
  .dark .slide-num { color: rgba(255,255,255,0.2); }

  /* ── Typography ── */
  .slide h1 { font-size: 42pt; font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 16px; }
  .slide h2 { font-size: 32pt; font-weight: 800; letter-spacing: -0.025em; line-height: 1.1; margin-bottom: 12px; }
  .slide h3 { font-size: 18pt; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 8px; }
  .accent { color: #43a047; }
  .dark .accent { color: #81c784; }
  .muted { color: #888; font-weight: 400; }
  .dark .muted { color: rgba(255,255,255,0.45); }
  .overline {
    font-size: 8pt; text-transform: uppercase; letter-spacing: 0.2em;
    font-weight: 700; color: #2e7d32; margin-bottom: 12px;
  }
  .dark .overline { color: #81c784; }

  /* ── Big number ── */
  .big-num { font-size: 72pt; font-weight: 900; letter-spacing: -0.04em; line-height: 1; color: #0a1f12; }
  .dark .big-num { color: #fff; }

  /* ── Stat row ── */
  .stat-row { display: flex; gap: 48px; margin-top: 32px; }
  .stat-item .val { font-size: 36pt; font-weight: 900; letter-spacing: -0.03em; line-height: 1; color: #0a1f12; }
  .stat-item .lbl { font-size: 9pt; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .dark .stat-item .val { color: #fff; }
  .dark .stat-item .lbl { color: rgba(255,255,255,0.4); }

  /* ── Two-col ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; }

  /* ── Card items ── */
  .card-item { border-left: 3px solid #2e7d32; padding-left: 16px; margin-bottom: 20px; }
  .card-item h4 { font-size: 11pt; font-weight: 700; margin-bottom: 2px; }
  .card-item p { font-size: 9pt; color: #666; line-height: 1.5; }
  .dark .card-item { border-left-color: #66bb6a; }
  .dark .card-item p { color: rgba(255,255,255,0.5); }

  /* ── Bullet list ── */
  .bullet-list { list-style: none; }
  .bullet-list li {
    font-size: 12pt; font-weight: 500; padding: 8px 0; padding-left: 20px;
    position: relative; color: #333; border-bottom: 1px solid #f0f0f0;
  }
  .bullet-list li::before {
    content: ''; position: absolute; left: 0; top: 16px;
    width: 8px; height: 8px; border-radius: 50%; background: #2e7d32;
  }
  .bullet-list li:last-child { border-bottom: none; }

  /* ── Process timeline ── */
  .timeline { display: flex; gap: 0; margin-top: 24px; }
  .tl-step { flex: 1; padding: 16px; border-top: 3px solid #2e7d32; position: relative; }
  .tl-step::before {
    content: ''; position: absolute; top: -7px; left: 0;
    width: 10px; height: 10px; border-radius: 50%; background: #2e7d32;
  }
  .tl-step .num { font-size: 8pt; font-weight: 800; color: #2e7d32; margin-bottom: 4px; }
  .tl-step h4 { font-size: 9.5pt; font-weight: 700; margin-bottom: 2px; }
  .tl-step p { font-size: 7.5pt; color: #888; line-height: 1.4; }

  /* ── Table ── */
  .comp-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  .comp-table th {
    text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #999; border-bottom: 2px solid #111; padding: 0 12px 6px 0;
  }
  .comp-table td {
    padding: 10px 12px 10px 0; border-bottom: 1px solid #f0f0f0;
    font-size: 9.5pt; color: #444;
  }
  .comp-table td:first-child { font-weight: 700; color: #111; }
  .check { color: #2e7d32; font-weight: 800; }
  .cross { color: #ccc; }

  /* ── Footer strip ── */
  .slide-foot {
    position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
    background: #2e7d32;
  }
  .dark .slide-foot { background: #43a047; }
</style>
</head>
<body>

<!-- SLIDE 1: Title -->
<div class="slide dark">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div>
    <div class="overline">Investor Presentation &middot; ${year}</div>
    <h1>Trade finance infrastructure<br/>for <span class="accent">Africa</span></h1>
    <p class="muted" style="font-size: 13pt; max-width: 520px; margin-top: 8px;">
      Turning unpaid invoices and trade assets into immediate working capital
      for SMEs across the continent.
    </p>
  </div>
  <div style="position: absolute; bottom: 48px; left: 64px; font-size: 9pt; color: rgba(255,255,255,0.3);">
    contact.felixmwanza@gmail.com &nbsp;&middot;&nbsp; +254 702 719 701 &nbsp;&middot;&nbsp; Nairobi, Kenya
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">1</div>
</div>

<!-- SLIDE 2: Problem -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">The Problem</div>
  <h2>African SMEs are starved<br/>of <span class="accent">working capital</span></h2>
  <div class="stat-row">
    <div class="stat-item"><div class="val">$120B</div><div class="lbl">Trade Finance Gap in Africa</div></div>
    <div class="stat-item"><div class="val">70%</div><div class="lbl">SME Financing Requests Rejected</div></div>
    <div class="stat-item"><div class="val">90+</div><div class="lbl">Days Average Payment Cycle</div></div>
  </div>
  <p style="margin-top: 24px; font-size: 11pt; color: #666; max-width: 600px;">
    Banks lack visibility into trade flows. Suppliers wait months for payment. Anchor corporates
    have no tools to support their value chains. The infrastructure doesn&rsquo;t exist.
  </p>
  <div class="slide-foot"></div>
  <div class="slide-num">2</div>
</div>

<!-- SLIDE 3: Solution -->
<div class="slide dark">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">The Solution</div>
  <h2>One platform connecting<br/>the entire trade ecosystem</h2>
  <div class="three-col" style="margin-top: 28px;">
    <div class="card-item"><h4>For SMEs</h4><p>Upload invoices, get financing in 48 hours. No collateral required &mdash; trade history is your credit.</p></div>
    <div class="card-item"><h4>For Corporates</h4><p>Support your dealer and supplier networks with structured financing programmes that reduce payment risk.</p></div>
    <div class="card-item"><h4>For Banks</h4><p>Deploy capital into verified trade flows with full KYC, credit scoring, and portfolio visibility.</p></div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">3</div>
</div>

<!-- SLIDE 4: Product -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Product</div>
  <h2>Six financing products,<br/>one <span class="accent">integrated</span> platform</h2>
  <div class="two-col" style="margin-top: 24px;">
    <div>
      <div class="card-item"><h4>Invoice Finance</h4><p>Anchor-to-dealer invoice financing with real-time limit tracking.</p></div>
      <div class="card-item"><h4>Reverse Factoring</h4><p>Supplier early payment backed by anchor buyer creditworthiness.</p></div>
      <div class="card-item"><h4>Invoice Discounting</h4><p>Supplier-led invoice-to-cash at a discount.</p></div>
    </div>
    <div>
      <div class="card-item"><h4>Blended Finance</h4><p>Multi-FI syndication for larger transactions with shared risk.</p></div>
      <div class="card-item"><h4>Leasing</h4><p>Asset-backed structured financing for equipment and vehicles.</p></div>
      <div class="card-item"><h4>Warehouse Receipt</h4><p>Commodity-collateralised financing via certified warehouses.</p></div>
    </div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">4</div>
</div>

<!-- SLIDE 5: How It Works -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">How It Works</div>
  <h2>Onboarding to disbursement<br/>in <span class="accent">six steps</span></h2>
  <div class="timeline">
    <div class="tl-step"><div class="num">01</div><h4>Invite</h4><p>Entities invited via unique codes</p></div>
    <div class="tl-step"><div class="num">02</div><h4>KYC</h4><p>Documents uploaded and verified</p></div>
    <div class="tl-step"><div class="num">03</div><h4>Review</h4><p>Maker-checker dual approval</p></div>
    <div class="tl-step"><div class="num">04</div><h4>FI Screen</h4><p>Bank independently screens entity</p></div>
    <div class="tl-step"><div class="num">05</div><h4>Offer</h4><p>Limit set, offer letter issued</p></div>
    <div class="tl-step"><div class="num">06</div><h4>Disburse</h4><p>Funds via bank or M-Pesa in 48h</p></div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">5</div>
</div>

<!-- SLIDE 6: Market -->
<div class="slide dark">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Market Opportunity</div>
  <h2>A massive, underserved market</h2>
  <div class="stat-row" style="margin-top: 28px;">
    <div class="stat-item"><div class="val">$120B</div><div class="lbl">Africa Trade Finance Gap</div></div>
    <div class="stat-item"><div class="val">$6.5T</div><div class="lbl">Global Trade Finance Market</div></div>
    <div class="stat-item"><div class="val">44M</div><div class="lbl">SMEs in Sub-Saharan Africa</div></div>
  </div>
  <div class="two-col" style="margin-top: 32px;">
    <div>
      <p class="muted" style="font-size: 10.5pt; line-height: 1.65;">
        <strong style="color: #fff;">SAM:</strong> Kenya&rsquo;s trade finance market &mdash; $4.2B in annual invoice
        volumes across manufacturing, agriculture, and FMCG supply chains.
      </p>
    </div>
    <div>
      <p class="muted" style="font-size: 10.5pt; line-height: 1.65;">
        <strong style="color: #fff;">SOM:</strong> First-year target of $50M in facilitated financing
        across 3 anchor programmes with 2 partner FIs in Kenya.
      </p>
    </div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">6</div>
</div>

<!-- SLIDE 7: Why Now -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Why Now</div>
  <h2>The timing is <span class="accent">right</span></h2>
  <ul class="bullet-list" style="margin-top: 20px; max-width: 620px;">
    <li>Digital KYC infrastructure maturing across East Africa</li>
    <li>Central Bank of Kenya pushing for financial inclusion in trade</li>
    <li>M-Pesa and instant payment rails enable same-day disbursement</li>
    <li>Banks actively seeking digital lending channels post-COVID</li>
    <li>Large corporates digitising their supply chains and vendor management</li>
  </ul>
  <div class="slide-foot"></div>
  <div class="slide-num">7</div>
</div>

<!-- SLIDE 8: Competitive Advantage -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Competitive Landscape</div>
  <h2>Built different</h2>
  <table class="comp-table">
    <thead>
      <tr><th>Capability</th><th>Trove</th><th>Traditional Banks</th><th>Fintech Lenders</th></tr>
    </thead>
    <tbody>
      <tr><td>Multi-product platform</td><td class="check">6 products</td><td class="cross">1&ndash;2</td><td class="cross">1</td></tr>
      <tr><td>Multi-party (anchor + supplier + FI)</td><td class="check">Yes</td><td class="cross">No</td><td class="cross">Partial</td></tr>
      <tr><td>Maker-Checker-FI governance</td><td class="check">3-layer</td><td>Internal only</td><td class="cross">None</td></tr>
      <tr><td>Real-time trade visibility</td><td class="check">Full</td><td class="cross">Limited</td><td class="cross">None</td></tr>
      <tr><td>Automated credit scoring</td><td class="check">Built-in</td><td>Manual</td><td>Partial</td></tr>
      <tr><td>M-Pesa disbursement</td><td class="check">Yes</td><td class="cross">No</td><td>Some</td></tr>
      <tr><td>API partner channel</td><td class="check">Yes</td><td class="cross">No</td><td class="cross">No</td></tr>
    </tbody>
  </table>
  <div class="slide-foot"></div>
  <div class="slide-num">8</div>
</div>

<!-- SLIDE 9: Business Model -->
<div class="slide dark">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Business Model</div>
  <h2>Revenue from every transaction</h2>
  <div class="three-col" style="margin-top: 28px;">
    <div class="card-item">
      <h4>Transaction Fees</h4>
      <p>0.5&ndash;2% fee on every financing disbursement. Volume-driven, recurring revenue tied to trade flow.</p>
    </div>
    <div class="card-item">
      <h4>Platform Fees</h4>
      <p>Monthly SaaS fee per anchor programme. Scales with number of entities and transaction volume.</p>
    </div>
    <div class="card-item">
      <h4>Partner Revenue Share</h4>
      <p>API partners and FIs pay integration and data fees. Higher margins as the network grows.</p>
    </div>
  </div>
  <div class="stat-row" style="margin-top: 36px;">
    <div class="stat-item"><div class="val">2%</div><div class="lbl">Avg Take Rate</div></div>
    <div class="stat-item"><div class="val">85%</div><div class="lbl">Gross Margin Target</div></div>
    <div class="stat-item"><div class="val">3x</div><div class="lbl">Year-over-Year Growth</div></div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">9</div>
</div>

<!-- SLIDE 10: Traction -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Traction</div>
  <h2>Early signals of <span class="accent">product-market fit</span></h2>
  <div class="stat-row" style="margin-top: 24px;">
    <div class="stat-item"><div class="val">Live</div><div class="lbl">Platform in Production</div></div>
    <div class="stat-item"><div class="val">6</div><div class="lbl">Product Types Built</div></div>
    <div class="stat-item"><div class="val">3-Layer</div><div class="lbl">Governance Operational</div></div>
  </div>
  <ul class="bullet-list" style="margin-top: 24px; max-width: 620px;">
    <li>Full backoffice with maker-checker-FI workflow live</li>
    <li>Customer portal with self-service onboarding deployed</li>
    <li>Partner API channel with key management operational</li>
    <li>AI-powered credit scoring and risk alerts active</li>
    <li>Double-entry ledger with automated journal entries</li>
  </ul>
  <div class="slide-foot"></div>
  <div class="slide-num">10</div>
</div>

<!-- SLIDE 11: Team -->
<div class="slide">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">Team</div>
  <h2>Built by people who<br/>know <span class="accent">the problem</span></h2>
  <p style="margin-top: 12px; font-size: 11pt; color: #666; max-width: 580px; line-height: 1.65;">
    Our founding team combines deep expertise in trade finance, banking technology,
    and African fintech &mdash; with direct experience building and scaling financial
    infrastructure across the continent.
  </p>
  <div style="margin-top: 28px; border-top: 2px solid #111; padding-top: 20px;">
    <p style="font-size: 10pt; color: #888;">
      <strong style="color: #111;">Felix Mwanza</strong> &nbsp;&middot;&nbsp; Founder &amp; CEO<br/>
      contact.felixmwanza@gmail.com &nbsp;&middot;&nbsp; +254 702 719 701
    </p>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">11</div>
</div>

<!-- SLIDE 12: The Ask -->
<div class="slide dark">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div class="overline">The Ask</div>
  <h1>Raising to scale<br/><span class="accent">trade finance</span><br/>across Africa</h1>
  <div class="three-col" style="margin-top: 32px;">
    <div class="card-item"><h4>Product</h4><p>Expand product suite, deepen FI integrations, and build mobile-first experience.</p></div>
    <div class="card-item"><h4>Growth</h4><p>Onboard 10 anchor programmes and 5 FI partners in Kenya within 12 months.</p></div>
    <div class="card-item"><h4>Expansion</h4><p>Enter Tanzania and Uganda by Year 2. Pan-African coverage by Year 4.</p></div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">12</div>
</div>

<!-- SLIDE 13: Close -->
<div class="slide dark" style="justify-content: center; align-items: center; text-align: center;">
  <div class="slide-logo"><svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.3"/><path d="M12 2L3 7l9 5 9-5-9-5z" fill="currentColor"/><path d="M3 7v10l9 5V12L3 7z" fill="currentColor" opacity="0.7"/></svg>trove</div>
  <div style="max-width: 480px;">
    <h1 style="font-size: 48pt;">Thank you</h1>
    <p class="muted" style="font-size: 13pt; margin-top: 12px; line-height: 1.7;">
      Let&rsquo;s unlock working capital for Africa&rsquo;s growing businesses &mdash; together.
    </p>
    <div style="margin-top: 36px; font-size: 10pt; color: rgba(255,255,255,0.35);">
      <p>Felix Mwanza</p>
      <p>contact.felixmwanza@gmail.com &nbsp;&middot;&nbsp; +254 702 719 701</p>
      <p style="margin-top: 4px;">Nairobi, Kenya</p>
    </div>
  </div>
  <div class="slide-foot"></div>
  <div class="slide-num">13</div>
</div>

</body>
</html>`;

    const { url } = await ZitePdf.renderHtml({
      html,
      filename: `Trove-Pitch-Deck-${year}.pdf`,
    });

    return { url };
  },
});
