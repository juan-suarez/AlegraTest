import Groq from 'groq-sdk';
import { orderService } from './orderService';
import { RECIPES } from '../data/recipes';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatIntent {
  action: 'platos' | 'ordenes' | 'como_seleccionar' | 'estado_orden' | 'unknown' | 'help';
  plateId?: string; // para cuando pregunta sobre un plato específico
  quantity?: number; // para órdenes
  orderId?: string; // para estado de orden
  message: string;
}

export interface ConversationContext {
  lastAction?: 'platos' | 'ordenes' | 'como_seleccionar' | 'estado_orden' | null;
  lastPlatosShown?: boolean;
  selectedPlateId?: string | null;
}

class ChatService {
  private groq: Groq | null = null;
  private apiKey: string | null = null;
  private readonly hardcodedApiKey = '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';
  private conversationContext: ConversationContext = {
    lastAction: null,
    lastPlatosShown: false,
    selectedPlateId: null,
  };

  constructor() {
    // Obtener API key de variables de entorno
    this.apiKey = import.meta.env.VITE_GROQ_API_KEY || this.hardcodedApiKey || null;
    
    if (this.apiKey) {
      this.groq = new Groq({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true, // Permitir uso en navegador
      });
    }
  }

  isEnabled(): boolean {
    return this.apiKey !== null && this.groq !== null;
  }

  // Actualizar contexto después de procesar un intent
  private updateContext(action: ChatIntent['action']) {
    this.conversationContext.lastAction = 
      (action === 'unknown' || action === 'help') ? null : action;
    if (action === 'platos') {
      this.conversationContext.lastPlatosShown = true;
    }
  }

  async sendMessage(userMessage: string, _history: ChatMessage[]): Promise<string> {
    if (!this.groq) {
      return '❌ El chatbot no está configurado. Por favor, configura VITE_GROQ_API_KEY en las variables de entorno.';
    }

    try {
      // 1. Parsear intención del usuario con Groq
      const intent = await this.parseIntent(userMessage);

      // 2. Ejecutar acción según la intención
      switch (intent.action) {
        case 'platos':
          return await this.handlePlatos(intent);
        
        case 'ordenes':
          return await this.handleOrdenes(intent);
        
        case 'como_seleccionar':
          return this.handleComoSeleccionar();
        
        case 'estado_orden':
          return await this.handleEstadoOrden(intent);
        
        case 'help':
          return this.getHelpMessage();
        
        default:
          return intent.message;
      }
    } catch (error) {
      console.error('Error en chatService:', error);
      
      if (error instanceof Error && error.message.includes('rate limit')) {
        return '⚠️ Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.';
      }
      
      return '❌ Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.';
    }
  }

  private async parseIntent(userMessage: string): Promise<ChatIntent> {
    if (!this.groq) {
      throw new Error('Groq client not initialized');
    }

    // Detectar platos específicos en el mensaje
    const platoKeywords: Record<string, string> = {
      'burger': 'classic-burger',
      'rice bowl': 'chicken-rice-bowl',
      'chicken rice': 'chicken-rice-bowl',
      'meat': 'meat-potato-plate',
      'potato': 'meat-potato-plate',
      'veggie rice': 'veggie-rice',
      'veggie': 'veggie-rice',
      'salad': 'chicken-salad',
      'cheesy': 'cheesy-potato-bowl',
      'queso': 'cheesy-potato-bowl'
    };

    let detectedPlatoId: string | undefined;
    const messageLower = userMessage.toLowerCase();
    for (const [keyword, platoId] of Object.entries(platoKeywords)) {
      if (messageLower.includes(keyword)) {
        detectedPlatoId = platoId;
        break;
      }
    }

    // Detectar IDs de orden en el mensaje
    const orderIdMatch = userMessage.match(/[a-f0-9]{8}/i);
    let detectedOrderId: string | undefined;
    if (orderIdMatch) {
      detectedOrderId = orderIdMatch[0];
    }

    const systemPrompt = `Eres un asistente amigable de un restaurante que lanza una CAMPAÑA BENÉFICA de comida gratis.

INFORMACIÓN:
- Campaña benéfica donde comen platos sorpresa
- 6 recetas: Classic Burger, Chicken Rice Bowl, Meat & Potato Plate, Veggie Rice, Chicken Salad, Cheesy Potato Bowl
- El cliente NO elige plato (es sorpresa)

CATEGORÍAS DE INTENCIÓN (SIN TECNICISMOS):

1. "platos" - Pregunta sobre platos
   Ejemplos: "¿Qué platos tienen?", "Cuéntame de los platos", "Menú"

2. "ordenes" - Quiere hacer una orden
   Ejemplos: "Quiero 10 platos", "Una orden de 5", "Necesito platos"
   IMPORTANTE: Si NO especifica cantidad (ej "Quiero platos"), cantidad = null

3. "como_seleccionar" - Pregunta cómo elegir plato
   Ejemplos: "¿Puedo elegir?", "¿Cómo selecciono?", "Qué plato recibiré?"

4. "estado_orden" - Ver estado de su orden
   Ejemplos: "¿Dónde está mi orden?", "Estado", Menciona ID

5. "help" | "unknown"

RESPUESTA (JSON):
{
  "action": "platos" | "ordenes" | "como_seleccionar" | "estado_orden" | "help" | "unknown",
  "quantity": <número si ordenes>,
  "orderId": "<id si existe>",
  "plateId": "<plato si pregunta específico>",
  "message": "<respuesta>"
}

EJEMPLOS:
Usuario: "¿Qué tienen?"
{"action": "platos", "message": "Perfecto"}

Usuario: "Quiero 10"
{"action": "ordenes", "quantity": 10, "message": "Excelente"}

Usuario: "Necesito platos"
{"action": "ordenes", "quantity": null, "message": "Claro"}

Usuario: "Burger"
{"action": "platos", "plateId": "burger", "message": "El burger es..."}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      const intent = JSON.parse(jsonStr) as ChatIntent;
      
    // Mejorar detección de platos - buscar en el mensaje
    if (detectedPlatoId && intent.action === 'platos') {
      intent.plateId = detectedPlatoId;
    }
    
    // Si detectamos un plato pero acción fue "unknown", cambiar a "platos"
    if (detectedPlatoId && intent.action === 'unknown') {
      intent.action = 'platos';
      intent.plateId = detectedPlatoId;
    }
    
    // Agregar datos detectados manualmente si LLM no los detectó
    if (detectedPlatoId && !intent.plateId) {
      intent.plateId = detectedPlatoId;
      if (intent.action === 'unknown') {
        intent.action = 'platos';
      }
    }
    if (detectedOrderId && !intent.orderId) {
      intent.orderId = detectedOrderId;
    }
      
      this.updateContext(intent.action);
      return intent;
    } catch (error) {
      console.error('Error parsing intent:', error);
      return {
        action: 'unknown',
        message: 'No entendí tu mensaje. ¿Puedes intentar de nuevo?'
      };
    }
  }

  private async handlePlatos(intent: ChatIntent): Promise<string> {
    // Intentar encontrar un plato específico del mensaje o intent
    let recipe = undefined;
    
    if (intent.plateId) {
      recipe = RECIPES.find(r => r.id === intent.plateId);
    }

    // Si no lo encontró, mostrar lista completa
    if (!recipe) {
      const recipesList = RECIPES.map((r, idx) => 
        `${idx + 1}. ${r.name} (${r.preparationTime} min)`
      ).join('\n');

      this.conversationContext.lastPlatosShown = true;

      return `NUESTROS PLATOS DISPONIBLES:

${recipesList}

Todos nuestros platos son sorpresa. Recibirás uno de estos de forma aleatoria cuando hagas tu orden.

Si quieres saber los ingredientes de un plato específico solo dime cuál. 😊`;
    }

    // Mostrar detalles del plato específico
    const ingredientsList = recipe.ingredients
      .map(ing => `• ${ing.name} (${ing.quantity} ${ing.unit})`)
      .join('\n');
    
    return `${recipe.name.toUpperCase()}

⏱️ Tiempo de preparación: ${recipe.preparationTime} minutos

📝 INGREDIENTES:
${ingredientsList}

Este es uno de nuestros platos sorpresa. Está hecho con ingredientes frescos y es absolutamente delicioso. 😋

¿Quieres hacer una orden? "Quiero X platos"`;
  }

  private async handleOrdenes(intent: ChatIntent): Promise<string> {
    // Si no especificó cantidad, preguntar
    if (!intent.quantity) {
      return `¿Cuántos platos necesitas? 
      
Puedes pedir desde 1 hasta 100 platos. Dime el número. 😊`;
    }

    const quantity = intent.quantity;

    // Validar cantidad
    if (quantity < 1 || quantity > 100) {
      return 'La cantidad debe estar entre 1 y 100 platos. ¿Cuántos necesitas?';
    }

    try {
      const order = await orderService.createOrder(quantity);
      
      return `✅ ¡Excelente! He registrado tu orden.

DETALLES:
ID de orden: ${order.data.orderId.slice(0, 8)}...
Cantidad: ${quantity} plato${quantity > 1 ? 's' : ''}
Estado: En preparación

Los platos están siendo preparados especialmente para ti. Puedes ver el progreso usando tu ID de orden.

¿Hay algo más que necesites?`;
    } catch (error) {
      console.error('Error creating order:', error);
      return `Hubo un problema al crear tu orden. Por favor intenta de nuevo.`;
    }
  }

  private handleComoSeleccionar(): string {
    return `SOBRE LA SELECCIÓN DE PLATOS:

Este es un restaurante especial que está participando en una CAMPAÑA BENÉFICA. Por eso cada comensal recibe un plato sorpresa de nuestro menú.

Los platos se seleccionan de forma aleatoria y especial para cada pedido. ¡Es parte de la magia! 🎁

Todos nuestros platos son deliciosos, así que confiamos que disfrutarás cualquiera que recibas. Cada plato está hecho con ingredientes frescos y seleccionados.

Si tienes alguna alergia o restricción dietética, cuéntame.`;
  }

  private async handleEstadoOrden(intent: ChatIntent): Promise<string> {
    try {
      // Si no tiene orderId, pedir que lo proporcione
      if (!intent.orderId) {
        return `ESTADO DE TU ORDEN:

Para ver el estado de tu orden necesito tu ID. 

¿Cuál es tu ID de orden? (Debería verse algo como este: abc12345...)

Si no recuerdas tu ID, verificamos en el sistema.`;
      }

      const orders = await orderService.getOrders();
      const order = orders.find(o => o.id.toLowerCase().startsWith(intent.orderId!.toLowerCase()));

      if (!order) {
        return `No encontré una orden con ese ID: ${intent.orderId}

¿Puedes verificar que sea el ID correcto? Debería empezar así: "abc...xyz"

Si necesitas ayuda, dime "ayuda".`;
      }

      const statusText = this.translateStatus(order.status);

      return `ESTADO DE TU ORDEN:

ID: ${order.id.slice(0, 8)}...
Estado: ${statusText}
Platos: ${order.total_dishes}
Creada: ${new Date(order.created_at).toLocaleTimeString('es-ES')}

Estamos trabajando en tu orden. Los platos se están preparando especialmente. 👨‍🍳`;
    } catch (error) {
      console.error('Error getting order status:', error);
      return 'Hubo un problema al buscar tu orden. Por favor intenta de nuevo.';
    }
  }

  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'CREATED': 'Registrada',
      'SELECTING_RECIPES': 'Seleccionando platos',
      'COOKING': 'En preparación',
      'COMPLETED': '✅ Completada',
      'FAILED': '❌ No se pudo completar'
    };
    return translations[status] || status;
  }

  private getHelpMessage(): string {
    return `👋 BIENVENIDO A NUESTRA CAMPAÑA BENÉFICA

Soy tu asistente del restaurante. Aquí está lo que puedo hacer:

🍽️ NUESTROS PLATOS
   "¿Qué platos tienen?"
   "Cuéntame del Classic Burger"
   "¿Cómo es el Chicken Salad?"

🛒 HACER UN PEDIDO
   "Quiero 10 platos"
   "Una orden de 5"
   "Necesito 20"

📍 VER MI ORDEN
   "¿Dónde está mi orden?"
   "Ver estado de ABC123"
   "¿Cómo va mi pedido?"

❓ CÓMO FUNCIONA
   "¿Cómo se selecciona el plato?"
   "¿Puedo elegir qué plato?"

---

Este es un restaurante especial donde TODOS reciben un plato SORPRESA del menú. 🎁

¿Qué necesitas?`;
  }
}

export const chatService = new ChatService();
