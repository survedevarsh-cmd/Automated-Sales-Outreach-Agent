import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as cheerio from "cheerio";
import { z } from "zod";

export const runtime = 'edge';

const inputSchema = z.object({
  url: z.string().url("Please provide a valid URL starting with http:// or https://"),
  prospectName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = inputSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || "Invalid input";
      return new Response(JSON.stringify({ error: errorMsg }), { status: 400 });
    }

    const { url, prospectName } = parseResult.data;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

          // 1. Analyze Business
          sendEvent("step_update", { step: "analyze", status: "active" });
          let scrapeResult = "";
          
          try {
            const fetchResponse = await fetch(`https://r.jina.ai/${url}`, {
              headers: {
                "Accept": "text/plain",
                "User-Agent": "SalesOutreachAgent/1.0"
              }
            });
            if (!fetchResponse.ok) {
              throw new Error(`HTTP ${fetchResponse.status}`);
            }
            const markdown = await fetchResponse.text();
            scrapeResult = markdown.slice(0, 5000);
            
            if (!scrapeResult || scrapeResult.length < 50) {
               throw new Error("Empty or insufficient text extracted from website. The site might be blocking scrapers.");
            }
          } catch (e: unknown) {
            throw new Error(`Website scraping failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          sendEvent("step_update", { step: "analyze", status: "completed" });

          // 2. Identify Pain Points
          sendEvent("step_update", { step: "pain_points", status: "active" });
          const painPointsPrompt = `You are an elite B2B sales strategist. Analyze this company's website content and identify exactly 3 highly specific, critical pain points they solve for their customers, or 3 operational pain points they likely experience internally. Be concise and sharp. No fluff.\n\nWebsite Content:\n${scrapeResult}`;
          
          const painResp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: painPointsPrompt,
          });
          const painPointsResult = painResp.text;
          if (!painPointsResult) throw new Error("Failed to generate pain points.");
          sendEvent("step_update", { step: "pain_points", status: "completed" });

          // 3. Research Prospect
          sendEvent("step_update", { step: "research", status: "active" });
          const query = prospectName ? `Recent news about ${prospectName} at ${url}` : `Recent news or announcements about ${url}`;
          const researchPrompt = `Find the most recent and relevant news or announcements about this query: "${query}". Summarize the top findings in 2-3 sentences. If nothing recent is found, just say "No major recent news."`;
          
          const researchResp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: researchPrompt,
              config: {
                tools: [{ googleSearch: {} }],
              }
          });
          const researchResult = researchResp.text;
          if (!researchResult) throw new Error("Failed to research prospect.");
          sendEvent("step_update", { step: "research", status: "completed" });

          // 4. Choosing Angle
          sendEvent("step_update", { step: "angle", status: "active" });
          const anglePrompt = `Given the business context, pain points, and recent news, choose the SINGLE most compelling sales outreach angle for a cold email targeting this company. Explain WHY you chose it using 3 concise bullet points. Focus on the most urgent problem we can solve for them.\n\nContext:\n${scrapeResult}\n\nPain Points:\n${painPointsResult}\n\nNews:\n${researchResult}`;
          
          const angleResp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: anglePrompt,
          });
          const angleExplanation = angleResp.text;
          if (!angleExplanation) throw new Error("Failed to choose an angle.");
          sendEvent("step_update", { step: "angle", status: "completed" });

          // 5. Drafting Email
          sendEvent("step_update", { step: "draft", status: "active" });
          const emailPrompt = `You are a world-class SDR. Write a highly personalized, concise cold email based on this angle: ${angleExplanation}. 
Rules:
- Under 100 words.
- Write naturally and converse casually. Strictly avoid AI-sounding phrases (e.g. "I hope this finds you well", "Unlock your potential", "Elevate", "synergy").
- Start with an observation about them, then state a problem, then propose a soft call to action.
- Ensure flawless grammar, spelling, and professional tone with absolutely no grammatical errors.
- Also provide two short, casual follow-up emails (1-2 sentences each).

Format strictly as JSON with exactly these keys: "subject" (string), "body" (string), "followUps" (array of strings).`;
          
          const emailResp = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: emailPrompt,
              config: {
                responseMimeType: "application/json",
              }
          });
          
          const rawText = emailResp.text;
          if (!rawText) throw new Error("Failed to draft email.");
          
          let finalOutput;
          try {
             finalOutput = JSON.parse(rawText);
          } catch {
             throw new Error("Failed to parse the final email output.");
          }

          sendEvent("step_update", { step: "draft", status: "completed" });

          // Send Final Result
          sendEvent("result", {
            subject: finalOutput.subject,
            body: finalOutput.body,
            explanation: angleExplanation,
            followUps: finalOutput.followUps,
            painPoints: painPointsResult,
            research: researchResult
          });

          controller.close();
        } catch (error: unknown) {
          console.error("Streaming error:", error);
          const msg = error instanceof Error ? error.message : "An unexpected error occurred during processing.";
          sendEvent("error", { message: msg });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
