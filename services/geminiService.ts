import { GoogleGenAI, Modality, Type } from "@google/genai";
import { StudentProfile, TranslationResponse, ChatMessage, SenderType, GuideBookResponse, CommunicationOption } from "../types";

// Initialize Gemini Client
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing in process.env");
  }
  return new GoogleGenAI({ apiKey });
};

export const translateText = async (
  text: string,
  teacherName: string,
  student: StudentProfile,
  sender: SenderType
): Promise<TranslationResponse> => {
  const ai = getAiClient();
  const isEnglishToEnglish = student.language.toLowerCase().includes('english');
  
  let systemInstruction = '';

  if (sender === 'teacher') {
    if (isEnglishToEnglish) {
      // Neurodivergent Adaptation Prompt
      systemInstruction = `
        You are a Neurodiversity Communication Specialist assisting a teacher (${teacherName}).
        The student (${student.name}, ${student.age}yrs) speaks English but has specific neurodivergent needs.
        
        Student Profile & Sensitivities: ${student.sensitivities}

        Task:
        1. Adapt the teacher's message (English) into a version optimized for the student's processing style (English).
        2. IF the student is literal, remove idioms/sarcasm.
        3. IF the student has PDA (Pathological Demand Avoidance), use declarative language, invitations, or choices instead of commands.
        4. IF the student is anxious, use reassurance and clear structures.
        5. Return JSON: { "translation": string (The adapted English text), "culturalNote": string (Why this change helps) }.
      `;
    } else {
      // Standard Translation Prompt
      systemInstruction = `
        You are a compassionate, culturally sensitive translation assistant for a teacher (${teacherName}) communicating with a student (${student.name}, ${student.age}yrs, ${student.language}).
        
        Student Sensitivities: ${student.sensitivities}

        Task:
        1. Translate the teacher's message (English) into the student's language (${student.language}).
        2. Ensure the tone is friendly, encouraging, and age-appropriate.
        3. Provide a "culturalNote" if specific cultural context is needed or if you softened a phrase.
        4. Return JSON: { "translation": string, "culturalNote": string }.
      `;
    }
  } else {
    // Student is speaking
    if (isEnglishToEnglish) {
       // Neurodivergent Interpretation Prompt
       systemInstruction = `
        You are a Neurodiversity Specialist helping a teacher interpret a student's communication.
        Student: ${student.name}, ${student.age}, English speaker.
        Sensitivities: ${student.sensitivities}

        Task:
        1. "Translate" the student's message into its underlying intent or emotional meaning for the teacher.
        2. If the student is blunt, explain it's not rudeness but literalness.
        3. If the student refuses (e.g., "No"), check for sensory overwhelm or anxiety triggers in the context.
        4. Return JSON: { "translation": string (The interpreted intent in clear English), "culturalNote": string (Behavioral insight) }.
      `;
    } else {
      // Standard Interpretation Prompt
      systemInstruction = `
        You are an interpreter helping a student (${student.name}, ${student.age}yrs, ${student.language}) speak to their teacher (${teacherName}).

        Task:
        1. Translate the student's message (from ${student.language} or broken English) into clear, polite English for the teacher.
        2. Keep the child's voice/intent but make it understandable.
        3. Provide a "culturalNote" if the student used a specific cultural idiom or if the teacher should know something about *why* they said it that way.
        4. Return JSON: { "translation": string, "culturalNote": string }.
      `;
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: text,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translation: { type: Type.STRING, description: "The translated or adapted message." },
          culturalNote: { type: Type.STRING, description: "Explanation or insight." }
        },
        required: ["translation"]
      }
    }
  });

  const jsonText = response.text || "{}";
  try {
    return JSON.parse(jsonText) as TranslationResponse;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { translation: "Error processing message." };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export const generateGuideBook = async (
  student: StudentProfile,
  chats: ChatMessage[]
): Promise<GuideBookResponse> => {
  const ai = getAiClient();
  
  // Format chat history for context
  const chatHistory = chats.map(c => 
    `${c.sender.toUpperCase()}: "${c.originalText}" (Translation/Adaptation: "${c.translatedText}")`
  ).join('\n');

  const systemInstruction = `
    You are an expert educational consultant. 
    Analyze the following profile and chat history between a teacher and a student.
    
    Student: ${student.name}, ${student.age}, ${student.language}.
    Current Known Sensitivities: ${student.sensitivities}

    Chat History:
    ${chatHistory}

    Task:
    1. Create a "Guide Book" for the teacher. This should be a Markdown formatted text containing:
       - Communication Style: How the student prefers to communicate (e.g. Visual, Literal, Story-based).
       - Insights: Cultural or Neurodivergent specific insights.
       - Engagement Tips: How to best motivate this specific student based on past chats.
    
    2. Suggest an IMPROVED "Sensitivities" string. Merge the old sensitivities with new insights gained from the chat analysis. Keep it concise but comprehensive.

    Return JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using flash for analysis
    contents: "Analyze profile and chats.",
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          guide: { type: Type.STRING, description: "Markdown formatted guide book." },
          updatedSensitivities: { type: Type.STRING, description: "The revised sensitivities text." }
        },
        required: ["guide", "updatedSensitivities"]
      }
    }
  });

  const jsonText = response.text || "{}";
  try {
    return JSON.parse(jsonText) as GuideBookResponse;
  } catch (e) {
    return { 
      guide: "Could not generate guide.", 
      updatedSensitivities: student.sensitivities 
    };
  }
};

export const generateCommunicationOptions = async (
  intent: string,
  teacherName: string,
  student: StudentProfile,
  chats: ChatMessage[]
): Promise<CommunicationOption[]> => {
  const ai = getAiClient();
  const isEnglishToEnglish = student.language.toLowerCase().includes('english');

  // Get last 5 messages for context
  const recentContext = chats.slice(-5).map(c => `${c.sender}: ${c.originalText}`).join('\n');

  let systemInstruction = '';
  
  if (isEnglishToEnglish) {
    systemInstruction = `
      You are an expert Neurodiversity Communication Consultant.
      A teacher (${teacherName}) wants to convey an intent to a student (${student.name}, ${student.age}) who has specific communication needs.
      
      Student Sensitivities: ${student.sensitivities}
      Recent Context: ${recentContext}

      Teacher Intent: The teacher will provide what they WANT to say or achieve.
      Your goal: Provide 3 distinct strategies to rephrase this intent into language that works for the student's brain (e.g. avoiding demands for PDA, being literal for Autism).

      Task:
      Generate 3 distinct options. For each option:
      1. Strategy: A short label (e.g., "Declarative Language", "Interest-Based", "Visual Metaphor").
      2. English Text: What the teacher originally meant (Refined if needed).
      3. Translated Text: The ADAPTED English message the teacher should actually say.
      4. Reasoning: Why this adaptation lowers anxiety or improves understanding for this specific profile.
      
      Return JSON with an "options" array.
    `;
  } else {
    systemInstruction = `
      You are an expert pedagogical and cultural consultant.
      A teacher (${teacherName}) wants to convey an intent to a student (${student.name}, ${student.age}, ${student.language}).
      
      Student Sensitivities: ${student.sensitivities}
      Recent Context: ${recentContext}

      Teacher Intent: The teacher will provide their INTENT.
      Your goal: Provide 3 distinct approaches to convey this intent effectively and sensitively in the target language.

      Task:
      Generate 3 distinct options. For each option:
      1. Strategy: A short label (e.g., "Direct & Gentle", "Metaphorical", "Collaborative").
      2. English Text: What the teacher would effectively say in English.
      3. Translated Text: The translation in ${student.language}.
      4. Reasoning: Why this approach works for this specific student profile/culture.

      Return JSON with an "options" array.
    `;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Teacher Intent: "${intent}"`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique ID (1, 2, 3)" },
                strategy: { type: Type.STRING, description: "Strategy label" },
                englishText: { type: Type.STRING, description: "The message in English" },
                translatedText: { type: Type.STRING, description: "The message in target language/adaptation" },
                reasoning: { type: Type.STRING, description: "Why this works" }
              },
              required: ["id", "strategy", "englishText", "translatedText", "reasoning"]
            }
          }
        }
      }
    }
  });

  const jsonText = response.text || "{}";
  try {
    const parsed = JSON.parse(jsonText);
    return parsed.options || [];
  } catch (e) {
    console.error("Error parsing communication options", e);
    return [];
  }
};
