import { useState, useRef, useEffect } from 'react';
import { chatService, type ChatMessage } from '../../services/chatService';
import './Chatbot.css';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mensaje de bienvenida
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: chatService.isEnabled() 
          ? `👋 ¡BIENVENIDO A NUESTRA CAMPAÑA BENÉFICA!

Este es un restaurante especial que está regalando platos de forma sorpresa. 🎁

AQUÍ PUEDO AYUDARTE:

🍽️ VER NUESTROS PLATOS
   • "¿Qué platos tienen?"
   • "Muéstrame el menú"
   • "¿Qué es el Burger?"

🛒 HACER UN PEDIDO
   • "Quiero 10 platos"
   • "Una orden de 5"
   • "Necesito platos"

📍 RASTREAR TU PEDIDO
   • "¿Dónde está mi orden?"
   • "Ver estado de mi pedido"

❓ CÓMO FUNCIONA TODO
   • "¿Cómo se selecciona el plato?"
   • "¿Es realmente sorpresa?"

CADA PLATO SERÁ SORPRESA. 
Todos son deliciosos. ¡Confía! 😊

¿Qué deseas hacer?`
          : `⚠️ CHATBOT NO CONFIGURADO

Para usar el chatbot, necesitas configurar la variable de entorno VITE_GROQ_API_KEY.

Por favor, consulta la documentación.`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;

    // Agregar mensaje del usuario
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Obtener respuesta del chatbot
      const response = await chatService.sendMessage(userMessage.content, messages);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    // Volver a mostrar mensaje de bienvenida
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: chatService.isEnabled() 
          ? '👋 Chat limpio. ¿En qué puedo ayudarte?'
          : '⚠️ Chatbot no configurado.',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }, 100);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        aria-label="Toggle chatbot"
        title={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-content">
              <div className="chatbot-avatar">🤖</div>
              <div>
                <h3>Asistente Virtual</h3>
                <p className="chatbot-status">
                  {chatService.isEnabled() ? (
                    <>
                      <span className="status-dot online"></span>
                      En línea
                    </>
                  ) : (
                    <>
                      <span className="status-dot offline"></span>
                      No configurado
                    </>
                  )}
                </p>
              </div>
            </div>
            <button 
              className="chatbot-clear-btn"
              onClick={handleClearChat}
              title="Limpiar chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.content.split('\n').map((line, lineIdx) => (
                    <p key={lineIdx}>{line}</p>
                  ))}
                </div>
                <div className="message-time">
                  {msg.timestamp.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="chatbot-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chatbot-input"
              placeholder={chatService.isEnabled() ? 'Escribe tu mensaje...' : 'Chatbot no configurado'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading || !chatService.isEnabled()}
            />
            <button 
              type="submit" 
              className="chatbot-send-btn"
              disabled={!inputValue.trim() || isLoading || !chatService.isEnabled()}
              aria-label="Enviar mensaje"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
