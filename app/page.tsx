"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Mic, Send, FolderPlus, RefreshCw, LogOut, Scale, FileText, Globe, BookOpen, Upload, Archive, Copy, ChevronDown, Check, Trash2, X, Square } from 'lucide-react';

// =========================================================================
// ☁️ CLOUD PRODUCTION SETUP ☁️
// =========================================================================
import { createClient } from '@supabase/supabase-js'; // UNCOMMENT THIS FOR GITHUB/VERCEL

// Helper to safely copy text in iFrame and secure environments
const copyToClipboard = (text: string, callback?: (status: boolean) => void) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    if (callback) {
      callback(true);
      setTimeout(() => callback(false), 2000);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  document.body.removeChild(textArea);
};

// =========================================================================
// CONFIGURATION (PRODUCTION)
// =========================================================================
const SUPABASE_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL : "";
const SUPABASE_ANON_KEY = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : "";
const GEMINI_API_KEY = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GEMINI_API_KEY ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : "";

// LIVE MODE: Connected to your real Supabase Database
const IS_MOCK = false; // SET THIS TO false FOR GITHUB/VERCEL

// =========================================================================
// DATABASE CLIENT INITIALIZATION
// =========================================================================
const createMockClient = () => {
  const mockStorage: any = { users: [], workspaces: [], chats: [], spaces: [] };
  return {
    from: (table: string) => {
      let queryResult = [...(mockStorage[table] || [])];
      const chain: any = {
        select: () => chain,
        insert: (data: any[]) => { 
          const newItems = data.map(d => ({...d, id: Date.now() + Math.random()}));
          mockStorage[table].push(...newItems); 
          queryResult = newItems; 
          return chain; 
        },
        delete: () => { mockStorage[table] = []; return chain; },
        eq: (k: string, v: any) => { queryResult = queryResult.filter((item: any) => item[k] === v); return chain; },
        order: () => chain,
        single: async () => ({ data: queryResult[0] || null, error: queryResult[0] ? null : new Error("Invalid token or key.") }),
        then: (cb: any) => cb({ data: queryResult, error: null })
      };
      return chain;
    }
  };
};

// @ts-ignore
const supabase = IS_MOCK ? createMockClient() : (typeof createClient !== 'undefined' ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : createMockClient());

// Lightweight Markdown Parser
const parseMarkdown = (md: string) => {
  if (!md) return { __html: "" };
  let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  return { __html: html };
};

// Utility to replicate Python's hashlib.sha256().hexdigest()
async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility to convert Files to Base64 for Gemini API
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result as string;
      encoded = encoded.split(',')[1];
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });
};

// Advanced WAV Converter for Flawless Audio Processing with Gemini
const convertToWavBase64 = async (webmBlob: Blob): Promise<string> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let pos = 0;
  
  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
  
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(audioBuffer.sampleRate);
  setUint32(audioBuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);
  
  const channels = [];
  for (let i = 0; i < numOfChan; i++) channels.push(audioBuffer.getChannelData(i));
  
  let offset = 0;
  while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
          let sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true);
      }
      offset++;
  }
  
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeModule, setActiveModule] = useState('Research Core');
  const [workspaces, setWorkspaces] = useState<any[]>([{ id: 0, name: 'General Workspace' }]);
  const [currentWorkspace, setCurrentWorkspace] = useState<any>({ id: 0, name: 'General Workspace' });
  
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Audiowide&family=Syne:wght@700;800&family=Rajdhani:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap');
      
      .font-audiowide { font-family: 'Audiowide', sans-serif; letter-spacing: 0.05em; }
      .font-syne { font-family: 'Syne', sans-serif; font-weight: 800; }
      .font-heading { font-family: 'Rajdhani', sans-serif; font-weight: 700; }
      .font-inter { font-family: 'Inter', sans-serif; }
      
      .cyber-text {
          background: linear-gradient(135deg, #D946EF 0%, #8B5CF6 50%, #4C1D95 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
          text-shadow: 0 0 20px rgba(217, 70, 239, 0.4);
      }
      
      @keyframes formCascade { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
      .anim-cascade-1 { opacity: 0; animation: formCascade 0.8s ease-out 0.5s forwards; }
      .anim-cascade-2 { opacity: 0; animation: formCascade 0.8s ease-out 0.7s forwards; }
      
      /* Logo Specific Animations (Zodiac Dial) */
      @keyframes spin { 100% { transform: rotate(360deg); } }
      @keyframes cyberAssembleLeft { 0% { transform: translateX(-40px) translateY(-20px); opacity: 0; filter: blur(5px); } 100% { transform: translateX(0) translateY(0); opacity: 1; filter: blur(0); } }
      @keyframes cyberAssembleRight { 0% { transform: translateX(40px) translateY(20px); opacity: 0; filter: blur(5px); } 100% { transform: translateX(0) translateY(0); opacity: 1; filter: blur(0); } }
      
      .spin-slow { animation: spin 20s linear infinite; transform-origin: 50px 50px; }
      .anim-left { animation: cyberAssembleLeft 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      .anim-right { animation: cyberAssembleRight 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      
      /* Markdown Formatting */
      .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-family: 'Rajdhani', sans-serif; color: #D946EF; margin-top: 1.2em; margin-bottom: 0.6em; font-weight: 700; letter-spacing: 1px;}
      .markdown-body h1 { font-size: 1.6em; border-bottom: 1px solid rgba(217, 70, 239, 0.3); padding-bottom: 5px; }
      .markdown-body h2 { font-size: 1.3em; }
      .markdown-body p { margin-bottom: 1em; line-height: 1.6; }
      .markdown-body strong { color: #D4AF37; }
      .markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
      .markdown-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
      .markdown-body li { margin-bottom: 0.3em; }

      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.6); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const fetchWorkspaces = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('workspaces').select('id, name').eq('email', user.email).order('created_at', { ascending: false });
    if (!error && data) setWorkspaces([{ id: 0, name: 'General Workspace' }, ...data]);
  };

  useEffect(() => { fetchWorkspaces(); }, [user]);

  if (!user) return <LoginScreen onLogin={(u: any) => setUser(u)} />;

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] font-inter flex overflow-hidden">
      <Sidebar 
        user={user} 
        onLogout={() => setUser(null)} 
        activeModule={activeModule} 
        setActiveModule={setActiveModule}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        setCurrentWorkspace={setCurrentWorkspace}
        refreshWorkspaces={fetchWorkspaces}
      />
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {activeModule === 'Research Core' && <ResearchCore user={user} currentWorkspace={currentWorkspace} />}
        {activeModule === 'Drafting Studio' && <DraftingStudio user={user} />}
        {activeModule === 'Translate Desk' && <TranslateDesk user={user} />}
        {activeModule === 'Knowledge Vault' && <KnowledgeVault user={user} currentWorkspace={currentWorkspace} />}
      </main>
    </div>
  );
}

// ==========================================
// HARDWARE HOOK: Audio Recorder
// ==========================================
function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied. Please allow microphone permissions in your browser.");
    }
  };

  const stopRecording = (): Promise<any> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) return;
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
            const base64Wav = await convertToWavBase64(audioBlob);
            setIsRecording(false);
            mediaRecorderRef.current?.stream.getTracks().forEach((track: any) => track.stop());
            resolve({ name: 'voice_memo.wav', mimeType: 'audio/wav', data: base64Wav });
        } catch (err) {
            console.error("Audio conversion error:", err);
        }
      };
      
      mediaRecorderRef.current.stop();
    });
  };

  return { isRecording, startRecording, stopRecording };
}

// ==========================================
// 1. RESEARCH CORE
// ==========================================
function ResearchCore({ user, currentWorkspace }: { user: any, currentWorkspace: any }) {
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<any>(null);
  
  const [tone, setTone] = useState('Professional');
  const [depth, setDepth] = useState('Detailed');
  const [autoArchive, setAutoArchive] = useState('None');
  const [strictCitation, setStrictCitation] = useState(true);

  const messagesEndRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const loadHistory = async () => {
    const { data } = await supabase.from('chats').select('id, role, content').eq('email', user.email).eq('workspace_id', currentWorkspace.id).order('id', { ascending: true });
    if (data) setChat(data);
  };

  useEffect(() => { loadHistory(); }, [currentWorkspace.id]);
  useEffect(() => scrollToBottom(), [chat, isLoading]);

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Data = await fileToBase64(file);
      setAttachedFile({ name: file.name, mimeType: file.type, data: base64Data });
    } catch (err) { alert("Error reading file."); }
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      const audioFile = await stopRecording();
      setAttachedFile(audioFile);
    } else {
      startRecording();
    }
  };

  const archiveMessage = async (content: string) => {
    await supabase.from('spaces').insert([{ 
      email: user.email, 
      category: 'Research', 
      query: 'Archived directly from Chat', 
      response: content, 
      workspace_id: currentWorkspace.id, 
      timestamp: new Date().toISOString() 
    }]);
    alert("Saved successfully to Knowledge Vault!");
  };

  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!input.trim() && !attachedFile) return;

    let queryText = input;
    if (attachedFile && !input.trim()) queryText = "Please analyze the attached context.";

    const tempId = Date.now();
    const userMsg = { id: tempId, role: 'user', content: queryText + (attachedFile ? `\n\n[Attached: ${attachedFile.name}]` : '') };
    setChat(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    await supabase.from('chats').insert([{ email: user.email, role: 'user', content: userMsg.content, workspace_id: currentWorkspace.id, timestamp: new Date().toISOString() }]);

    let parts: any[] = [{ text: `User Query: ${queryText}` }];
    if (attachedFile) {
      parts.push({ inlineData: { mimeType: attachedFile.mimeType, data: attachedFile.data } });
    }

    let sysPrompt = `You are AEQUILEX, an elite legal AI for ${user.institution}. Tone: ${tone}. Depth: ${depth}. Format in Markdown. You HAVE FULL multimodal capabilities. You CAN analyze the attached audio and documents perfectly. DO NOT claim you cannot process files.`;
    if (strictCitation) sysPrompt += " CRITICAL RULE: ONLY cite real, verifiable Indian case laws. Do not hallucinate.";

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [...chat.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{text: m.content}]})), { role: 'user', parts: parts }],
          systemInstruction: { parts: [{ text: sysPrompt }] }
        })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message); 
      
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error processing query.";
      setChat(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: aiText }]);
      
      await supabase.from('chats').insert([{ email: user.email, role: 'assistant', content: aiText, workspace_id: currentWorkspace.id, timestamp: new Date().toISOString() }]);

      if (autoArchive !== 'None' && !aiText.includes("❌")) {
          await supabase.from('spaces').insert([{ 
            email: user.email, 
            category: autoArchive, 
            query: queryText, 
            response: aiText, 
            workspace_id: currentWorkspace.id, 
            timestamp: new Date().toISOString() 
          }]);
      }

    } catch (error) {
      console.error("Gemini API Error:", error);
      setChat(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `❌ API Error: Ensure your GEMINI_API_KEY is set correctly.` }]);
    } finally {
      setIsLoading(false);
      setAttachedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearHistory = async () => {
    await supabase.from('chats').delete().eq('email', user.email).eq('workspace_id', currentWorkspace.id);
    setChat([]);
  };

  return (
    <div className="flex flex-col h-full relative">
      <header className="absolute top-0 w-full z-10 bg-[#050505]/90 backdrop-blur-md border-b border-[#D4AF37]/15 p-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-wider text-white">RESEARCH CORE</h2>
          <div className="h-[1px] w-20 bg-gradient-to-r from-[#D4AF37] to-transparent mt-2"></div>
        </div>
        <div className="flex gap-3 relative">
          <button onClick={clearHistory} className="px-4 py-2 bg-transparent border border-[#94A3B8]/30 rounded text-[#94A3B8] hover:text-red-400 hover:border-red-400/50 transition-all text-xs font-bold tracking-widest uppercase">
            Clear Logs
          </button>
          <button onClick={() => setShowParams(!showParams)} className={`flex items-center gap-2 px-4 py-2 bg-[#0A0A0B] border rounded transition-all text-sm font-semibold ${showParams ? 'border-[#D946EF] text-[#D946EF]' : 'border-[#D4AF37]/20 text-[#94A3B8] hover:text-[#D946EF] hover:border-[#D946EF]/50'}`}>
            <Settings size={16} /> Parameters
          </button>

          {showParams && (
            <div className="absolute top-full mt-2 right-0 w-80 bg-[#0A0A0B] border border-[#8B5CF6]/50 rounded-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50">
               <h4 className="text-white font-heading font-bold mb-4 border-b border-[#333] pb-2 uppercase tracking-widest">AI Grounding Config</h4>
               <div className="mb-4">
                 <label className="block text-[10px] font-bold text-[#94A3B8] mb-1 uppercase tracking-widest">Output Tone</label>
                 <select value={tone} onChange={(e)=>setTone(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 text-white rounded p-2 text-sm outline-none focus:border-[#8B5CF6]">
                    <option>Professional</option><option>Academic</option><option>Casual</option>
                 </select>
               </div>
               <div className="mb-4">
                 <label className="block text-[10px] font-bold text-[#94A3B8] mb-1 uppercase tracking-widest">Analysis Depth</label>
                 <select value={depth} onChange={(e)=>setDepth(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 text-white rounded p-2 text-sm outline-none focus:border-[#8B5CF6]">
                    <option>Detailed</option><option>Summary</option><option>Bare Act</option>
                 </select>
               </div>
               <div className="mb-4">
                 <label className="block text-[10px] font-bold text-[#94A3B8] mb-1 uppercase tracking-widest">Auto-Archive To Vault</label>
                 <select value={autoArchive} onChange={(e)=>setAutoArchive(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 text-white rounded p-2 text-sm outline-none focus:border-[#8B5CF6]">
                    <option>None</option><option>Research</option><option>Paper</option><option>Study</option>
                 </select>
               </div>
               <div className="flex items-center gap-3 pt-2 border-t border-[#333] mt-2 pt-4">
                 <button onClick={()=>setStrictCitation(!strictCitation)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${strictCitation ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]' : 'bg-[#0F0F11] border-[#333]'}`}>
                   {strictCitation && <Check size={14} className="text-[#D946EF]"/>}
                 </button>
                 <span className="text-xs font-semibold text-[#E2E8F0]">Strict Citation Mode</span>
               </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-32 pb-40">
        {chat.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] opacity-50">
            <Scale size={64} className="mb-4" />
            <p className="text-lg uppercase tracking-widest font-semibold">System Standing By</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {chat.map((msg, idx) => (
              <div key={idx} className={`p-6 rounded-xl border ${msg.role === 'user' ? 'bg-[#0A0A0B] border-[#D4AF37]/20' : 'bg-purple-900/5 border-[#8B5CF6]/20'} group relative`}>
                
                {msg.role === 'assistant' && (
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex gap-2 transition-all bg-[#0F0F11] p-1.5 rounded-lg border border-[#333]">
                    <button onClick={() => copyToClipboard(msg.content, (state) => setCopiedId(state ? msg.id : null))} className="text-[#94A3B8] hover:text-[#D4AF37] p-1.5 rounded transition-colors" title="Copy Text">
                      {copiedId === msg.id ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
                    </button>
                    <button onClick={() => archiveMessage(msg.content)} className="text-[#94A3B8] hover:text-[#D4AF37] p-1.5 rounded transition-colors" title="Save to Knowledge Vault">
                      <Archive size={14} />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center border ${msg.role === 'user' ? 'bg-black border-[#D4AF37] text-[#D4AF37]' : 'bg-black border-[#8B5CF6] text-[#8B5CF6]'}`}>
                    {msg.role === 'user' ? <span className="text-sm">🧑‍⚖️</span> : <span className="text-sm">⚡</span>}
                  </div>
                  <span className="font-semibold text-sm tracking-widest uppercase text-[#94A3B8]">
                    {msg.role === 'user' ? 'YOU' : 'Aequilex AI'}
                  </span>
                </div>
                <div 
                  className="text-[#E2E8F0] leading-relaxed whitespace-pre-wrap markdown-body"
                  dangerouslySetInnerHTML={parseMarkdown(msg.content)}
                />
              </div>
            ))}
            {isLoading && (
              <div className="p-6 rounded-xl border bg-purple-900/5 border-[#8B5CF6]/20 animate-pulse flex gap-3 items-center">
                 <div className="w-8 h-8 rounded bg-black border border-[#8B5CF6] flex items-center justify-center"><span className="text-sm">⚡</span></div>
                 <div className="text-[#8B5CF6] text-sm tracking-widest uppercase font-semibold">Synthesizing...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#050505] via-[#050505] p-6 pb-8">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex flex-col gap-2">
          
          {attachedFile && (
            <div className="flex items-center justify-between bg-purple-900/20 border border-[#8B5CF6]/30 px-4 py-2 rounded-lg text-xs font-bold text-[#E2E8F0] uppercase tracking-wider w-max">
              <span className="flex items-center gap-2">
                {attachedFile.mimeType.includes('audio') ? <Mic size={14} className="text-[#D946EF]"/> : <FileText size={14} className="text-[#D946EF]"/>} 
                {attachedFile.name}
              </span>
              <button type="button" onClick={()=>setAttachedFile(null)} className="ml-4 text-red-400 hover:text-red-300"><X size={14}/></button>
            </div>
          )}

          <div className="relative">
            <input 
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Recording voice memo..." : "Enter legal query, section, citation, or attach context..."}
              className={`w-full bg-[#0F0F11] border ${isRecording ? 'border-[#D946EF] shadow-[0_0_15px_rgba(217,70,239,0.2)]' : 'border-[#D4AF37]/20 focus:border-[#8B5CF6]'} focus:ring-1 focus:ring-[#8B5CF6]/30 text-white rounded-lg p-4 pr-32 transition-all outline-none shadow-lg`}
              disabled={isLoading || isRecording}
            />
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
            
            <div className="absolute right-2 top-2 flex gap-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-[#94A3B8] hover:text-[#D4AF37] transition-colors" title="Attach PDF or Image"><Upload size={20} /></button>
              
              <button type="button" onClick={handleMicToggle} className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-[#94A3B8] hover:text-[#D946EF]'}`} title="Voice Dictation">
                {isRecording ? <Square size={20} /> : <Mic size={20} />}
              </button>
              
              <button type="submit" disabled={isLoading || isRecording} className="p-2 bg-[#8B5CF6]/10 text-[#D946EF] rounded hover:bg-[#8B5CF6]/20 transition-colors disabled:opacity-50"><Send size={20} /></button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. DRAFTING STUDIO
// ==========================================
function DraftingStudio({ user }: { user: any }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResult, setDraftResult] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [docType, setDocType] = useState('Legal Notice (General)');
  const [client, setClient] = useState('');
  const [opposing, setOpposing] = useState('');
  const [facts, setFacts] = useState('');
  
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const fileInputRef = useRef<any>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Data = await fileToBase64(file);
      setAttachedFile({ name: file.name, mimeType: file.type, data: base64Data });
    } catch (err) { alert("Error reading file."); }
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      const audioFile = await stopRecording();
      setAttachedFile(audioFile);
    } else {
      startRecording();
    }
  };

  const handleDraft = async () => {
    if (!facts.trim() && !attachedFile) return;
    setIsGenerating(true);
    setDraftResult('');

    let parts = [{ text: `Draft a ${docType} for client: ${client}, opposing party: ${opposing}. Facts: ${facts}` }];
    if (attachedFile) parts.push({ inlineData: { mimeType: attachedFile.mimeType, data: attachedFile.data } });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: parts }],
          systemInstruction: { parts: [{ text: "You are an expert Legal Draftsman in India. Generate a highly formal, court-ready draft. Do not include conversational filler. You CAN process the attached files and audio." }] }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      setDraftResult(data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating draft.");
    } catch (err) {
      console.error(err);
      setDraftResult(`❌ API Error: Ensure GEMINI_API_KEY is set.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 overflow-y-auto relative">
      <div className="mb-8 shrink-0">
        <h2 className="text-3xl font-heading font-bold tracking-wider text-white">DRAFTING STUDIO</h2>
        <div className="h-[1px] w-20 bg-gradient-to-r from-[#D4AF37] to-transparent mt-2"></div>
        <p className="text-[#94A3B8] mt-4 font-semibold text-sm uppercase tracking-wider">Automated generation of court-ready documents.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <div className="bg-[#0A0A0B] border border-[#D4AF37]/20 rounded-xl p-8 shadow-xl flex flex-col gap-6 h-fit">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 relative">
              <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Document Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 text-white rounded p-3 outline-none focus:border-[#8B5CF6] cursor-pointer appearance-none">
                <option>Legal Notice (General)</option>
                <option>138 NI Act Notice</option>
                <option>Non-Disclosure Agreement</option>
                <option>Bail Application (BNSS)</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-10 text-[#D4AF37]" pointerEvents="none"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Reference</label>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`w-full flex items-center justify-center gap-2 bg-[#0F0F11] border rounded p-3 transition-colors ${attachedFile && !attachedFile.mimeType.includes('audio') ? 'border-[#8B5CF6] text-[#D946EF]' : 'border-[#D4AF37]/20 text-[#94A3B8] hover:border-[#D946EF] hover:text-[#D946EF]'}`}>
                {attachedFile && !attachedFile.mimeType.includes('audio') ? <Check size={16}/> : <Upload size={16} />} 
                {attachedFile && !attachedFile.mimeType.includes('audio') ? 'Attached' : 'File'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Client Name</label>
              <input type="text" value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g., Ramesh Kumar" className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded p-3 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Opposing Party</label>
              <input type="text" value={opposing} onChange={(e) => setOpposing(e.target.value)} placeholder="e.g., State Bank of India" className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded p-3 outline-none transition-colors" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Core Facts & Timeline</label>
              <button onClick={handleMicToggle} className={`transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-[#D946EF] hover:text-white'}`}>
                {isRecording ? <Square size={16}/> : <Mic size={16}/>}
              </button>
            </div>
            <textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={6} placeholder={isRecording ? "Recording voice memo..." : "Explain the primary incident, dates, and amounts involved..."} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded p-3 outline-none transition-colors resize-none"></textarea>
            {attachedFile?.mimeType.includes('audio') && <p className="text-xs text-[#D946EF] mt-2 flex items-center gap-1"><Check size={12}/> Audio Dictation Attached</p>}
          </div>

          <button onClick={handleDraft} disabled={isGenerating || (!facts.trim() && !attachedFile)} className="w-full py-4 mt-auto bg-gradient-to-r from-[#111] to-[#0A0A0B] border border-[#D4AF37]/50 text-[#D4AF37] font-heading font-bold tracking-widest uppercase rounded-lg hover:border-[#D946EF] hover:text-white hover:shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {isGenerating ? 'Synthesizing Draft...' : 'Generate Draft'}
          </button>
        </div>

        {/* Output Column */}
        <div className="bg-[#0A0A0B] border border-[#8B5CF6]/30 rounded-xl p-8 shadow-[inset_0_0_20px_rgba(139,92,246,0.05)] flex flex-col h-full min-h-[500px]">
          <div className="flex justify-between items-center border-b border-[#333] pb-4 mb-4 shrink-0">
             <h3 className="font-heading font-bold text-[#D946EF] tracking-widest">OUTPUT VIEWER</h3>
             {draftResult && (
               <button onClick={() => copyToClipboard(draftResult, setIsCopied)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#D4AF37] hover:text-white transition-colors">
                 {isCopied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>} 
                 {isCopied ? 'Copied!' : 'Copy Text'}
               </button>
             )}
          </div>
          
          <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-[#E2E8F0] text-sm leading-relaxed pr-2 markdown-body">
            {isGenerating ? (
               <div className="h-full flex items-center justify-center text-[#8B5CF6] animate-pulse font-semibold uppercase tracking-widest gap-3">
                 <Settings size={20} className="animate-spin" /> Processing Legal Parameters...
               </div>
            ) : draftResult ? (
               <div dangerouslySetInnerHTML={parseMarkdown(draftResult)} />
            ) : (
               <div className="h-full flex items-center justify-center text-[#94A3B8] opacity-50 uppercase tracking-widest font-semibold text-xs text-center">
                 Draft will appear here.<br/>Provide facts and initiate generation.
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. TRANSLATE DESK
// ==========================================
function TranslateDesk({ user }: { user: any }) {
  const [source, setSource] = useState('');
  const [targetLang, setTargetLang] = useState('Hindi');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const fileInputRef = useRef<any>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Data = await fileToBase64(file);
      setAttachedFile({ name: file.name, mimeType: file.type, data: base64Data });
    } catch (err) { alert("Error reading file."); }
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      const audioFile = await stopRecording();
      setAttachedFile(audioFile);
    } else {
      startRecording();
    }
  };

  const handleTranslate = async () => {
    if (!source.trim() && !attachedFile) return;
    setIsTranslating(true);

    let parts: any[] = [{ text: `Translate the following legal text accurately to ${targetLang}. Preserve Latin maxims in brackets. Text: ${source}` }];
    if (attachedFile) parts.push({ inlineData: { mimeType: attachedFile.mimeType, data: attachedFile.data } });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: parts }],
          systemInstruction: { parts: [{ text: "You are an expert Legal Translator. You HAVE full access to process the attached audio or documents." }] }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      setTranslation(data.candidates?.[0]?.content?.parts?.[0]?.text || "Error processing translation.");
    } catch (err) {
      setTranslation(`❌ API Error: Ensure API Key is set.`);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 overflow-y-auto">
      <div className="mb-8 shrink-0">
        <h2 className="text-3xl font-heading font-bold tracking-wider text-white">TRANSLATION DESK</h2>
        <div className="h-[1px] w-20 bg-gradient-to-r from-[#D4AF37] to-transparent mt-2"></div>
        <p className="text-[#94A3B8] mt-4 font-semibold text-sm uppercase tracking-wider">High-fidelity legal text translation.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <div className="flex flex-col gap-4">
           <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Source Text (English/Regional)</label>
              <div className="flex gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
                 <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${attachedFile && !attachedFile.mimeType.includes('audio') ? 'text-[#D946EF]' : 'text-[#94A3B8] hover:text-[#D946EF]'}`}>
                   {attachedFile && !attachedFile.mimeType.includes('audio') ? <Check size={14}/> : <Upload size={14}/>} {attachedFile && !attachedFile.mimeType.includes('audio') ? 'Attached' : 'File'}
                 </button>
                 <button onClick={handleMicToggle} className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${isRecording ? 'text-red-500 animate-pulse' : attachedFile?.mimeType.includes('audio') ? 'text-[#D946EF]' : 'text-[#94A3B8] hover:text-[#D946EF]'}`}>
                   {isRecording ? <Square size={14}/> : attachedFile?.mimeType.includes('audio') ? <Check size={14}/> : <Mic size={14}/>}
                   {isRecording ? 'Recording' : attachedFile?.mimeType.includes('audio') ? 'Audio Saved' : 'Voice'}
                 </button>
              </div>
           </div>
           <textarea value={source} disabled={isRecording} onChange={(e)=>setSource(e.target.value)} className="flex-1 min-h-[300px] w-full bg-[#0A0A0B] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-xl p-6 outline-none transition-colors resize-none shadow-xl" placeholder={isRecording ? "Recording audio..." : "Paste document text here..."}></textarea>
        </div>

        <div className="flex flex-col gap-4">
           <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Target Language</label>
              <select value={targetLang} onChange={(e)=>setTargetLang(e.target.value)} className="bg-[#0F0F11] border border-[#8B5CF6]/50 text-[#D946EF] rounded p-1 px-3 outline-none cursor-pointer text-xs font-bold uppercase tracking-widest">
                <option>Hindi</option><option>Tamil</option><option>Marathi</option><option>English</option>
              </select>
           </div>
           <div className="flex-1 min-h-[300px] w-full bg-[#0A0A0B] border border-[#8B5CF6]/30 text-[#E2E8F0] rounded-xl p-6 shadow-[inset_0_0_20px_rgba(139,92,246,0.05)] overflow-y-auto whitespace-pre-wrap markdown-body relative">
              
              {/* Output Viewer Header for Translation */}
              <div className="flex justify-between items-center border-b border-[#333] pb-4 mb-4 shrink-0">
                 <h3 className="font-heading font-bold text-[#D946EF] tracking-widest">OUTPUT VIEWER</h3>
                 {translation && (
                   <button onClick={() => copyToClipboard(translation, setIsCopied)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#D4AF37] hover:text-white transition-colors">
                     {isCopied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>} 
                     {isCopied ? 'Copied!' : 'Copy Text'}
                   </button>
                 )}
              </div>

              {isTranslating ? <div className="animate-pulse text-[#8B5CF6] font-semibold text-sm">Translating Document...</div> : translation ? <div dangerouslySetInnerHTML={parseMarkdown(translation)} /> : <span className="text-[#94A3B8] opacity-50 text-xs uppercase tracking-widest">Awaiting Input...</span>}
           </div>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-[#333] shrink-0">
         <button onClick={handleTranslate} disabled={isTranslating || (!source.trim() && !attachedFile) || isRecording} className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-[#111] to-[#0A0A0B] border border-[#8B5CF6]/50 text-[#D946EF] font-heading font-bold tracking-widest uppercase rounded-lg hover:border-[#D946EF] hover:text-white hover:shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all disabled:opacity-50">
            {isTranslating ? 'Processing...' : 'Execute Translation'}
         </button>
      </div>
    </div>
  );
}

// ==========================================
// 4. KNOWLEDGE VAULT
// ==========================================
function KnowledgeVault({ user, currentWorkspace }: { user: any, currentWorkspace: any }) {
  const [activeTab, setActiveTab] = useState('Research');
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [copiedId, setCopiedId] = useState<any>(null);
  
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const fileInputRef = useRef<any>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  const fetchVault = async () => {
    const { data } = await supabase.from('spaces').select('*').eq('email', user.email).eq('workspace_id', currentWorkspace.id).eq('category', activeTab).order('id', { ascending: false });
    if (data) setSavedItems(data);
  };

  useEffect(() => { fetchVault(); }, [activeTab, currentWorkspace.id]);

  const deleteItem = async (id: string) => {
    await supabase.from('spaces').delete().eq('id', id);
    fetchVault();
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Data = await fileToBase64(file);
      setAttachedFile({ name: file.name, mimeType: file.type, data: base64Data });
    } catch (err) { alert("Error reading file."); }
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      const audioFile = await stopRecording();
      setAttachedFile(audioFile);
    } else {
      startRecording();
    }
  };

  const handleQuickArchive = async () => {
    if (!attachedFile) return alert("Please attach a file or record a voice memo first.");
    setIsArchiving(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: "Extract key facts/summary." }, { inlineData: { mimeType: attachedFile.mimeType, data: attachedFile.data } }] }],
          systemInstruction: { parts: [{ text: "You are an archiving assistant. Extract key legal facts cleanly in Markdown." }] }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error processing file.";
      await supabase.from('spaces').insert([{ email: user.email, category: activeTab, query: `Analysis of ${attachedFile.name}`, response: aiText, workspace_id: currentWorkspace.id, timestamp: new Date().toISOString() }]);
      fetchVault();
      setAttachedFile(null);
    } catch (err) {
      alert(`Archive Failed.`);
    } finally { 
      setIsArchiving(false); 
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full p-8 overflow-y-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-wider text-white">KNOWLEDGE VAULT</h2>
          <div className="h-[1px] w-20 bg-gradient-to-r from-[#D4AF37] to-transparent mt-2"></div>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
          
          <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-all font-semibold tracking-widest text-[10px] uppercase ${attachedFile && !attachedFile.mimeType.includes('audio') ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#0A0A0B] border-[#D4AF37]/30 text-[#94A3B8] hover:text-[#D4AF37]'}`}>
            {attachedFile && !attachedFile.mimeType.includes('audio') ? <Check size={14}/> : <Upload size={14}/>} 
            {attachedFile && !attachedFile.mimeType.includes('audio') ? 'File Ready' : 'Select File'}
          </button>
          
          <button onClick={handleMicToggle} className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-all font-semibold tracking-widest text-[10px] uppercase ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : attachedFile?.mimeType.includes('audio') ? 'bg-[#D946EF]/20 border-[#D946EF] text-[#D946EF]' : 'bg-[#0A0A0B] border-[#D946EF]/30 text-[#94A3B8] hover:text-[#D946EF]'}`}>
            {isRecording ? <Square size={14}/> : attachedFile?.mimeType.includes('audio') ? <Check size={14}/> : <Mic size={14}/>} 
            {isRecording ? 'Recording...' : attachedFile?.mimeType.includes('audio') ? 'Audio Ready' : 'Voice Memo'}
          </button>

          <button onClick={handleQuickArchive} disabled={!attachedFile || isArchiving || isRecording} className="flex items-center gap-2 px-5 py-3 bg-[#8B5CF6]/10 text-[#D946EF] border border-[#8B5CF6]/30 rounded-lg hover:bg-[#8B5CF6]/20 transition-all font-semibold tracking-widest text-xs uppercase shadow-[0_0_10px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
            {isArchiving ? <Settings size={16} className="animate-spin"/> : <Archive size={16} />} Archive
          </button>
        </div>
      </div>
      
      <div className="flex gap-8 border-b border-[#333] mb-8 shrink-0">
         {['Research', 'Paper', 'Study'].map(tab => (
           <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-2 border-b-2 transition-colors font-bold tracking-widest text-sm uppercase ${activeTab === tab ? 'border-[#D946EF] text-[#D946EF]' : 'border-transparent text-[#94A3B8] hover:text-white'}`}>
             {tab}
           </button>
         ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
         {savedItems.length > 0 ? savedItems.map(item => (
           <div key={item.id} className="p-6 bg-[#0A0A0B] border border-[#D4AF37]/20 rounded-xl hover:border-[#8B5CF6]/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.1)] transition-all group">
              <div className="flex justify-between items-start mb-3">
                 <h4 className="text-[#E2E8F0] font-semibold text-lg">{item.query ? item.query.substring(0, 80) : 'Archived Item'}...</h4>
                 <div className="flex gap-3 text-[#94A3B8]">
                    <button onClick={() => copyToClipboard(item.response, (state) => setCopiedId(state ? item.id : null))} className="hover:text-[#D4AF37] transition-colors" title="Copy to Clipboard">
                      {copiedId === item.id ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="hover:text-red-400"><Trash2 size={16}/></button>
                 </div>
              </div>
              <p className="text-xs font-bold text-[#8B5CF6] mb-3 uppercase tracking-widest">{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}</p>
              <div 
                className="text-[#94A3B8] text-sm leading-relaxed max-h-32 overflow-hidden overflow-ellipsis markdown-body"
                dangerouslySetInnerHTML={parseMarkdown(item.response)}
              />
           </div>
         )) : (
           <div className="flex items-center justify-center h-64 border border-dashed border-[#333] rounded-xl text-[#94A3B8] uppercase tracking-widest text-xs font-semibold">
             Sector '{activeTab}' is empty in this folder.
           </div>
         )}
      </div>
    </div>
  );
}

// ==========================================
// NAVIGATION SIDEBAR
// ==========================================
function Sidebar({ user, onLogout, activeModule, setActiveModule, workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces }: any) {
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);

  const modules = [
    { name: 'Research Core', icon: Scale },
    { name: 'Drafting Studio', icon: FileText },
    { name: 'Translate Desk', icon: Globe },
    { name: 'Knowledge Vault', icon: BookOpen }
  ];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data } = await supabase.from('workspaces').insert([{ email: user.email, name: newFolderName, created_at: new Date().toISOString() }]).select();
    if (data && data[0]) {
      setCurrentWorkspace({ id: data[0].id, name: data[0].name });
      refreshWorkspaces();
    }
    setNewFolderName('');
    setShowFolderInput(false);
  };

  return (
    <div className="w-80 bg-[#0A0A0B] border-r border-[#D4AF37]/15 flex flex-col p-6 z-20 shadow-2xl shadow-black shrink-0">
      
      {/* BRANDING */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#D4AF37]/10">
        <LogoSVG className="w-12 h-12 drop-shadow-[0_0_8px_rgba(217,70,239,0.4)]" animate={true} />
        <div className="flex flex-col">
          <AequilexText size="small" />
          <span className="text-[10px] text-[#D946EF] tracking-[0.25em] font-semibold uppercase mt-1">Intelligence</span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-white font-bold tracking-wide uppercase text-sm">{user.name}</h3>
        <p className="text-[#8B5CF6] text-xs font-semibold mt-1">{user.institution}</p>
      </div>

      <div className="mb-8">
        <p className="text-[#94A3B8] text-[10px] font-bold tracking-[0.1em] uppercase mb-2">Active Case Folder</p>
        <div className="flex gap-2 mb-2 relative">
          <select value={currentWorkspace.id} onChange={(e) => {
            const ws = workspaces.find((w: any) => w.id.toString() === e.target.value);
            if(ws) setCurrentWorkspace(ws);
          }} className="flex-1 bg-[#0F0F11] border border-[#D4AF37]/20 text-[#E2E8F0] rounded p-2 text-sm outline-none focus:border-[#8B5CF6] cursor-pointer appearance-none z-10 relative">
            {workspaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-[44px] top-3 text-[#D4AF37] z-20 pointer-events-none" />
          <button onClick={refreshWorkspaces} className="bg-[#0F0F11] border border-[#D4AF37]/20 text-[#94A3B8] p-2 rounded hover:text-[#D946EF] hover:border-[#D946EF] transition-all z-10">
            <RefreshCw size={16} />
          </button>
        </div>
        
        {!showFolderInput ? (
          <button onClick={() => setShowFolderInput(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#D4AF37]/30 text-[#94A3B8] rounded hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all text-xs font-bold uppercase tracking-widest mt-3">
            <FolderPlus size={16} /> Create Folder
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <input autoFocus type="text" value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="Folder Name..." className="flex-1 bg-[#0F0F11] border border-[#D4AF37]/50 text-white text-xs p-2 outline-none rounded" />
            <button onClick={handleCreateFolder} className="bg-[#D4AF37]/20 text-[#D4AF37] px-3 rounded text-xs font-bold hover:bg-[#D4AF37]/40"><Check size={14}/></button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-3">
        {modules.map((mod) => {
          const isActive = activeModule === mod.name;
          const Icon = mod.icon;
          return (
            <button
              key={mod.name}
              onClick={() => setActiveModule(mod.name)}
              className={`flex items-center gap-3 px-4 py-4 rounded-xl border transition-all duration-300 w-full text-left font-bold text-xs tracking-widest uppercase
                ${isActive 
                  ? 'bg-[#050505] border-[#D946EF]/30 border-l-[4px] border-l-[#8B5CF6] text-[#D946EF] shadow-[inset_0_0_15px_rgba(139,92,246,0.1)]' 
                  : 'bg-[#0A0A0B] border-[#D4AF37]/15 text-[#94A3B8] hover:bg-purple-900/10 hover:border-[#D946EF]/30 hover:text-white hover:translate-x-1'
                }`}
            >
              <Icon size={18} className={isActive ? 'text-[#8B5CF6]' : ''} />
              {mod.name}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6 border-t border-[#333]">
        <div className="p-3 bg-purple-900/10 border border-[#8B5CF6]/30 rounded-lg flex items-center gap-3 mb-4 shadow-[0_0_10px_rgba(139,92,246,0.1)]">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <div>
            <p className="text-[10px] font-bold text-[#D946EF] uppercase tracking-widest mb-0.5">System Online</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">Powered by Aequilex AI</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 text-[#94A3B8] hover:text-red-400 border border-transparent hover:border-red-900/50 rounded transition-colors text-xs font-bold uppercase tracking-widest">
          <LogOut size={16} /> Terminate Uplink
        </button>
      </div>
    </div>
  );
}

// ==========================================
// LOGIN & REGISTRATION SCREEN
// ==========================================
function LoginScreen({ onLogin }: { onLogin: any }) {
  const [activeTab, setActiveTab] = useState('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration States
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPassword, setRPassword] = useState('');
  const [rInst, setRInst] = useState('National Law School of India University (NLSIU)');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEnvironment = () => {
    if (IS_MOCK) return true; 
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL" || !GEMINI_API_KEY) {
      setErrorMsg("🛑 ENVIRONMENT MISSING: Add NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, and GEMINI_API_KEY to your .env.local file and set IS_MOCK to false!");
      return false;
    }
    return true;
  };

  const handleLoginSubmit = async (e: any) => {
    e.preventDefault();
    if(!email || !password) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!validateEnvironment()) { setLoading(false); return; }

    try {
      const hashedPw = await hashPassword(password);
      const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', hashedPw).single();

      if (error || !data) throw new Error(error.message || "Invalid token or key.");
      onLogin(data);
    } catch (err: any) {
      setErrorMsg(err.message === "Invalid token or key." ? err.message : "System Error: Check Supabase connection in .env.local");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: any) => {
    e.preventDefault();
    if(!rName || !rEmail || !rPassword) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!validateEnvironment()) { setLoading(false); return; }

    try {
      const hashedPw = await hashPassword(rPassword);
      const { error } = await supabase.from('users').insert([{
         email: rEmail,
         password: hashedPw,
         name: rName,
         institution: rInst,
         year: 'N/A',
         tier: 'free',
         auth_token: ''
      }]);

      if (error) throw new Error(error.message);

      setSuccessMsg("Registration successful! Please login.");
      setActiveTab('LOGIN');
      setEmail(rEmail);
      setPassword('');
    } catch (err: any) {
      setErrorMsg("Registration Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-inter text-[#E2E8F0]">
      
      {/* LOCAL DEV WARNING */}
      {IS_MOCK && (
        <div className="absolute top-0 w-full bg-red-900/50 text-red-300 py-2 text-center text-xs font-bold uppercase tracking-widest border-b border-red-500/50">
          ⚠️ PREVIEW MODE ACTIVE: Database is mocked. To connect to real Supabase, change IS_MOCK to false in page.tsx!
        </div>
      )}

      <div className="w-full max-w-md p-8 flex flex-col items-center mt-10">
        
        <div className="w-full flex flex-col items-center mb-10">
            <div className="mb-6 relative w-32 h-32">
              <LogoSVG className="w-full h-full" animate={true} />
            </div>
            <div className="text-center w-full flex flex-col items-center">
              <AequilexText animate={true} size="large" />
              <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-[#8B5CF6] to-transparent mx-auto my-6 anim-cascade-1"></div>
              <p className="text-[#D946EF] text-[11px] tracking-[0.25em] uppercase font-bold pl-2 anim-cascade-1">Your AI-Powered Legal Assistant</p>
            </div>
        </div>

        <div className="w-full mt-4 anim-cascade-2">
          <div className="bg-[#0A0A0B] border border-[#D4AF37]/20 rounded-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <div className="flex border-b border-[#333] mb-6">
              <button onClick={() => {setActiveTab('LOGIN'); setErrorMsg(''); setSuccessMsg('');}} className={`flex-1 py-3 text-[10px] sm:text-xs font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'LOGIN' ? 'border-[#D946EF] text-[#D946EF]' : 'border-transparent text-[#94A3B8] hover:text-white'}`}>Login</button>
              <button onClick={() => {setActiveTab('REGISTER'); setErrorMsg(''); setSuccessMsg('');}} className={`flex-1 py-3 text-[10px] sm:text-xs font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'REGISTER' ? 'border-[#D946EF] text-[#D946EF]' : 'border-transparent text-[#94A3B8] hover:text-white'}`}>Register</button>
              <button onClick={() => {setActiveTab('GUEST'); setErrorMsg(''); setSuccessMsg('');}} className={`flex-1 py-3 text-[10px] sm:text-xs font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'GUEST' ? 'border-[#D946EF] text-[#D946EF]' : 'border-transparent text-[#94A3B8] hover:text-white'}`}>Guest</button>
            </div>
            
            {errorMsg && <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-4 text-center leading-relaxed bg-red-900/20 p-3 rounded border border-red-500/30">{errorMsg}</p>}
            {successMsg && <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-4 text-center bg-green-900/20 p-3 rounded border border-green-500/30">{successMsg}</p>}

            {activeTab === 'LOGIN' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Identity Token (Email)</label>
                  <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Security Key (Password)</label>
                  <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                   <div className="w-4 h-4 rounded border border-[#D4AF37]/50 bg-[#0F0F11] flex items-center justify-center cursor-pointer"><Check size={12} className="text-[#D946EF]"/></div>
                   <span className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold">Keep me signed in</span>
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 mt-6 bg-gradient-to-r from-[#111] to-[#0A0A0B] border border-[#D4AF37]/50 text-[#D4AF37] font-heading font-bold tracking-widest uppercase rounded-lg hover:border-[#D946EF] hover:text-white hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all transform hover:-translate-y-1 disabled:opacity-50">
                  {loading ? 'Authenticating...' : 'Initiate Session'}
                </button>
              </form>
            )}

            {activeTab === 'REGISTER' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Full Name</label>
                  <input type="text" required value={rName} onChange={(e)=>setRName(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Email Address</label>
                  <input type="email" required value={rEmail} onChange={(e)=>setREmail(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Create Password</label>
                  <input type="password" required value={rPassword} onChange={(e)=>setRPassword(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94A3B8] mb-2 uppercase tracking-widest">Institution</label>
                  <select value={rInst} onChange={(e)=>setRInst(e.target.value)} className="w-full bg-[#0F0F11] border border-[#D4AF37]/20 focus:border-[#8B5CF6] text-white rounded-lg p-3 outline-none transition-colors shadow-inner appearance-none cursor-pointer">
                    <option>National Law School of India University (NLSIU)</option>
                    <option>NALSAR University of Law</option>
                    <option>National Law University, Delhi (NLUD)</option>
                    <option>Independent Researcher</option>
                    <option>Other</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 mt-4 bg-gradient-to-r from-[#111] to-[#0A0A0B] border border-[#8B5CF6]/50 text-[#D946EF] font-heading font-bold tracking-widest uppercase rounded-lg hover:border-[#D946EF] hover:text-white hover:shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all transform hover:-translate-y-1 disabled:opacity-50">
                  {loading ? 'Registering...' : 'Create Account'}
                </button>
              </form>
            )}

            {activeTab === 'GUEST' && (
               <div className="text-center py-8">
                 <p className="text-[#94A3B8] text-sm leading-relaxed mb-6 font-semibold">Temporary access mode. Data and case folders will not be permanently saved across devices.</p>
                 <button onClick={() => onLogin({ email: `guest_${Date.now()}@aequilex.local`, name: 'Guest User', institution: 'Independent Researcher' })} className="w-full py-4 bg-transparent border border-[#94A3B8]/30 text-[#94A3B8] font-heading font-bold tracking-widest uppercase rounded-lg hover:border-[#D946EF] hover:text-[#D946EF] transition-all transform hover:-translate-y-1">
                   Continue as Guest
                 </button>
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// BESPOKE AEQUILEX LOGO (Cyberpunk Neon Variant)
// ==========================================
function AequilexText({ className = "", animate = false, size = "large" }: { className?: string, animate?: boolean, size?: string }) {
  // Sizing controls for Login Screen vs Sidebar
  const textSize = size === "large" ? "text-5xl md:text-6xl lg:text-7xl" : "text-2xl";
  const collarSize = size === "large" ? "w-[0.65em] h-[0.65em]" : "w-[0.55em] h-[0.55em]";
  
  return (
    <div className={`flex items-center justify-center ${className} ${animate ? 'anim-cascade-1' : ''}`}>
      <span className={`font-audiowide cyber-text ${textSize}`}>AE</span>
      
      {/* The Audiowide 'Q' with the Advocate Collar */}
      <span className={`relative inline-flex items-center justify-center font-audiowide cyber-text ${textSize}`}>
        Q
        <svg 
          className={`absolute left-1/2 -translate-x-1/2 pointer-events-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] ${collarSize}`} 
          style={{ bottom: '-0.2em' }} 
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="goldCollar" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#BF953F" />
              <stop offset="40%" stopColor="#FCF6BA" />
              <stop offset="100%" stopColor="#AA771C" />
            </linearGradient>
          </defs>
          <path d="M 35 15 L 65 15 L 60 25 L 40 25 Z" fill="url(#goldCollar)"/>
          <path d="M 42 25 L 25 85 L 45 85 L 48 25 Z" fill="url(#goldCollar)"/>
          <path d="M 58 25 L 75 85 L 55 85 L 52 25 Z" fill="url(#goldCollar)"/>
        </svg>
      </span>
      
      <span className={`font-audiowide cyber-text ${textSize}`}>UILEX</span>
    </div>
  );
}

// ==========================================
// REUSABLE SVG LOGO (Zodiac Dial / Draft 7)
// ==========================================
function LogoSVG({ className, animate = false }: { className?: string, animate?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`${className} overflow-visible`}>
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BF953F" />
          <stop offset="40%" stopColor="#FCF6BA" />
          <stop offset="100%" stopColor="#AA771C" />
        </linearGradient>
        <linearGradient id="cyber" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D946EF" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="obsidian" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
      </defs>
      
      {/* Orbital Mechanics */}
      <g className={animate ? "spin-slow" : ""}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#cyber)" strokeWidth="1" strokeDasharray="1 5"/>
          <circle cx="50" cy="50" r="35" fill="none" stroke="url(#gold)" strokeWidth="2" strokeDasharray="20 10 5 10"/>
          <circle cx="50" cy="50" r="28" fill="none" stroke="url(#cyber)" strokeWidth="0.5"/>
      </g>
      
      {/* Crosshairs */}
      <g className={animate ? "anim-left" : ""}>
          <line x1="10" y1="50" x2="90" y2="50" stroke="url(#gold)" strokeWidth="1" opacity="0.5"/>
          <line x1="50" y1="10" x2="50" y2="90" stroke="url(#gold)" strokeWidth="1" opacity="0.5"/>
      </g>
      
      {/* Central Solid 'A' Block */}
      <g className={animate ? "anim-right" : ""}>
          <path d="M 50 20 L 25 75 H 40 L 50 50 L 60 75 H 75 Z" fill="url(#obsidian)" stroke="url(#cyber)" strokeWidth="2"/>
          <polygon points="45,60 55,60 50,70" fill="url(#gold)"/>
      </g>
    </svg>
  );
}
