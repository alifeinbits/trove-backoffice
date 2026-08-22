import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists invoices for entities belonging to a specific partner',
  authenticated: true,
  inputSchema: z.object({
    partnerId: z.string().min(1),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    invoices: z.array(z.any()),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    const params: string[] = [input.partnerId];
    const conditions: string[] = [];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      conditions.push(`(i."invoiceNumber" ILIKE $${params.length} OR e."name" ILIKE $${params.length})`);
    }
    if (input.status?.trim()) {
      params.push(input.status.trim());
      conditions.push(`i."status" = $${params.length}`);
    }

    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const result = await zite.sql({
      query: `
        SELECT
          i.id,
          i."invoiceNumber" AS "invoiceNumber",
          i."amount",
          i."status",
          i."dueDate" AS "dueDate",
          i.created_at AS "createdAt",
          e."name" AS "entityName"
        FROM "Invoices" i
        JOIN "EntitiesInvoices" ei ON ei."invoicesId" = i.id
        JOIN "Entities" e ON e.id = ei."entitiesId"
        JOIN "ApiPartnersEntities" ape ON ape."entitiesId" = e.id
        WHERE ape."apiPartnersId" = $1
        ${where}
        ORDER BY i.created_at DESC
        LIMIT 200
      `,
      params,
    });

    return {
      invoices: result.rows.map(r => ({
        id: String(r.id),
        invoiceNumber: String(r.invoiceNumber ?? ''),
        amount: r.amount ? Number(r.amount) : 0,
        status: String(r.status ?? ''),
        dueDate: r.dueDate ? String(r.dueDate) : null,
        createdAt: r.createdAt ? String(r.createdAt) : null,
        entityName: String(r.entityName ?? ''),
      })),
      total: result.rowCount,
    };
  },
});
