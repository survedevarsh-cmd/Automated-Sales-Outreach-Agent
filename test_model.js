const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const keyLine = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
let key = keyLine.split('=')[1].trim();
if (key.startsWith('"') || key.startsWith("'")) key = key.slice(1, -1);

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({apiKey: key});

async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'What is the stock price of Apple right exactly now today?',
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("SUCCESS:", res.text);
    console.log("Grounding Metadata:", JSON.stringify(res.candidates[0].groundingMetadata, null, 2));
  } catch(e) {
    console.error("ERROR:", e);
  }
}
run();
