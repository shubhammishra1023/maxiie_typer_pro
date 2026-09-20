// api/generate-paragraph.js
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // 1. Ensure CORS allows requests from your frontend (Important for Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log("-> Request received for new AI paragraph on Vercel.");
    
    // Parse the body correctly depending on how the frontend sends it
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const lang = body.lang === 'np' ? 'np' : 'en';
    const difficulty = body.difficulty || 'medium';

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("Server is missing the GEMINI_API_KEY environment variable.");
    }

    // 1. TOPIC POOLS: Includes Administration, Computer Science, and Story/General Topics
    const TOPICS_EN = [
      // Computer & IT Topics
      'Computer hardware and central processing unit architecture',
      'Operating systems and file management fundamentals',
      'Database management systems and data security',
      'Computer networking, IP addresses, and the Internet',
      'Word processing, document formatting, and macros',
      'Spreadsheets, data sorting, and formula auditing',
      'Cybersecurity, malware protection, and encryption',
      'Cloud computing and virtual server environments',
      
      // Loksewa & Administrative Topics
      'E-governance and public digital services in Nepal',
      'Office record management, filing, and registration',
      'Civil service ethics and accountability',
      'Federalism and local government administration',
      'Public financial management and auditing',
      'Right to Information (RTI) implementation',

      // Creative & Story Topics
      'An engaging short story with dialogue and action',
      'A narrative story about overcoming a difficult challenge',
      'A short story about a busy day inside a modern office'
    ];

    const TOPICS_NP = [
      // Computer & IT Topics in Nepali
      'कम्प्युटर हार्डवेयर र सेन्ट्रल प्रोसेसिङ युनिट (CPU)',
      'अपरेटिङ सिस्टम र फाइल व्यवस्थापन',
      'डाटाबेस व्यवस्थापन प्रणाली र डाटा सुरक्षा',
      'कम्प्युटर नेटवर्किङ र इन्टरनेट प्रविधि',
      'वर्ड प्रोसेसिङ र कागजात ढाँचा',
      'स्प्रेडसिट अनुप्रयोग र गणितीय सूत्रहरू',
      'साइबर सुरक्षा र डाटा गोपनीयता',

      // Loksewa & Administrative Topics
      'सार्वजनिक प्रशासन र सुशासन',
      'निजामती सेवामा सदाचार र अनुशासन',
      'इ-गभर्नेन्स र डिजिटल सेवा प्रवाह',
      'सूचनाको हक र सार्वजनिक उत्तरदायित्व',
      'नेपालको सङ्घीय संरचना र स्थानीय तह',
      'कार्यालय अभिलेख व्यवस्थापन र दर्ता-चलानी',

      // Creative & Story Topics
      'एक रोचक छोटो कथा',
      'कार्यालयको व्यस्त दिनसम्बन्धी एक कथा',
      'सफलता र संघर्षको एक प्रेरणादायी कथा'
    ];

    const topicList = lang === 'np' ? TOPICS_NP : TOPICS_EN;
    const randomTopic = topicList[Math.floor(Math.random() * topicList.length)];
    const randomSeed = Math.floor(Math.random() * 1000000);

    // Detect if the topic is a story or standard technical/administrative topic
    const isStory = randomTopic.toLowerCase().includes('story') || randomTopic.includes('कथा');

    const difficultyPrompts = {
      en: {
        easy: "Use simple, clear vocabulary and straightforward sentences.",
        medium: "Use standard formal vocabulary and varied sentence lengths.",
        hard: "Use advanced, technical vocabulary and complex sentence structures."
      },
      np: {
        easy: "सरल र स्पष्ट शब्दहरू तथा छोटा वाक्यहरू प्रयोग गर्नुहोस्।",
        medium: "सामान्य परीक्षामा प्रयोग हुने मध्यम स्तरको शब्दावली प्रयोग गर्नुहोस्।",
        hard: "उच्च र जटिल शब्दावली तथा वाक्य संरचना प्रयोग गर्नुहोस्।"
      }
    };

    const diffInstruction = difficultyPrompts[lang][difficulty];

    // DYNAMIC PROMPT: Adjusts style automatically for stories vs. official/computer subjects
    // 120-150 words is the realistic examination length and reduces token expansion by 60-70%, lowering response latency to ~2-4s.
    let prompt = '';
    if (lang === 'np') {
      prompt = `(Seed: ${randomSeed})\nविषय: "${randomTopic}"\nकठिनाई स्तर: ${diffInstruction}\n\n`;
      if (isStory) {
        prompt += `उक्त विषयमा आधारित भई देवनागरी लिपिमा १२० देखि १५० शब्दको एक संक्षिप्त र रोचक कथा लेख्नुहोस्। कुनै शीर्षक, बुलेट वा भूमिका नलेख्नुहोस्। केवल कथाको अनुच्छेद दिनुहोस्।`;
      } else {
        prompt += `उक्त विषयमा देवनागरी लिपिमा १२० देखि १५० शब्दको एउटा स्पष्ट, शुद्ध र मौलिक परीक्षा-स्तरको अनुच्छेद लेख्नुहोस्। कुनै शीर्षक, बुलेट, नम्बरिङ वा अंग्रेजी शब्द नलेख्नुहोस्। केवल शुद्ध अनुच्छेद दिनुहोस्।`;
      }
    } else {
      prompt = `(Seed: ${randomSeed})\nTopic: "${randomTopic}"\nDifficulty: ${diffInstruction}\n\n`;
      if (isStory) {
        prompt += `Write an engaging, cohesive story paragraph (120 to 150 words) in English on this topic. Return ONLY the single paragraph text, no titles, quotes, or markdown.`;
      } else {
        prompt += `Write one completely original paragraph in English, strictly between 120 and 150 words long, explaining this topic clearly for an official typing test. Return ONLY the single paragraph text, no titles, quotes, or markdown.`;
      }
    }

    const startTime = Date.now();
    console.log(`Generating paragraph with Gemini (${lang}, ${difficulty}, Topic: ${randomTopic})...`);

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: isStory ? 0.9 : 0.8,
        topP: 0.95,
        maxOutputTokens: 850
      }
    });

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    let text = response.text || '';
    text = text.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/\*\*/g, '').replace(/\r/g, '').trim();

    if (!text) throw new Error('Gemini returned an empty response.');

    console.log(`Success in ${elapsedSec}s! Sending paragraph (${text.split(/\s+/).length} words) to browser.`);
    return res.status(200).json({ paragraph: text, topic: randomTopic, elapsedSec });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return res.status(500).json({ error: error.message || "Unknown internal server error" });
  }
}