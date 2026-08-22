import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns asset schedules for leasing programs with entity and loan details',
  inputSchema: z.object({
    status: z.string().optional(),
    programId: z.string().optional(),
  }),
  outputSchema: z.object({
    assets: z.array(z.object({
      id: z.string(),
      assetReference: z.string().nullable(),
      entityName: z.string().nullable(),
      entityId: z.string().nullable(),
      programName: z.string().nullable(),
      loanReference: z.string().nullable(),
      assetDescription: z.string().nullable(),
      assetCategory: z.string().nullable(),
      serialNumber: z.string().nullable(),
      makeAndModel: z.string().nullable(),
      yearOfManufacture: z.number().nullable(),
      assetValue: z.number().nullable(),
      residualValue: z.number().nullable(),
      leaseTermMonths: z.number().nullable(),
      depreciationRate: z.number().nullable(),
      leaseStartDate: z.string().nullable(),
      leaseEndDate: z.string().nullable(),
      status: z.string().nullable(),
      insurancePolicyNumber: z.string().nullable(),
      insuranceExpiry: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.string().nullable(),
    })),
    total: z.number(),
  }),
  execute: async ({ input }) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    let pi = 1;

    if (input.status) {
      where += ` AND a."status" = $${pi++}`;
      params.push(input.status);
    }
    if (input.programId) {
      where += ` AND ap."programsId" = $${pi++}`;
      params.push(input.programId);
    }

    const result = await zite.sql({
      query: `
        SELECT
          a.id, a."assetReference", a."assetDescription", a."assetCategory",
          a."serialNumber", a."makeAndModel", a."yearOfManufacture",
          a."assetValue", a."residualValue", a."leaseTermMonths",
          a."depreciationRate", a."leaseStartDate", a."leaseEndDate",
          a."status", a."insurancePolicyNumber", a."insuranceExpiry",
          a."notes", a.created_at AS "createdAt",
          e."name" AS "entityName", e.id AS "entityId",
          p."name" AS "programName",
          l."loanReference"
        FROM "AssetSchedules" a
        LEFT JOIN "AssetSchedulesEntities" ae ON ae."assetSchedulesId" = a.id
        LEFT JOIN "Entities" e ON e.id = ae."entitiesId"
        LEFT JOIN "AssetSchedulesPrograms" ap ON ap."assetSchedulesId" = a.id
        LEFT JOIN "Programs" p ON p.id = ap."programsId"
        LEFT JOIN "AssetSchedulesLoans" al ON al."assetSchedulesId" = a.id
        LEFT JOIN "Loans" l ON l.id = al."loansId"
        ${where}
        ORDER BY a.created_at DESC
        LIMIT 500
      `,
      params,
    });

    const assets = result.rows.map((r: any) => ({
      id: r.id,
      assetReference: r.assetReference || null,
      entityName: r.entityName || null,
      entityId: r.entityId || null,
      programName: r.programName || null,
      loanReference: r.loanReference || null,
      assetDescription: r.assetDescription || null,
      assetCategory: r.assetCategory || null,
      serialNumber: r.serialNumber || null,
      makeAndModel: r.makeAndModel || null,
      yearOfManufacture: r.yearOfManufacture ? Number(r.yearOfManufacture) : null,
      assetValue: r.assetValue ? Number(r.assetValue) : null,
      residualValue: r.residualValue ? Number(r.residualValue) : null,
      leaseTermMonths: r.leaseTermMonths ? Number(r.leaseTermMonths) : null,
      depreciationRate: r.depreciationRate ? Number(r.depreciationRate) : null,
      leaseStartDate: r.leaseStartDate || null,
      leaseEndDate: r.leaseEndDate || null,
      status: r.status || null,
      insurancePolicyNumber: r.insurancePolicyNumber || null,
      insuranceExpiry: r.insuranceExpiry || null,
      notes: r.notes || null,
      createdAt: r.createdAt || null,
    }));

    return { assets, total: assets.length };
  },
});
