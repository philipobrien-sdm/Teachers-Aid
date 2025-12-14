# Teacher's Aid 🍎

**Teacher's Aid** is an intelligent, culturally sensitive communication bridge designed for modern classrooms. It helps teachers connect with students who face communication barriers, whether due to language differences (ESL/ELL) or neurodivergent processing styles (e.g., Autism, PDA).

Powered by **Google Gemini 2.5**, this app goes beyond simple translation. It prioritizes **intent**, **emotional tone**, and **pedagogical strategy** to ensure students feel understood and safe.

<img width="900" height="400" alt="Screenshot 2025-12-14 200335" src="https://github.com/user-attachments/assets/fb3ab1a5-f3c7-4956-8bbb-a9111c85e146" />
<img width="300" height="250" alt="Screenshot 2025-12-14 200345" src="https://github.com/user-attachments/assets/db0168bc-b989-430d-ac31-0bf99ee59898" />
<img width="300" height="250" alt="Screenshot 2025-12-14 200432" src="https://github.com/user-attachments/assets/0896e3bb-db5d-46a9-8aee-92e237c9467d" />
<img width="300" height="250" alt="Screenshot 2025-12-14 200420" src="https://github.com/user-attachments/assets/d558e369-8a9d-467d-ae2c-fe19a25c0774" />




## 🌟 Key Features

### 1. Bi-Directional Translation (ESL)
*   **Context-Aware:** Translates English to dozens of languages (Spanish, Japanese, Arabic, etc.) while preserving the teacher's gentle authority.
*   **Cultural Notes:** The AI provides "Cultural Notes" explaining *why* a student might be responding a certain way (e.g., avoiding eye contact due to cultural respect vs. defiance).

### 2. Neurodiversity Support (English-to-English)
*   **Communication Adaptation:** For English-speaking neurodivergent students, the AI acts as a communication specialist.
*   **Literal Interpretation:** Adapts idioms and sarcasm into literal language for students who struggle with abstract concepts.
*   **Demand Avoidance (PDA):** Rephrases direct commands into declarative language or choices to lower anxiety.

### 3. AI Assist & Strategy Selection
*   Instead of just translating text, teachers can input their **intent** (e.g., "I need him to stop running").
*   The AI generates **3 strategic options** (e.g., "Visual Metaphor", "Direct & Low Demand", "Collaborative") allowing the teacher to choose the best approach for that specific moment.

### 4. Dynamic Student Profiles & Guidebook
*   **Auto-Updating Profiles:** The AI analyzes chat history in the background to update the student's sensitivity profile.
*   **AI Guidebook:** Generates a "User Manual" for each student with engagement tips and communication preferences based on previous interactions.

### 5. Privacy First
*   **Local Storage:** All student data and chat history are stored in the browser's LocalStorage. No central database.
*   **Data Export:** Teachers can export/import backups of their class data.

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **AI Model:** Google Gemini 2.5 Flash (via `@google/genai` SDK)
*   **Audio:** Web Speech API & Gemini Native Audio (TTS)
*   **Icons:** Heroicons

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   A Google AI Studio API Key (Get it [here](https://aistudio.google.com/))

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/teachers-aid.git
    cd teachers-aid
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory (or configure your bundler's environment variables):
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

4.  **Run the application**
    ```bash
    npm start
    # or
    npm run dev
    ```

## 📖 Usage Guide

1.  **Create a Profile:** Open the sidebar or settings modal to add a student. Specify their language (e.g., "Spanish") or "English" with specific sensitivities (e.g., "Autism, loves trains").
2.  **Select a Student:** Click a student in the sidebar to begin a session.
3.  **Teacher Input:**
    *   *Direct Mode:* Type/Speak exactly what you want to say.
    *   *AI Assist Mode:* Toggle "AI Assist" to see strategic options before sending.
4.  **Student Input:** Switch the toggle to "Student" to translate their response back to English with behavioral insights.
5.  **Review Insights:** Click the "i" icon on messages to see why the AI chose a specific phrasing.

## ⚠️ Important Disclaimers

*   **Educational Aid Only:** This tool is designed to assist in classroom management and relationship building. It is **not** a substitute for professional medical advice, diagnosis, or certified legal interpretation.
*   **Human in the Loop:** AI models can hallucinate or misinterpret context. Teachers should always use their professional judgment when communicating critical information.

## 🔒 Privacy Note

This application sends text data to Google's Gemini API for processing. While Google states that data sent via the API is not used to train their models (for paid/enterprise tiers), users should adhere to their local school district's data privacy policies regarding AI usage.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
