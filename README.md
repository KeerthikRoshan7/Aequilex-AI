<div align="center">
<h1>⚖️ AEQUILEX</h1>
<p><b>Next-Generation Legal Intelligence Platform</b></p>

</div>

Aequilex is an edge-to-edge, serverless web application that utilizes Retrieval-Augmented Generation (RAG), strict prompt-grounding, and Google's Gemini 2.5 architecture to automate legal research, document drafting, and multilingual translation.

Designed with a custom Cybersigilism x Liquid Gold aesthetic, Aequilex bridges the gap between traditional courtroom mechanics and ultra-modern legal tech.

✨ Core Modules

⚖️ Research Core: A highly specialized legal query engine. Features a proprietary "Strict Citation Mode" to eliminate AI hallucinations and ensure verifiable references to Indian case laws and the new BNS/BNSS codes.

✍️ Drafting Studio: An automated document generator. Processes raw client facts, audio dictations, and uploaded reference PDFs to instantly compile structured, court-ready templates (e.g., Bail Applications, Legal Notices, NDAs).

🌍 Translation Desk: High-fidelity legal text translation designed for regional Indian lower courts (Hindi, Tamil, Marathi), explicitly preserving complex terminology and Latin maxims.

📚 Knowledge Vault: A secure, B2B data-management solution. Features auto-archiving and 1-click clipboard extraction tied directly to specific Case Folders.

🛠️ Technology Stack

Aequilex is built for scale, low latency, and enterprise-grade security.

Frontend: Next.js (React App Router), Tailwind CSS, Lucide Icons

AI Engine: Google Gemini 2.5 Flash API (Multimodal: Text, Vision OCR, Audio WAV processing)

Database & Auth: Supabase (PostgreSQL) - Row Level Security (RLS) enabled

Markdown Parsing: Custom zero-dependency Regex AST parser ensuring zero-bloat browser rendering

🚀 Local Development Setup

To run Aequilex locally on your machine, follow these steps:

1. Clone the repository

git clone [https://github.com/yourusername/aequilex.git](https://github.com/yourusername/aequilex.git)
cd aequilex


2. Install dependencies

npm install @supabase/supabase-js lucide-react react-markdown


3. Environment Variables

Create a .env.local file in the root directory and add your secure keys. (Note: This file is ignored by Git for security).

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key


4. Toggle Development Mode

In src/app/page.jsx, ensure the database toggle is set to your live Supabase instance:

const IS_MOCK = false; 


5. Start the development server

npm run dev


Open http://localhost:3000 in your browser to view the application.

🔒 Security & Privacy

Aequilex implements secure JWT authentication via Supabase. User-uploaded files (PDFs, Images, Voice Memos) are processed transiently through encrypted API endpoints and are not utilized for public LLM training.

© 2026 Aequilex Intelligence. All Rights Reserved.
