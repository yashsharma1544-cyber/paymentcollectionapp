import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customers } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const customerData = JSON.stringify(customers.slice(0, 50));

    const systemPrompt = `You are a payment collection analyst for an Indian distribution business. Analyze customer payment data and predict which customers are most likely to pay this week.

For each customer, consider:
- Outstanding amount and number of bills
- How many days their oldest bill is overdue
- Their collection percentage (how much of total billing they've paid)
- Number of past payments (indicates payment willingness)
- Their health status (Good/Average/Risky)
- Their beat (route/area)

Return predictions using the suggest_payments tool. Focus on the top 15 most actionable customers.
Prioritize customers who:
1. Have a history of making payments (pastPayments > 0) but have recent outstanding
2. Have moderate overdue (15-45 days) — too fresh won't pay yet, too old may be harder
3. Have decent collection percentages — they DO pay, just slowly

For reasoning, use brief business language. For suggestedAction, give a specific next step (call, visit, send reminder, offer discount, etc).
IMPORTANT: Always include the customer's beat field exactly as provided in the input data.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze these customers and predict payment likelihood:\n${customerData}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_payments",
            description: "Return payment predictions for customers",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      customerName: { type: "string" },
                      beat: { type: "string", description: "The beat/route/area of the customer" },
                      likelihood: { type: "string", enum: ["High", "Medium", "Low"] },
                      reasoning: { type: "string" },
                      suggestedAction: { type: "string" },
                      estimatedAmount: { type: "number" },
                    },
                    required: ["customerName", "beat", "likelihood", "reasoning", "suggestedAction", "estimatedAmount"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["predictions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_payments" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", status, text);
      throw new Error("AI analysis failed");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No predictions returned");

    const predictions = JSON.parse(toolCall.function.arguments);
    const preds = predictions.predictions || [];

    // Save snapshot to database
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      const highCount = preds.filter((p: any) => p.likelihood === "High").length;
      const mediumCount = preds.filter((p: any) => p.likelihood === "Medium").length;
      const lowCount = preds.filter((p: any) => p.likelihood === "Low").length;
      const totalPredicted = preds.reduce((s: number, p: any) => s + (p.estimatedAmount || 0), 0);

      await sb.from("prediction_snapshots").insert({
        predictions: preds,
        total_predicted: totalPredicted,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
      });
    } catch (saveErr) {
      console.error("Failed to save snapshot:", saveErr);
      // Don't fail the whole request if saving fails
    }

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Prediction error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
