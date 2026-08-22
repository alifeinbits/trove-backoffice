import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns warehouse receipts with entity and program names',
  inputSchema: z.object({
    status: z.string().optional(),
    programId: z.string().optional(),
  }),
  outputSchema: z.object({
    receipts: z.array(z.object({
      id: z.string(),
      receiptNumber: z.string().nullable(),
      entityName: z.string().nullable(),
      entityId: z.string().nullable(),
      programName: z.string().nullable(),
      loanReference: z.string().nullable(),
      warehouseName: z.string().nullable(),
      warehouseLocation: z.string().nullable(),
      commodityType: z.string().nullable(),
      grade: z.string().nullable(),
      quantity: z.number().nullable(),
      unitOfMeasure: z.string().nullable(),
      unitPrice: z.number().nullable(),
      totalValue: z.number().nullable(),
      dateDeposited: z.string().nullable(),
      expiryDate: z.string().nullable(),
      status: z.string().nullable(),
      collateralManager: z.string().nullable(),
      createdAt: z.string().nullable(),
    })),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    let pi = 1;

    if (input.status) {
      where += ` AND wr."status" = $${pi++}`;
      params.push(input.status);
    }
    if (input.programId) {
      where += ` AND pwr."programsId" = $${pi++}`;
      params.push(input.programId);
    }

    const result = await zite.sql({
      query: `
        SELECT
          wr.id, wr."receiptNumber", wr."warehouseName", wr."warehouseLocation",
          wr."commodityType", wr."grade", wr."quantity", wr."unitOfMeasure",
          wr."unitPrice", wr."totalValue", wr."dateDeposited", wr."expiryDate",
          wr."status", wr."collateralManager", wr.created_at AS "createdAt",
          e."name" AS "entityName", e.id AS "entityId",
          p."name" AS "programName",
          l."loanReference"
        FROM "WarehouseReceipts" wr
        LEFT JOIN "EntitiesWarehouseReceipts" ewr ON ewr."warehouseReceiptsId" = wr.id
        LEFT JOIN "Entities" e ON e.id = ewr."entitiesId"
        LEFT JOIN "ProgramsWarehouseReceipts" pwr ON pwr."warehouseReceiptsId" = wr.id
        LEFT JOIN "Programs" p ON p.id = pwr."programsId"
        LEFT JOIN "LoansWarehouseReceipts" lwr ON lwr."warehouseReceiptsId" = wr.id
        LEFT JOIN "Loans" l ON l.id = lwr."loansId"
        ${where}
        ORDER BY wr.created_at DESC
        LIMIT 500
      `,
      params,
    });

    const receipts = result.rows.map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber || null,
      entityName: r.entityName || null,
      entityId: r.entityId || null,
      programName: r.programName || null,
      loanReference: r.loanReference || null,
      warehouseName: r.warehouseName || null,
      warehouseLocation: r.warehouseLocation || null,
      commodityType: r.commodityType || null,
      grade: r.grade || null,
      quantity: r.quantity ? Number(r.quantity) : null,
      unitOfMeasure: r.unitOfMeasure || null,
      unitPrice: r.unitPrice ? Number(r.unitPrice) : null,
      totalValue: r.totalValue ? Number(r.totalValue) : null,
      dateDeposited: r.dateDeposited || null,
      expiryDate: r.expiryDate || null,
      status: r.status || null,
      collateralManager: r.collateralManager || null,
      createdAt: r.createdAt || null,
    }));

    return { receipts, total: receipts.length };
  },
});
