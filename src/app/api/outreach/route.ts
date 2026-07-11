import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as cheerio from "cheerio";
import { z } from "zod";

export const runtime = 'edge';

import { supabase } from "../../../lib/supabase";

const inputSchema = z.object({
  companyName: z.string().min(1, "Please provide a valid company name"),
  websiteUrl: z.string().url().optional().or(z.literal('')),
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

    const { companyName, websiteUrl, prospectName } = parseResult.data;
    
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: Missing Gemini API Key" }), { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const cacheKey = `${companyName.toLowerCase().trim()}|${(prospectName || '').toLowerCase().trim()}`;
          
          let cachedResult = null;
          if (supabase) {
             try {
                 const { data, error } = await supabase
                    .from('outreach_cache')
                    .select('payload')
                    .eq('cache_key', cacheKey)
                    .single();
                 if (data && data.payload) {
                     cachedResult = data.payload;
                 }
             } catch (e) {
                 console.error("Supabase cache read error:", e);
             }
          }

          if (cachedResult) {
             // Fast-forward UI steps for a snappy experience
             sendEvent("step_update", { step: "search", status: "completed" });
             sendEvent("step_update", { step: "analyze", status: "completed" });
             sendEvent("step_update", { step: "pain_points", status: "completed" });
             sendEvent("step_update", { step: "research", status: "completed" });
             sendEvent("step_update", { step: "angle", status: "completed" });
             sendEvent("step_update", { step: "draft", status: "completed" });
             
             sendEvent("result", cachedResult);
             controller.close();
             return;
          }

          const ai = new GoogleGenAI({ apiKey });

          // Helper to handle rate limits and server overloads automatically
          const generateWithRetry = async (config: any) => {
            let attempt = 0;
            while (true) {
              try {
                return await ai.models.generateContent(config);
              } catch (err: any) {
                const errMsg = err.message || '';
                
                // Handle 429 Rate Limits
                if (err.status === 429 || errMsg.includes('429') || errMsg.includes('Quota exceeded')) {
                   if (attempt >= 3) throw err;
                   
                   let waitSeconds = 25;
                   const match = errMsg.match(/retry in ([\d\.]+)s/i);
                   if (match && match[1]) {
                       waitSeconds = Math.ceil(parseFloat(match[1])) + 2;
                   }
                   
                   if (waitSeconds > 15) {
                       throw new Error(`Google AI API rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`);
                   }
                   
                   await new Promise(r => setTimeout(r, waitSeconds * 1000));
                   attempt++;
                } 
                // Handle 503 Server Overload
                else if (err.status === 503 || errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
                   if (attempt >= 3) {
                       throw new Error("Google's AI servers are currently overloaded with high demand. Please try again in a few minutes.");
                   }
                   // Wait 3 seconds and try again
                   await new Promise(r => setTimeout(r, 3000));
                   attempt++;
                } 
                else {
                   throw err;
                }
              }
            }
          };

          // 0. Search Company
          sendEvent("step_update", { step: "search", status: "active" });
          let companyProfile: any = {
             website: null,
             linkedin: null,
             blog: null,
             documentation: null,
             news: null
          };

          if (websiteUrl && websiteUrl.trim().length > 0) {
             // Skip LLM search if user provided URL directly to save API requests!
             companyProfile.website = websiteUrl;
          } else {
             const searchPrompt = `You are an elite corporate research assistant. Find the official online presence for the company named "${companyName}".
CRITICAL RULES:
1. Do NOT guess, hallucinate, or assume URLs (especially LinkedIn profiles). 
2. If you are not 100% absolutely certain about the EXACT official URL, you MUST return null for that field.
3. It is better to return null than to return a fake or incorrect link.

Return ONLY raw JSON, with no markdown formatting, no backticks, and no explanations. Format strictly as JSON with exactly these keys: 
"website" (string | null), 
"linkedin" (string | null), 
"blog" (string | null), 
"documentation" (string | null), 
"news" (string | null)`;
             
             const searchResp = await generateWithRetry({
                 model: 'gemini-flash-latest',
                 contents: searchPrompt
             });
             
             const searchRaw = searchResp.text;
             if (!searchRaw) throw new Error("Failed to search company.");
             
             try {
                const cleanedRaw = searchRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                companyProfile = JSON.parse(cleanedRaw);
             } catch {
                throw new Error("Failed to parse company profile.");
             }
          }
          
          if (!companyProfile.website) {
             sendEvent("not_found", { message: `We couldn't find an official website or online presence for "${companyName}". Please verify the name or try a more specific search term.` });
             controller.close();
             return;
          }
          
          // Ensure URL has protocol for scraper
          if (!companyProfile.website.startsWith('http')) {
             companyProfile.website = 'https://' + companyProfile.website;
          }
          
          sendEvent("step_update", { step: "search", status: "completed" });

          // 1. Analyze Business & Live Search
          sendEvent("step_update", { step: "analyze", status: "active" });
          
          const scrapeJina = async () => {
             try {
                const fetchResponse = await fetch(`https://r.jina.ai/${companyProfile.website}`, {
                  headers: { "Accept": "text/plain", "User-Agent": "SalesOutreachAgent/1.0" }
                });
                if (!fetchResponse.ok) return "";
                const text = await fetchResponse.text();
                return text.slice(0, 5000);
             } catch { return ""; }
          };

          const scrapeDDG = async (query: string, maxResults: number) => {
             try {
                const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                   headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                const html = await res.text();
                const $ = cheerio.load(html);
                const results: string[] = [];
                $('.result__body').each((i, el) => {
                   if (i >= maxResults) return;
                   const title = $(el).find('.result__title').text().trim();
                   const snippet = $(el).find('.result__snippet').text().trim();
                   if (title && snippet) results.push(`- ${title}: ${snippet}`);
                });
                return results.join('\n');
             } catch { return ""; }
          };

          const [scrapeResult, liveNews, linkedinProfile] = await Promise.all([
             scrapeJina(),
             scrapeDDG(`"${companyName}" recent news (launch OR funding OR announced)`, 3),
             prospectName ? scrapeDDG(`site:linkedin.com/in/ "${prospectName}" "${companyName}"`, 2) : Promise.resolve("")
          ]);
          
          if (!scrapeResult || scrapeResult.length < 50) {
             throw new Error("Empty or insufficient text extracted from website. The site might be blocking scrapers.");
          }
          sendEvent("step_update", { step: "analyze", status: "completed" });

          // 2. Mega-Prompt: Identify Pain Points, Research Prospect, Choose Angle, Draft Email
          sendEvent("step_update", { step: "pain_points", status: "active" });
          sendEvent("step_update", { step: "research", status: "active" });
          sendEvent("step_update", { step: "angle", status: "active" });
          sendEvent("step_update", { step: "draft", status: "active" });
          
          const megaPrompt = `You are an elite B2B sales strategist. You write highly converting, ultra-personalized cold emails.
Target Company: ${companyName}
Prospect Name: ${prospectName || 'None provided'}
Prospect LinkedIn Context (if any): ${linkedinProfile || 'None'}

Real-Time News Context:
${liveNews || 'No recent news found.'}

Website Content:
${scrapeResult}

Your task is to synthesize this information and output a highly personalized cold email along with the strategic context.

CRITICAL RULES FOR EMAIL:
1. NO GENERIC FLUFF: Never use "Hope you're doing well", "I was impressed by", or similar meaningless openings.
2. THE "UN-COPYABLE" RULE: The first paragraph must be so highly specific to this exact company and prospect that it could not possibly be sent to anyone else.
3. PROBLEM-AGITATE-SOLVE: Mention one specific observation (from their news or website), explain why it matters to the prospect's likely role, and connect it to a likely business challenge they face.
4. BE CONCISE: Under 100 words. Natural tone. Soft call to action. Ensure flawless grammar.

Step A: Based on the News and Website, deduce their most likely recent initiatives. Summarize in 2-3 sentences.
Step B: Identify 3 specific, critical pain points they solve for customers OR operational pain points they likely experience internally.
Step C: Choose the SINGLE most compelling outreach angle based on the prospect's role and the news. Explain why.
Step D: Draft the cold email strictly following the CRITICAL RULES above.
Step E: Break down the exact logic of the drafted email into a transparent blueprint. You must provide exactly 5 reasoning blocks that explain why each sentence exists: 
  - Observation (e.g. "PostHog recently launched AI-powered product analytics.")
  - Reason (e.g. "Shows the email is based on something recent.")
  - Pain point (e.g. "AI adoption usually increases demo volume.")
  - Bridge (e.g. "Connects your product to scaling outreach.")
  - CTA (e.g. "Ask for a 15-minute call.")
Step F: Provide two short, casual follow-up emails (1-2 sentences each).

Return ONLY raw JSON, with no markdown formatting, no backticks, and no explanations. Format strictly as JSON with exactly these keys:
"research": (string, summary from Step A),
"painPoints": (string, output from Step B),
"explanation": (string, output from Step C),
"subject": (string, email subject from Step D),
"body": (string, email body from Step D),
"emailBreakdown": (array of 5 objects from Step E, each strictly with keys "type" and "content". "type" must be one of: Observation, Reason, Pain point, Bridge, CTA),
"followUps": (array of strings, emails from Step F)`;

          const megaResp = await generateWithRetry({
              model: 'gemini-flash-latest',
              contents: megaPrompt
          });
          
          const rawText = megaResp.text;
          if (!rawText) throw new Error("Failed to generate outreach strategy.");
          
          let finalOutput;
          try {
             const cleanedRaw = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
             finalOutput = JSON.parse(cleanedRaw);
          } catch (err) {
             throw new Error("Failed to parse the final outreach output. Raw text: " + rawText.slice(0, 100));
          }

          sendEvent("step_update", { step: "pain_points", status: "completed" });
          sendEvent("step_update", { step: "research", status: "completed" });
          sendEvent("step_update", { step: "angle", status: "completed" });
          sendEvent("step_update", { step: "draft", status: "completed" });

          const finalPayload = {
            subject: finalOutput.subject || "Missing Subject",
            body: finalOutput.body || "Missing Body",
            explanation: finalOutput.explanation || "Missing Explanation",
            emailBreakdown: finalOutput.emailBreakdown || [],
            followUps: finalOutput.followUps || [],
            painPoints: finalOutput.painPoints || "Missing Pain Points",
            research: finalOutput.research || "Missing Research",
            companyProfile: companyProfile
          };

          // Save to persistent cache
          if (supabase) {
             try {
                 await supabase
                    .from('outreach_cache')
                    .upsert({ cache_key: cacheKey, payload: finalPayload });
             } catch (e) {
                 console.error("Supabase cache write error:", e);
             }
          }

          // Send Final Result
          sendEvent("result", finalPayload);

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
