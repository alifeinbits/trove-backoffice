import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns journal entries with lines for FI ledger view and accounting reports',
  inputSchema: z.object({
    status: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
  outputSchema: z.object({
    entries: z.array(z.object({
      id: z.string(),
      entryNumber: z.number(),
      entryDate: z.string(),
      reference: z.string(),
      description: z.string(),
      status: z.string(),
      totalAmount: z.number(),
      postedBy: z.string(),
      entityName: z.string(),
      programName: z.string(),
      loanReference: z.string(),
      lines: z.array(z.object({
        id: z.string(),
        glAccountNumber: z.string(),
        glAccountName: z.string(),
        debitAmount: z.number(),
        creditAmount: z.number(),
        narration: z.string(),
      })),
    })),
    summary: z.object({
      totalDebits: z.number(),
      totalCredits: z.number(),
      entryCount: z.number(),
    }),
  }),
  execute: async ({ input }) => {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (input.status && input.status !== 'all') {
      whereClause += ` AND je."status" = $${paramIdx++}`;
      params.push(input.status);
    }
    if (input.dateFrom) {
      whereClause += ` AND je."entryDate" >= $${paramIdx++}`;
      params.push(input.dateFrom);
    }
    if (input.dateTo) {
      whereClause += ` AND je."entryDate" <= $${paramIdx++}`;
      params.push(input.dateTo);
    }

    // Fetch entries with entity, program, loan in one query
    const result = await zite.sql({
      query: `
        SELECT je.id, je."entryNumber", je."entryDate", je."reference",
               je."description", je."status", COALESCE(je."totalAmount", 0) AS "totalAmount",
               COALESCE(je."postedBy", '') AS "postedBy",
               COALESCE(e."name", '') AS "entityName",
               COALESCE(p."name", '') AS "programName",
               COALESCE(l."loanReference", '') AS "loanReference"
        FROM "JournalEntries" je
        LEFT JOIN "EntitiesJournalEntries" eje ON eje."journalEntriesId" = je.id
        LEFT JOIN "Entities" e ON e.id = eje."entitiesId"
        LEFT JOIN "JournalEntriesPrograms" jep ON jep."journalEntriesId" = je.id
        LEFT JOIN "Programs" p ON p.id = jep."programsId"
        LEFT JOIN "JournalEntriesLoans" jel ON jel."journalEntriesId" = je.id
        LEFT JOIN "Loans" l ON l.id = jel."loansId"
        ${whereClause}
        ORDER BY je."entryDate" DESC, je.created_at DESC
        LIMIT 200
      `,
      params,
    });

    // Batch-fetch all journal lines for these entries in one query
    const entryIds = (result.rows as any[]).map(r => r.id);
    let linesMap: Record<string, any[]> = {};

    if (entryIds.length > 0) {
      const linesResult = await zite.sql({
        query: `
          SELECT jl.id, jejl."journalEntriesId",
                 COALESCE(jl."debitAmount", 0) AS "debitAmount",
                 COALESCE(jl."creditAmount", 0) AS "creditAmount",
                 COALESCE(jl."narration", '') AS narration,
                 COALESCE(ga."accountNumber", '') AS "glAccountNumber",
                 COALESCE(ga."accountName", '') AS "glAccountName"
          FROM "JournalLines" jl
          JOIN "JournalEntriesJournalLines" jejl ON jejl."journalLinesId" = jl.id
          LEFT JOIN "GlAccountsJournalLines" gajl ON gajl."journalLinesId" = jl.id
          LEFT JOIN "GlAccounts" ga ON ga.id = gajl."glAccountsId"
          WHERE jejl."journalEntriesId" = ANY($1::uuid[])
          ORDER BY jl.created_at
        `,
        params: [entryIds],
      });

      for (const line of linesResult.rows as any[]) {
        const jeId = line.journalEntriesId;
        if (!linesMap[jeId]) linesMap[jeId] = [];
        linesMap[jeId].push({
          id: String(line.id),
          glAccountNumber: String(line.glAccountNumber),
          glAccountName: String(line.glAccountName),
          debitAmount: Number(line.debitAmount),
          creditAmount: Number(line.creditAmount),
          narration: String(line.narration),
        });
      }
    }

    let totalDebits = 0;
    let totalCredits = 0;

    const entries = (result.rows as any[]).map(r => {
      const lines = linesMap[r.id] || [];
      for (const l of lines) {
        totalDebits += l.debitAmount;
        totalCredits += l.creditAmount;
      }
      return {
        id: String(r.id),
        entryNumber: Number(r.entryNumber || 0),
        entryDate: String(r.entryDate || ''),
        reference: String(r.reference || ''),
        description: String(r.description || ''),
        status: String(r.status || ''),
        totalAmount: Number(r.totalAmount),
        postedBy: String(r.postedBy),
        entityName: String(r.entityName || ''),
        programName: String(r.programName || ''),
        loanReference: String(r.loanReference || ''),
        lines,
      };
    });

    return {
      entries,
      summary: { totalDebits, totalCredits, entryCount: entries.length },
    };
  },
});
