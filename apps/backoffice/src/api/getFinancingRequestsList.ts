import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns all financing requests with entity and program details',
  inputSchema: z.object({ status: z.string().optional() }),
  outputSchema: z.object({
    requests: z.array(z.object({
      id: z.string(),
      requestNumber: z.number(),
      entityName: z.string(),
      entityId: z.string(),
      borrowerName: z.string(),
      programName: z.string(),
      productType: z.string(),
      requestedAmount: z.number(),
      financeableAmount: z.number().nullable(),
      interestRate: z.number().nullable(),
      tenorDays: z.number().nullable(),
      status: z.string(),
      invoiceCount: z.number(),
      createdAt: z.string().nullable(),
    })),
  }),
  execute: async ({ input }) => {
    const statusFilter = input.status && input.status !== 'all' ? `WHERE fr."status" = $1` : '';
    const params = statusFilter ? [input.status] : [];
    const result = await zite.sql({
      query: `
        SELECT fr.id, COALESCE(fr."requestNumber", 0) AS "requestNumber",
               COALESCE(fr."productType", '') AS "productType",
               COALESCE(fr."requestedAmount", 0) AS "requestedAmount",
               fr."financeableAmount", fr."interestRate", fr."tenorDays",
               COALESCE(fr."status", 'Requested') AS status,
               fr.created_at AS "createdAt",
               (SELECT COUNT(*) FROM "FinancingRequestsInvoices" fi WHERE fi."financingRequestsId" = fr.id) AS "invoiceCount"
        FROM "FinancingRequests" fr
        ${statusFilter}
        ORDER BY fr.created_at DESC LIMIT 200
      `,
      params,
    });

    const requests: { id: string; requestNumber: number; entityName: string; entityId: string; borrowerName: string; programName: string; productType: string; requestedAmount: number; financeableAmount: number | null; interestRate: number | null; tenorDays: number | null; status: string; invoiceCount: number; createdAt: string | null }[] = [];
    for (const r of result.rows as any[]) {
      const rec = await zite.financingRequests.findOne({ id: r.id });
      let entityName = '';
      let entityId = '';
      let borrowerName = '';
      let programName = '';
      if (rec?.requestingEntity) {
        const eid = Array.isArray(rec.requestingEntity) ? rec.requestingEntity[0] : rec.requestingEntity;
        if (eid) { entityId = eid; const e = await zite.entities.findOne({ id: eid }); entityName = e?.name || ''; }
      }
      if (rec?.borrowerEntity) {
        const bid = Array.isArray(rec.borrowerEntity) ? rec.borrowerEntity[0] : rec.borrowerEntity;
        if (bid) { const b = await zite.entities.findOne({ id: bid }); borrowerName = b?.name || ''; }
      }
      if (rec?.program) {
        const pid = Array.isArray(rec.program) ? rec.program[0] : rec.program;
        if (pid) { const p = await zite.programs.findOne({ id: pid }); programName = p?.name || ''; }
      }
      requests.push({
        id: String(r.id),
        requestNumber: Number(r.requestNumber),
        entityName,
        entityId,
        borrowerName: borrowerName || entityName,
        programName,
        productType: String(r.productType),
        requestedAmount: Number(r.requestedAmount),
        financeableAmount: r.financeableAmount != null ? Number(r.financeableAmount) : null,
        interestRate: r.interestRate != null ? Number(r.interestRate) : null,
        tenorDays: r.tenorDays != null ? Number(r.tenorDays) : null,
        status: String(r.status),
        invoiceCount: Number(r.invoiceCount || 0),
        createdAt: r.createdAt ? String(r.createdAt) : null,
      });
    }
    return { requests };
  },
});
