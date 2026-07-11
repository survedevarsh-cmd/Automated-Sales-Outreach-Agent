const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let key = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY=')).split('=')[1].trim();
if (key.startsWith('"') || key.startsWith("'")) key = key.slice(1, -1);

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({apiKey: key});
ai.models.list().then(res => {
  const models = [...res].map(m => m.name);
  console.log("All Flash models:");
  console.log(models.filter(n => n.includes('flash')));
  console.log("All Pro models:");
  console.log(models.filter(n => n.includes('pro')));
}).catch(console.error);
