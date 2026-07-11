const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const keyLine = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
if (!keyLine) {
  console.log('No GEMINI_API_KEY found');
  process.exit(1);
}
let key = keyLine.split('=')[1].trim();
if (key.startsWith('"') || key.startsWith("'")) key = key.slice(1, -1);

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({apiKey: key});

async function run() {
  try {
    const res = await ai.models.list();
    const arr = [];
    for await (const m of res) {
      arr.push(m.name);
    }
    console.log("ALL MODELS:");
    console.log(arr.join('\n'));
  } catch(e) {
    console.error(e);
  }
}
run();
