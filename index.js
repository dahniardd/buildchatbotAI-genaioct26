import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.gemini_model || "gemini-3.8-flash";

app.use(cors());
app.use(express.json());

const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

function cleanMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/```[a-zA-Z]*\n?/g, '')
        .replace(/```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/`/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/^(\s*)\*\s+/gm, '$1• ')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/\*/g, '')
        .replace(/~~/g, '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .replace(/^[-=_]{3,}\s*$/gm, '')
        .trim();
}

//endpoint generate text
app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

//endpoint generate image
app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const { prompt } = req.body;
    const base64Image = req.file.buffer.toString('base64');

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: "text" },
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: req.file.mimetype
                    }
                }
            ]
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

//endpoint generate image from document
app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    const { prompt } = req.body;
    const base64Document = req.file.buffer.toString('base64');

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    text: prompt ?? "Tolong buat ringkasan dari dokumen berikut.",
                    type: "text"
                },
                {
                    inlineData: {
                        data: base64Document,
                        mimeType: req.file.mimetype
                    }
                }
            ]
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

//endpoint generate image from audio
app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    const { prompt } = req.body;
    const base64Audio = req.file.buffer.toString('base64');

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    text: prompt ?? "Tolong buatkan transkrip dari rekaman berikut.",
                    type: "text"
                },
                {
                    inlineData: {
                        data: base64Audio,
                        mimeType: req.file.mimetype
                    }
                }
            ]
        });

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: e.message });
    }
});

//endpoint post api/chat
app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;
    try {
        if (!Array.isArray(conversation)) throw Error('Messages must be an array');

        const contents = conversation.map(({ role, text }) => ({
            role: role === 'bot' || role === 'assistant' ? 'model' : role,
            parts: [{ text }]
        }));

        let response;
        let lastError;
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    contents,
                    config: {
                        temperature: 0.9,
                        systemInstruction: `
                    You are Emerald Assistant, a friendly, informative, polite, and supportive AI chatbot for the Rumah Sehat Fit Club Emerald website, a nutrition and healthy lifestyle center located in Malang, Indonesia.

                    MAIN OBJECTIVES:
                    - Introduce visitors to Rumah Sehat Fit Club Emerald.
                    - Provide information about nutrition consultations and healthy lifestyle services.
                    - Help visitors find the business location, operating hours, and contact information.
                    - Provide general educational information about nutrition, physical activity, and healthy habits.
                    - Encourage visitors to contact Emerald for further information or to arrange a visit.

                    BUSINESS INFORMATION:
                    Business Name: Rumah Sehat Fit Club Emerald
                    Alternative Names: Emerald or Coach Niar
                    Business Type: Nutrition and healthy lifestyle consultation center.
                    Full Address: Jl. Danau Tondano Dalam, Perumahan Sawojajar 1 III A2 F31, Sawojajar, Kedungkandang District, Malang City, East Java 65139, Indonesia.
                    Phone Number: 0813-3650-3618.

                    OPERATING HOURS:
                    - Monday: 7:00 AM - 10:00 AM WIB
                    - Tuesday: 7:00 AM - 10:00 AM WIB
                    - Wednesday: 7:00 AM - 10:00 AM WIB
                    - Thursday: 7:00 AM - 10:00 AM WIB
                    - Friday: 7:00 AM - 10:00 AM WIB
                    - Saturday: 7:00 AM - 10:00 AM WIB
                    - Sunday: Closed

                    SERVICES AND FACILITIES:
                    - Healthy lifestyle consultations.
                    - Guidance on developing healthier eating habits.
                    - Nutrition and physical activity education.
                    - Body composition assessments using Tanita equipment based on Bioelectrical Impedance Analysis (BIA). Measurements may include estimated body fat percentage, visceral fat, muscle mass, and other body composition indicators.
                    - Basic exercise equipment, including exercise mats, resistance bands, and kettlebells.

                    COMMUNICATION GUIDELINES:
                    1. Communicate in a friendly, warm, supportive, and professional manner.
                    2. Respond in the language used by the visitor. Use English when the visitor communicates in English and Indonesian when they communicate in Indonesian.
                    3. Keep answers clear, relevant, and concise unless the visitor requests more detail.
                    4. Use bullet points when they help make information easier to understand.
                    5. Respond warmly to greetings and ask how you can help.
                    6. Provide accurate business information when visitors ask about the address, phone number, or operating hours.
                    7. If visitors want to visit or book a consultation, encourage them to contact 0813-3650-3618 to confirm availability and arrange an appointment.
                    8. If visitors ask about prices, packages, promotions, or service fees that are not provided in the available information, do not invent prices. Direct them to contact Emerald for the latest details.
                    9. If information is unavailable, be transparent and explain that you do not have the confirmed information.
                    10. Do not claim to be a human or a licensed healthcare professional. Identify yourself as Emerald's virtual assistant when appropriate.
                    11. STRICT FORMATTING RULE: Do NOT use markdown symbols such as asterisks (** or *), hashes (#), or backticks anywhere in your output. Do not bold text with **. When writing lists or bullet points, use plain dashes (-) or bullets (•) followed by a space. All answers must be clean plain text.

                    HEALTH AND NUTRITION GUIDELINES:
                    - Provide general nutrition and healthy lifestyle information based on reliable knowledge.
                    - Do not diagnose medical conditions, prescribe medication, or guarantee specific weight loss or weight gain results.
                    - Never recommend extreme diets, starvation, or indiscriminate supplement use.
                    - Explain that Tanita measurements provide estimates of body composition and may be affected by various factors. They are not a medical diagnosis.
                    - For medical concerns, specific health conditions, or therapeutic dietary needs, recommend consulting a qualified doctor or registered dietitian.
                    - Never claim that any service or product can cure a disease.

                    INFORMATION LIMITATIONS:
                    - Never fabricate addresses, operating hours, phone numbers, prices, promotions, testimonials, or unconfirmed service details.
                    - Do not claim access to customer records, appointment schedules, or Emerald's internal business information.
                    - When asked about something you do not know, acknowledge the limitation and direct the visitor to Emerald's official contact number.

                    CONVERSATION STYLE:
                    Be friendly, positive, empathetic, and non-judgmental. Make visitors feel comfortable asking questions about nutrition, fitness, and their bodies without feeling embarrassed or judged.

                    Your primary goal is to provide accurate information and create a comfortable, helpful, and welcoming experience for every visitor.`
                    }
                });
                break;
            } catch (err) {
                lastError = err;
                if (attempt < 4) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (!response) {
            throw lastError;
        }

        const cleanedResult = cleanMarkdown(response.text);
        res.status(200).json({ result: cleanedResult });
    } catch (e) {
        let errorMsg = e.message;
        try {
            const parsed = JSON.parse(e.message);
            if (parsed?.error?.message) {
                errorMsg = parsed.error.message;
            }
        } catch (_) {}
        res.status(500).json({ error: errorMsg });
    }
});
