# 🤖 AI Chatbot - Asistente Virtual del Restaurante

## 📝 Descripción

Chatbot inteligente integrado con IA que permite gestionar órdenes mediante lenguaje natural. Utiliza **Groq API** con modelos LLM de última generación para entender las intenciones del usuario y ejecutar acciones automáticamente.

---

## ✨ Características

- 🗣️ **Conversación Natural**: Interactúa en lenguaje conversacional en español
- 🍽️ **Crear Órdenes**: "Quiero 10 platos", "Dame 50 órdenes", "Necesito 100 platos"
- 📊 **Consultar Información**: "¿Cuántas órdenes hay?", "Ver inventario", "Estado del sistema"
- 🎲 **Recetas Inteligentes**: Consulta sobre las 6 recetas disponibles, ingredientes y tiempos
- 🔍 **Recetas Específicas**: "Cuéntame del Classic Burger", "¿Qué lleva el Chicken Salad?"
- 🏗️ **Explicación del Sistema**: Entiende la arquitectura event-driven y microservicios
- 💡 **Ayuda Contextual**: "¿Qué puedes hacer?", "¿Cómo funciona?", "Ayuda"
- ⚡ **Respuestas Rápidas**: Groq ofrece inferencia ultra-rápida
- 🎨 **UI Moderna**: Floating chat button con animaciones suaves

---

## 🚀 Configuración

### 1. Obtener API Key de Groq (Gratis)

1. Ve a [https://console.groq.com](https://console.groq.com)
2. Crea una cuenta (no requiere tarjeta de crédito)
3. Ve a "API Keys" en el menú lateral
4. Haz clic en "Create API Key"
5. Dale un nombre (ej: "restaurant-chatbot")
6. Copia la API key generada (comienza con `gsk_...`)

### 2. Configurar Variable de Entorno

Edita el archivo `.env` o `.env.local` en la carpeta `frontend/`:

```bash
# Groq API Key for AI Chatbot
VITE_GROQ_API_KEY=gsk_your_api_key_here
```

**Importante**: Reemplaza `gsk_your_api_key_here` con tu API key real.

### 3. Instalar Dependencias

```bash
cd frontend
npm install
```

Esto instalará `groq-sdk` junto con las demás dependencias.

### 4. Reiniciar el Servidor de Desarrollo

```bash
npm run dev
```

---

## 💬 Ejemplos de Uso

### Crear Órdenes

```
Usuario: "Quiero pedir 10 platos"
Bot: ✅ ¡Perfecto! He creado tu orden de 10 platos.
     ID de orden: abc-123...
     Estado: Procesando

Usuario: "Dame 50 órdenes"
Bot: ✅ Orden de 50 platos creada exitosamente...

Usuario: "Necesito 100 platos para un evento"
Bot: ✅ He procesado tu orden de 100 platos...
     (El sistema es robusto y puede manejar cualquier cantidad)
```

### Consultar Recetas

```
Usuario: "¿Qué recetas tienen?"
Bot: 🍽️ Menú del Restaurante (6 recetas):
     1. Classic Burger (15 min)
     2. Chicken Rice Bowl (25 min)
     3. Meat & Potato Plate (20 min)
     4. Veggie Rice (15 min)
     5. Chicken Salad (10 min)
     6. Cheesy Potato Bowl (20 min)
     
     🎲 Selección Aleatoria:
     • Cada plato recibe una receta aleatoria...

Usuario: "Cuéntame del Classic Burger"
Bot: 🍽️ Classic Burger
     ⏱️ Tiempo de preparación: 15 minutos
     📝 Ingredientes:
     • Meat (1 unidad)
     • Cheese (1 unidad)
     • Tomato (1 unidad)
     • Lettuce (1 unidad)
     • Onion (1 unidad)
     • Ketchup (1 unidad)

Usuario: "¿Qué lleva el Chicken Salad?"
Bot: 🍽️ Chicken Salad
     ⏱️ 10 minutos
     📝 Ingredientes:
     • Chicken, Lettuce, Tomato, Onion, Lemon...
```

### Consultar Información

```
Usuario: "¿Cuántas órdenes hay?"
Bot: 📊 Estado de las órdenes:
     En progreso: 3
     Completadas: 15
     Fallidas: 1
     Total: 19
     
     💡 El sistema puede manejar múltiples órdenes simultáneas...

Usuario: "Ver inventario"
Bot: 📦 Estado del inventario:
     Total de ingredientes: 25
     ✅ Todos los ingredientes tienen stock suficiente
     
     🤖 Sistema inteligente: Si falta stock, el sistema
     automáticamente compra del mercado.

Usuario: "¿Cómo funciona el sistema?"
Bot: 🏗️ Arquitectura Event-Driven:
     Este es un sistema de microservicios distribuidos:
     
     📦 4 Servicios:
     1. Order Service - Crea órdenes
     2. Kitchen Service - Selecciona recetas aleatorias
     3. Inventory Service - Gestiona stock
     4. Purchasing Service - Compra ingredientes
     ...
```

### Obtener Ayuda

```
Usuario: "Ayuda"
Bot: 👋 ¡Hola! Soy tu asistente virtual...
     
     🍽️ Crear Órdenes:
     • "Quiero 100 platos"
     
     📊 Consultar Sistema:
     • "Ver inventario"
     • "¿Cómo funciona?"
     
     🍽️ Consultar Recetas (6 disponibles):
     • "¿Qué recetas tienen?"
     • "Cuéntame del Classic Burger"
     ...
```

---

## 🏗️ Arquitectura Técnica

```
Frontend (React)
    ↓
Chatbot Component
    ↓
chatService.ts → Groq API (LLM)
    ↓
Parse Intent (JSON)
    ↓
┌─────────────────────┬──────────────────────┐
│ create_order        │ get_info             │
│ ↓                   │ ↓                    │
│ orderService.ts     │ Fetch data           │
│ ↓                   │ • Orders             │
│ POST /orders        │ • Inventory          │
└─────────────────────│ • Recipes (local)    │
                      └──────────────────────┘
    ↓
Response al usuario
```

### Flujo de Procesamiento

1. **Usuario** escribe mensaje en el chat
2. **chatService** envía mensaje a Groq API con contexto del sistema
3. **Groq LLM** analiza intención y extrae parámetros
   - Modelo: `llama-3.3-70b-versatile`
   - System Prompt: Incluye info de las 6 recetas, arquitectura event-driven
   - Response: JSON estructurado con acción a ejecutar
4. **chatService** ejecuta acción correspondiente:
   - `create_order` → llama a `orderService.createOrder(quantity)`
   - `get_info` → consulta órdenes/inventario/recetas según contexto
   - `help` → muestra mensaje de ayuda contextual
5. **Bot** responde al usuario en lenguaje natural con emojis

### Conocimiento del Chatbot

El chatbot tiene información completa sobre:
- ✅ **6 Recetas**: Classic Burger, Chicken Rice Bowl, Meat & Potato Plate, Veggie Rice, Chicken Salad, Cheesy Potato Bowl
- ✅ **Ingredientes**: Meat, Chicken, Rice, Potato, Lettuce, Tomato, Onion, Cheese, Lemon, Ketchup
- ✅ **Sistema**: Arquitectura event-driven, 4 microservicios, selección aleatoria
- ✅ **Flujo**: Order → Kitchen → Inventory → Purchasing → Completion
- ✅ **Capacidades**: Sin límite de platos, gestión automática de inventario

---

## 🔒 Seguridad

### ¿Es seguro exponer la API key en el frontend?

**Para Groq: Sí (con consideraciones)**

- ✅ Groq es **100% gratis** (14,400 requests/día)
- ✅ Rate limiting **por IP** (no por API key)
- ✅ No hay riesgo financiero
- ⚠️ Cualquiera con tu clave puede usar tu cuota

### Mejores Prácticas

**Opción 1 (Actual)**: Frontend directo con Groq
- Rápido de implementar
- Perfecto para demos/bonus
- Rate limit protege contra abuso

**Opción 2 (Producción)**: Backend proxy
- API key en backend/Lambda
- Frontend llama a tu API
- Mayor control y seguridad

Para este proyecto (bonus challenge), la Opción 1 es **perfectamente adecuada**.

---

## 📊 Límites de Groq (Free Tier)

- **14,400 requests por día**
- **30 requests por minuto**
- **6,000 tokens por request**
- **Models disponibles**:
  - `llama-3.3-70b-versatile` (recomendado)
  - `llama-3.1-8b-instant` (más rápido)
  - `mixtral-8x7b-32768`
  - `gemma2-9b-it`

---

## 🎨 Personalización

### Cambiar el Modelo LLM

Edita `src/services/chatService.ts`:

```typescript
const completion = await this.groq.chat.completions.create({
  model: 'llama-3.1-8b-instant', // Cambiar aquí
  // ...
});
```

### Ajustar System Prompt

Modifica el `systemPrompt` en `parseIntent()` para cambiar el comportamiento del bot.

### Personalizar UI

Los estilos están en `src/components/chatbot/Chatbot.css`.

---

## 🐛 Troubleshooting

### El chatbot dice "No configurado"

- Verifica que `VITE_GROQ_API_KEY` esté en `.env` o `.env.local`
- Reinicia el servidor de desarrollo (`npm run dev`)
- Verifica que la API key comience con `gsk_`

### Error: "rate limit exceeded"

- Espera un minuto e intenta de nuevo
- Groq limita a 30 requests/minuto

### El bot no entiende mis mensajes

- Groq funciona mejor con mensajes claros y directos
- Evita jerga o contexto muy específico
- Ejemplos: "Crear orden de 5 platos" en vez de "Dame cinco"

---

## 📈 Próximos Pasos (Mejoras Opcionales)

1. ✅ **Historial persistente**: Guardar conversaciones en localStorage
2. ✅ **Sugerencias rápidas**: Botones con acciones comunes
3. ✅ **Modo voz**: Speech-to-text para comandos por voz
4. ✅ **Multi-idioma**: Soporte para inglés/español
5. ✅ **Backend proxy**: Mover API key a Lambda

---

## 🎯 ¿Por qué Groq?

- ⚡ **Velocidad**: 10x más rápido que OpenAI
- 💰 **Gratis**: 14,400 requests/día sin tarjeta
- 🤖 **Modelos potentes**: Llama 3.3 70B, Mixtral, Gemma
- 🔧 **API compatible**: Similar a OpenAI
- 🚀 **Perfect para demos**: Ideal para bonus challenges

---

## 📚 Referencias

- [Groq Documentation](https://console.groq.com/docs)
- [Groq SDK NPM](https://www.npmjs.com/package/groq-sdk)
- [LLaMA 3.3 Model Card](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct)

---

## 📝 Licencia

Este chatbot es parte del proyecto de restaurante event-driven.

---

¡Listo! 🚀 Ahora tu aplicación tiene un asistente virtual potenciado por IA.
