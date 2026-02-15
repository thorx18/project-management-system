import { useState, useEffect, useRef } from 'react';
import { Send, Smile, Paperclip, X, ChevronDown } from 'lucide-react';
import { messagesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const avatarColors = ['#7c3aed', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#22c55e', '#f43f5e', '#8b5cf6'];
const getColor = (name) => avatarColors[(name || '').charCodeAt(0) % avatarColors.length];

export default function ChatPanel({ projectId, socket, isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [typingUsers, setTypingUsers] = useState({});
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (isOpen && projectId) {
            loadMessages();
        }
    }, [isOpen, projectId]);

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (message) => {
            setMessages(prev => [...prev, message]);
            scrollToBottom();
        };

        const handleTyping = (data) => {
            if (data.userId !== user?.id) {
                setTypingUsers(prev => {
                    if (data.isTyping) {
                        return { ...prev, [data.userId]: data.userName };
                    } else {
                        const next = { ...prev };
                        delete next[data.userId];
                        return next;
                    }
                });
            }
        };

        socket.on('message_received', handleMessage);
        socket.on('user_typing', handleTyping);

        return () => {
            socket.off('message_received', handleMessage);
            socket.off('user_typing', handleTyping);
        };
    }, [socket, user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        try {
            const res = await messagesAPI.getAll(projectId);
            setMessages(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        try {
            const res = await messagesAPI.send(projectId, { content: input.trim() });
            socket?.emit('new_message', { projectId, message: res.data });
            setMessages(prev => [...prev, res.data]);
            setInput('');
            socket?.emit('typing', { projectId, userId: user?.id, userName: user?.first_name, isTyping: false });
        } catch (e) { console.error(e); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (socket) {
            socket.emit('typing', { projectId, userId: user?.id, userName: user?.first_name, isTyping: true });
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing', { projectId, userId: user?.id, userName: user?.first_name, isTyping: false });
            }, 2000);
        }
    };

    const formatTime = (d) => {
        const date = new Date(d);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (d) => {
        const date = new Date(d);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getInitials = (f, l) => `${(f || '')[0] || ''}${(l || '')[0] || ''}`.toUpperCase() || '?';

    // Group messages by date
    const groupedMessages = [];
    let lastDate = '';
    messages.forEach(m => {
        const date = formatDate(m.created_at);
        if (date !== lastDate) {
            groupedMessages.push({ type: 'date', date });
            lastDate = date;
        }
        groupedMessages.push({ type: 'message', ...m });
    });

    const typingList = Object.values(typingUsers);

    if (!isOpen) return null;

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <div className="chat-header-left">
                    <div className="chat-header-dot" />
                    <h3>Project Chat</h3>
                    <span className="chat-msg-count">{messages.length} messages</span>
                </div>
                <button className="chat-close-btn" onClick={onClose}>
                    <X size={18} />
                </button>
            </div>

            <div className="chat-messages">
                {loading ? (
                    <div className="chat-loading">
                        <div className="spinner" style={{ width: 24, height: 24 }} />
                        <span>Loading messages...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">💬</div>
                        <h4>No messages yet</h4>
                        <p>Start the conversation!</p>
                    </div>
                ) : (
                    groupedMessages.map((item, i) => {
                        if (item.type === 'date') {
                            return (
                                <div key={`date-${i}`} className="chat-date-divider">
                                    <span>{item.date}</span>
                                </div>
                            );
                        }
                        const isMe = item.author_id === user?.id;
                        return (
                            <div key={item.id} className={`chat-message ${isMe ? 'chat-message-me' : ''}`}>
                                {!isMe && (
                                    <div className="chat-avatar" style={{ background: getColor(item.first_name) }}>
                                        {getInitials(item.first_name, item.last_name)}
                                    </div>
                                )}
                                <div className={`chat-bubble ${isMe ? 'chat-bubble-me' : ''}`}>
                                    {!isMe && <div className="chat-sender">{item.first_name} {item.last_name}</div>}
                                    <div className="chat-text">{item.content}</div>
                                    <div className="chat-time">{formatTime(item.created_at)}</div>
                                </div>
                            </div>
                        );
                    })
                )}
                {typingList.length > 0 && (
                    <div className="chat-typing">
                        <div className="chat-typing-dots">
                            <span /><span /><span />
                        </div>
                        <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <div className="chat-input-wrapper">
                    <input
                        ref={inputRef}
                        className="chat-input"
                        placeholder="Type a message..."
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className={`chat-send-btn ${input.trim() ? 'active' : ''}`}
                        onClick={handleSend}
                        disabled={!input.trim()}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
