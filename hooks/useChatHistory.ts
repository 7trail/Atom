
import { useState, useEffect } from 'react';
import { ChatSession, Message, AppModel } from '../types';
import { getApiKeys, generateText } from '../services/cerebras';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

interface UseChatHistoryProps {
    handleStopAgent: () => void;
    setChatInput: (val: string) => void;
    setChatAttachments: (att: any[]) => void;
    setIsLoading: (val: boolean) => void;
    setActiveView: (view: string) => void;
}

export const useChatHistory = ({ 
    handleStopAgent, 
    setChatInput, 
    setChatAttachments, 
    setIsLoading,
    setActiveView
}: UseChatHistoryProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string>(generateId());
    
    // Load History
    useEffect(() => {
        const savedHistory = localStorage.getItem('atom_chat_history');
        if (savedHistory) {
            try {
                const parsed = JSON.parse(savedHistory);
                setChatHistory(parsed);
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        }
    }, []);

    // Sync Current Chat to History
    useEffect(() => {
        setChatHistory(prev => {
            const existingIndex = prev.findIndex(s => s.id === currentChatId);
            let newHistory = [...prev];

            // Only proceed if we have an active chat session to save or update
            if (messages.length === 0 && existingIndex === -1) {
                return prev;
            }
            
            if (existingIndex >= 0) {
                const existingSession = newHistory[existingIndex];
                const isNewActivity = messages.length !== existingSession.messages.length;
                newHistory[existingIndex] = {
                    ...existingSession,
                    messages: messages,
                    timestamp: isNewActivity ? Date.now() : existingSession.timestamp
                };
                if (isNewActivity) {
                    newHistory.sort((a, b) => b.timestamp - a.timestamp);
                }
            } else {
                const session: ChatSession = {
                    id: currentChatId,
                    title: 'New Chat',
                    messages,
                    timestamp: Date.now()
                };
                newHistory = [session, ...newHistory];
                newHistory.sort((a, b) => b.timestamp - a.timestamp);
            }
            
            return newHistory.slice(0, 20); // Limit to 20 chats
        });
    }, [messages, currentChatId]);

    // Persist History
    useEffect(() => {
        localStorage.setItem('atom_chat_history', JSON.stringify(chatHistory));
    }, [chatHistory]);

    const handleNewChat = () => {
        handleStopAgent();
        setCurrentChatId(generateId());
        setMessages([]);
        setChatInput('');
        setChatAttachments([]);
        setIsLoading(false);
    };

    const handleLoadChat = (session: ChatSession) => {
        handleStopAgent();
        setCurrentChatId(session.id);
        setMessages(session.messages);
        setChatInput('');
        setChatAttachments([]);
        setActiveView('chat');
    };

    const handleDeleteChat = (sessionId: string) => {
        setChatHistory(prev => prev.filter(s => s.id !== sessionId));
        if (currentChatId === sessionId) {
            handleNewChat();
        }
    };

    const handleRenameChat = (sessionId: string, newTitle: string) => {
        setChatHistory(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle.trim() } : s));
    };

    const generateChatTitle = async (firstMessage: string) => {
        const keys = getApiKeys();
        const titleModel = keys.length > 0 ? 'gpt-oss-120b' : 'nvidia/nemotron-nano-12b-v2-vl';
        
        try {
            const result = await generateText(
                `Generate a very short, concise title (3-4 words max) for a chat that starts with the following message. Do not use quotes or punctuation. Message: "${firstMessage}"`,
                {},
                titleModel
            );
            
            if (result) {
                const cleanTitle = result.trim().replace(/^["']|["']$/g, '');
                setChatHistory(prev => prev.map(s => s.id === currentChatId ? { ...s, title: cleanTitle } : s));
            }
        } catch (e) {
            console.error("Failed to generate chat title", e);
        }
    };

    return {
        messages,
        setMessages,
        chatHistory,
        currentChatId,
        handleNewChat,
        handleLoadChat,
        handleDeleteChat,
        handleRenameChat,
        generateChatTitle
    };
};
