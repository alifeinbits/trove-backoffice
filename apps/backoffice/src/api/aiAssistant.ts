import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default createEndpoint({
  description: 'Natural-language assistant that translates questions into SQL queries against the portfolio database',
  stream: true,
  inputSchema: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })),
  }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ input, stream }) => {
    const apiKey = process.env.ZITE_GEMINI_ACCESS_TOKEN;
    if (!apiKey) {
      const msg = 'AI Assistant is not available. Please connect Google Gemini to enable this feature.';
      await stream.write(msg);
      return { text: msg };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `You are Trove AI Assistant, a read-only query assistant for a Kenyan trade finance platform.

You can query the database using SQL. When the user asks a question about loans, entities, invoices, transactions, or credit scores, generate a SQL query to answer it.

Available tables and key fields (all identifiers must be double-quoted in SQL):
- "Entities": id, "name", "entityType" (Dealer/Supplier/Anchor Buyer/FI/Master Anchor — displayed as Seller/Supplier/Buyer/FI/Program Owner), "kycStatus", "approvedLimit", "onboardingStatus", "kraPin"
- "Loans": id, "loanReference", "principal", "outstandingBalance", "interestRate", "penaltyAmount", "status" (Active/Overdue/Settled/Written Off), "disbursedAt", "maturityDate", "daysOverdue", "productType"
- "Invoices": id, "invoiceNumber", "amount", "issueDate", "dueDate", "status", "productType"
- "Transactions": id, "reference", "type" (Disbursement/Repayment/Penalty), "amount", "paymentMethod", "status"
- "Programs": id, "name", "productType", "programSize", "status"
- "CreditScores": id, "entityName", "score", "rating", "onTimePercent", "totalTradeVolume", "defaultRate", "computedAt"
- "RiskAlerts": id, "title", "alertType", "severity", "status", "detectedAt"

Link tables for JOINs:
- "EntitiesLoans" ("entitiesId", "loansId")
- "EntitiesInvoices" ("entitiesId", "invoicesId")
- "CreditScoresEntities" ("creditScoresId", "entitiesId")
- "EntitiesRiskAlerts" ("entitiesId", "riskAlertsId")
- "LoansTransactions" ("loansId", "transactionsId")

Currency is KES. Format large numbers with commas. Always use SELECT only — never modify data.
When showing tables, use markdown table format. Keep responses concise and professional.

WORKFLOW:
1. First, output ONLY a SQL query wrapped in \`\`\`sql blocks to answer the user's question.
2. If no SQL is needed (greeting, clarification), respond normally without SQL.`;

    // Step 1: Generate SQL
    const history = input.messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));

    const lastMsg = input.messages[input.messages.length - 1];

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: 'System instructions: ' + systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will translate portfolio questions into read-only SQL and return formatted answers.' }] },
        ...history,
      ],
    });

    const sqlResult = await chat.sendMessage(lastMsg.content);
    const sqlContent = sqlResult.response.text();
    const sqlMatch = sqlContent.match(/```sql\s*([\s\S]*?)```/);

    let queryResults = '';
    if (sqlMatch) {
      const query = sqlMatch[1].trim();
      if (query.toUpperCase().startsWith('SELECT') || query.toUpperCase().startsWith('WITH')) {
        try {
          const result = await zite.sql({ query });
          queryResults = `\nQuery results (${result.rowCount} rows):\n${JSON.stringify(result.rows.slice(0, 50), null, 2)}`;
        } catch (err: any) {
          queryResults = `\nQuery error: ${err.message}`;
        }
      }
    }

    // Step 2: Stream the formatted answer
    if (queryResults) {
      const answerResult = await model.generateContentStream({
        contents: [
          { role: 'user', parts: [{ text: `System: ${systemPrompt}\n\nFormat these query results into a clear, professional answer. Use markdown tables where appropriate. Never show the raw SQL to the user.\n\nUser question: ${lastMsg.content}\n\nQuery results:${queryResults}` }] },
        ],
      });

      let text = '';
      for await (const chunk of answerResult.stream) {
        const delta = chunk.text();
        text += delta;
        await stream.write(delta);
      }
      return { text };
    } else {
      // No SQL needed — stream the direct response
      const text = sqlContent;
      await stream.write(text);
      return { text };
    }
  },
});
