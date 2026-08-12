
// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();

// // Middleware to parse incoming requests
// app.use(cors());
// app.use(express.json()); 
// app.use(express.static('.'));

// app.post('/api/generate-paragraph', async (req, res) => {
//   try {
//     console.log("-> Request received for new AI paragraph.");
    
//     // 1. Safe extraction (prevents crashes if request is empty)
//     const body = req.body || {};
//     const lang = body.lang === 'np' ? 'np' : 'en';
//     const difficulty = body.difficulty || 'medium';

//     // 2. Environment Variable Check
//     const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
//     if (!GEMINI_API_KEY) {
//       throw new Error("Server is missing the GEMINI_API_KEY in the .env file.");
//     }

//     // 3. Node.js Version Check
//     if (typeof fetch === 'undefined') {
//       throw new Error("Your Node.js version is too old (needs v18+). Please update Node.js to use built-in fetch.");
//     }

//     // 4. Set up the dynamic AI parameters
//     const TOPICS_EN = ['scientific exploration','Short story','E-governance', 'Office management', 'Civil service ethics', 'Federalism', 'Public finance'];
//     const TOPICS_NP = ['सार्वजनिक प्रशासन', 'निजामती सेवा', 'इ-गभर्नेन्स', 'सूचनाको हक', 'सङ्घीय संरचना'];
//     const topicList = lang === 'np' ? TOPICS_NP : TOPICS_EN;
//     const randomTopic = topicList[Math.floor(Math.random() * topicList.length)];
//     const randomSeed = Math.floor(Math.random() * 1000000);

//     const difficultyPrompts = {
//       en: {
//         easy: "Use simple, everyday vocabulary.",
//         medium: "Use standard administrative vocabulary.",
//         hard: "Use advanced formal terminology."
//       },
//       np: {
//         easy: "सरल शब्दहरू प्रयोग गर्नुहोस्।",
//         medium: "मध्यम स्तरको प्रशासनिक शब्दावली प्रयोग गर्नुहोस्।",
//         hard: "उच्च प्रशासनिक शब्दावली र जटिल वाक्य प्रयोग गर्नुहोस्।"
//       }
//     };

//     const diffInstruction = difficultyPrompts[lang][difficulty];
//     const prompt = lang === 'np' 
//       ? `विषय: "${randomTopic}" (Unique code: ${randomSeed})\nनेपालको लोकसेवा आयोगको परीक्षा तयारीका लागि देवनागरी लिपिमा ३०० देखि ४०० शब्दसम्मको एउटा नयाँ, मौलिक अनुच्छेद लेख्नुहोस्। कठिनाई स्तर: ${diffInstruction} अंग्रेजी शब्द, रोमन लिपि, शीर्षक वा भूमिका नलेख्नुहोस्।` 
//       : `Topic: "${randomTopic}" (Unique code: ${randomSeed})\nWrite a completely original paragraph in English, strictly 300 to 400 words long, in a formal administrative register. Difficulty: ${diffInstruction} Return ONLY the paragraph text itself, no title or quotes.`;

//     const MODEL_NAME = 'gemini-3.6-flash';
//     console.log(`Sending request to Google API (${lang}, ${difficulty})...`);

//     // 5. Connect to Google AI
//     const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-goog-api-key': GEMINI_API_KEY
//       },
//       body: JSON.stringify({
//         contents: [{ parts: [{ text: prompt }] }],
//         generationConfig: { temperature: 0.85 }
//       })
//     });

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}));
//       throw new Error(errorData.error?.message || `Google API Error: ${response.status}`);
//     }

//     const data = await response.json();
//     let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
//     text = text.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/\*\*/g, '').replace(/\r/g, '').trim();

//     if (!text) throw new Error('Gemini returned an empty response.');

//     console.log("Success! Sending paragraph to browser.");
//     return res.json({ paragraph: text });

//   } catch (error) {
//     // Log the error to the terminal
//     console.error("CRITICAL ERROR:", error.message);
//     // Send the EXACT error to the website UI
//     return res.status(500).json({ error: error.message || "Unknown internal server error" });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`\n=========================================`);
//   console.log(` Server running at http://localhost:${PORT}`);
//   console.log(`=========================================\n`);
// });

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json()); 
app.use(express.static('.'));

app.post('/api/generate-paragraph', async (req, res) => {
  try {
    console.log("-> Request received for new AI paragraph.");
    
    const body = req.body || {};
    const lang = body.lang === 'np' ? 'np' : 'en';
    const difficulty = body.difficulty || 'medium';

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("Server is missing the GEMINI_API_KEY in the .env file.");
    }

    if (typeof fetch === 'undefined') {
      throw new Error("Your Node.js version is too old (needs v18+). Please update Node.js to use built-in fetch.");
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
    let prompt = '';
    if (lang === 'np') {
      prompt = `(Seed: ${randomSeed})\nविषय: "${randomTopic}"\nकठिनाई स्तर: ${diffInstruction}\n\n`;
      if (isStory) {
        prompt += `उक्त विषयमा आधारित भई देवनागरी लिपिमा २५० देखि ३०० शब्दको एक रोचक कथा लेख्नुहोस्। कुनै शीर्षक वा भूमिका नलेख्नुहोस्।`;
      } else {
        prompt += `उक्त विषयमा देवनागरी लिपिमा २५० देखि ३०० शब्दको एउटा स्पष्ट र मौलिक अनुच्छेद लेख्नुहोस्। "सार्वजनिक प्रशासन..." वा "आजको युगमा..." जस्ता सामान्य वाक्यबाट सुरु नगर्नुहोस्। कुनै शीर्षक, बुलेट वा अंग्रेजी शब्द नलेख्नुहोस्।`;
      }
    } else {
      prompt = `(Seed: ${randomSeed})\nTopic: "${randomTopic}"\nDifficulty: ${diffInstruction}\n\n`;
      if (isStory) {
        prompt += `Write an engaging paragraph (250 to 300 words) in English telling a story on this topic. Do NOT write an administrative essay. Return ONLY the story text, no title or quotes.`;
      } else {
        prompt += `Write one completely original paragraph in English, strictly between 250 and 300 words long, explaining this topic clearly. Do NOT start with generic clichés like "In today's world..." or "Technology is...". Return ONLY the paragraph text, no title or quotes.`;
      }
    }

    const MODEL_NAME = 'gemini-3.6-flash';
    console.log(`Sending request to Google API (${lang}, ${difficulty}, Topic: ${randomTopic})...`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: isStory ? 0.95 : 0.85, // Higher creativity for stories
          topP: 0.95
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google API Error: ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/\*\*/g, '').replace(/\r/g, '').trim();

    if (!text) throw new Error('Gemini returned an empty response.');

    console.log("Success! Sending paragraph to browser.");
    return res.json({ paragraph: text });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return res.status(500).json({ error: error.message || "Unknown internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(` Server running at http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});