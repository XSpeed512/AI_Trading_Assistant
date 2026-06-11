# AI Trading Assistant — Full CTO Analysis & Architecture

---

## 1. PROJECT ANALYSIS — What Exists Today

### Current State Summary

The project is a **PHP monolith** hosted on Altervista (a shared Italian hosting provider). Here is what was found:

| Layer | Technology | State |
|---|---|---|
| Frontend | Vanilla HTML + PHP templates + inline JS | Prototype |
| Charts | Custom canvas renderer (hand-rolled) | Functional but limited |
| AI Chat | UI only — no backend wired | Not implemented |
| Trade Ideas | Static hardcoded HTML | Not implemented |
| Auth | PHP sessions + MySQL | Works, not secure enough |
| Database | MySQL on Altervista | Dev only |
| Backend API | None | Missing entirely |
| WebSockets | None | Missing entirely |
| DevOps | None | Missing entirely |

### Key Files Analyzed

- `index.php` — GridStack dashboard with widget system. Good UX concept, needs rewrite.
- `js/chart.js` — Custom canvas OHLC renderer (1019 lines). Fetches from TwelveData. Has toolbar, indicators dropdown, crosshair engine. Solid effort, but reinventing the wheel.
- `js/backUp.js` — Older version with RSI + MACD calculation logic (correct formulas).
- `database.sql` — MySQL schema: users, signals, settings, logs, user_widgets. Good starting point.
- `config/config.php` — **CRITICAL SECURITY ISSUE**: API keys and DB credentials hardcoded.
- `key.txt` — **CRITICAL**: Live OpenAI API key (`sk-proj-...`) and TwelveData key stored in plaintext in a public file. **REVOKE THESE IMMEDIATELY.**

---

## 2. PROBLEMS FOUND

### 🔴 Critical (Fix Before Anything Else)

1. **API key exposed in `key.txt`** — OpenAI key is committed to the repo in plaintext. Rotate it now at platform.openai.com. Same for TwelveData key.
2. **No `.gitignore`** — Secrets are tracked by git.
3. **Hardcoded DB credentials** in `config.php` including a real database name/user.
4. **No CSRF protection** on forms.
5. **SQL injection risk** — `login_process.php` / `register_process.php` need audit.
6. **No HTTPS enforcement** in code.

### 🟠 Architectural (Blockers for Scaling)

7. **PHP monolith on shared hosting** — Cannot run WebSockets, Celery workers, Redis, or real-time features. The entire stack must be migrated.
8. **No real backend AI integration** — The chat widget has no wired API call. The AI features are purely visual mockups.
9. **Custom canvas chart** — Reinvents TradingView Lightweight Charts. The custom renderer lacks: zoom, pan inertia, multiple panes, overlay persistence, mobile touch. Use the library directly.
10. **No state management** — JS globals (`candleData`, `currentSymbol`) scattered. No store.
11. **Mixed Italian/English** — Code comments, UI strings, variable names are inconsistent. Pick one language (English for code).
12. **`backUp.js`** is dead code — RSI/MACD logic exists there but not in the active `chart.js`.
13. **No TypeScript** — Zero type safety across 1000+ lines of JS.
14. **No error boundaries** or loading states in UI.

### 🟡 Feature Gaps

15. No AI chart analysis (read candles → send to OpenAI).
16. No trade ideas generation (AI-powered, structured output).
17. No news system.
18. No broker integration.
19. No WebSocket real-time price stream.
20. No paper trading mode.
21. No user preferences/saved charts persistence beyond layout.
22. No multi-market symbol search.

---

## 3. RECOMMENDED ARCHITECTURE

### Decision: Full Stack Migration

**Why not keep PHP?** Shared hosting cannot run: async workers (Celery), WebSockets, Redis pub/sub, Python AI libraries, Docker. The goal requires all of these.

**The new stack:**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  TypeScript · TailwindCSS · Zustand · TradingView LW    │
└────────────────────────┬────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────┐
│                  BACKEND (FastAPI / Python)              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Auth API │  │ Chart API│  │  AI API  │  │News API│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           WebSocket Gateway (real-time)          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │Celery    │  │  Redis   │  │   PostgreSQL          │  │
│  │Workers   │  │  Cache   │  │   (primary DB)        │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               EXTERNAL SERVICES                          │
│  TwelveData · Binance WS · OpenAI · NewsAPI · Alpaca    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. FOLDER STRUCTURE

```
ai-trading-assistant/
│
├── frontend/                          # Next.js app
│   ├── src/
│   │   ├── app/                       # Next.js 14 App Router
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── dashboard/page.tsx     # Main trading dashboard
│   │   │   ├── layout.tsx
│   │   │   └── providers.tsx          # Zustand + React Query providers
│   │   │
│   │   ├── components/
│   │   │   ├── chart/
│   │   │   │   ├── TradingChart.tsx   # Lightweight Charts wrapper
│   │   │   │   ├── ChartToolbar.tsx   # Symbol, timeframe, indicators
│   │   │   │   ├── IndicatorPanel.tsx
│   │   │   │   └── DrawingTools.tsx
│   │   │   ├── ai/
│   │   │   │   ├── AIChat.tsx         # Chat panel
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   └── TradeIdeasPanel.tsx
│   │   │   ├── market/
│   │   │   │   ├── SymbolSearch.tsx
│   │   │   │   ├── MarketOverview.tsx
│   │   │   │   └── NewsPanel.tsx
│   │   │   ├── broker/
│   │   │   │   ├── BrokerConnect.tsx
│   │   │   │   ├── OrderPanel.tsx
│   │   │   │   └── PositionsTable.tsx
│   │   │   ├── layout/
│   │   │   │   ├── DashboardGrid.tsx  # GridStack or custom
│   │   │   │   ├── Widget.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── ui/                    # shadcn/ui base components
│   │   │
│   │   ├── hooks/
│   │   │   ├── useChart.ts
│   │   │   ├── useWebSocket.ts        # Real-time price stream
│   │   │   ├── useAIChat.ts
│   │   │   └── useMarketData.ts
│   │   │
│   │   ├── store/                     # Zustand stores
│   │   │   ├── chartStore.ts          # Symbol, timeframe, candles, drawings
│   │   │   ├── authStore.ts
│   │   │   ├── aiStore.ts             # Chat messages, trade ideas
│   │   │   └── brokerStore.ts
│   │   │
│   │   ├── services/                  # API client layer
│   │   │   ├── api.ts                 # Axios instance + interceptors
│   │   │   ├── chartService.ts
│   │   │   ├── aiService.ts
│   │   │   └── brokerService.ts
│   │   │
│   │   ├── types/                     # Shared TypeScript types
│   │   │   ├── chart.ts
│   │   │   ├── ai.ts
│   │   │   ├── broker.ts
│   │   │   └── user.ts
│   │   │
│   │   └── utils/
│   │       ├── indicators.ts          # RSI, MACD, BB calculations (TS port)
│   │       ├── formatters.ts
│   │       └── constants.ts
│   │
│   ├── public/
│   ├── .env.local
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                           # FastAPI app
│   ├── app/
│   │   ├── main.py                    # App entry, router registration
│   │   ├── config.py                  # Pydantic settings (reads .env)
│   │   │
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py            # JWT login/register
│   │   │   │   ├── market.py          # OHLCV, symbol search
│   │   │   │   ├── ai.py              # Chat, trade ideas
│   │   │   │   ├── news.py            # News feed
│   │   │   │   ├── broker.py          # Broker connect/orders
│   │   │   │   └── user.py            # Profile, preferences
│   │   │   └── websocket.py           # WS endpoint
│   │   │
│   │   ├── services/
│   │   │   ├── market_data/
│   │   │   │   ├── twelvedata.py      # TwelveData adapter
│   │   │   │   ├── binance.py         # Binance WebSocket
│   │   │   │   └── provider.py        # Abstract provider interface
│   │   │   ├── ai/
│   │   │   │   ├── chat_agent.py      # Conversational AI
│   │   │   │   ├── analysis_agent.py  # Chart analysis
│   │   │   │   ├── trade_ideas.py     # Structured trade idea gen
│   │   │   │   ├── context_memory.py  # Redis-based conversation memory
│   │   │   │   └── prompts.py         # Prompt templates
│   │   │   ├── news/
│   │   │   │   ├── news_fetcher.py
│   │   │   │   └── news_analyzer.py
│   │   │   └── broker/
│   │   │       ├── alpaca.py
│   │   │       ├── binance_broker.py
│   │   │       └── paper_trading.py
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── signal.py
│   │   │   ├── trade.py
│   │   │   └── chart_config.py
│   │   │
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── market.py
│   │   │   ├── ai.py
│   │   │   └── trade.py
│   │   │
│   │   ├── core/
│   │   │   ├── security.py            # JWT, password hashing
│   │   │   ├── dependencies.py        # FastAPI DI (get_db, get_current_user)
│   │   │   ├── exceptions.py
│   │   │   └── logging.py
│   │   │
│   │   ├── db/
│   │   │   ├── session.py             # Async SQLAlchemy engine
│   │   │   └── migrations/            # Alembic migrations
│   │   │
│   │   └── workers/                   # Celery tasks
│   │       ├── celery_app.py
│   │       ├── market_tasks.py        # Periodic OHLCV sync
│   │       └── news_tasks.py          # Periodic news fetch
│   │
│   ├── tests/
│   │   ├── test_auth.py
│   │   ├── test_market.py
│   │   └── test_ai.py
│   │
│   ├── .env
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml                 # Full stack local dev
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── .gitignore                         # MUST include .env, key.txt, *.key
└── README.md
```

---

## 5. BACKEND DESIGN

### FastAPI Application — `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, market, ai, news, broker, user
from app.api.websocket import router as ws_router
from app.core.logging import setup_logging
from app.config import settings

setup_logging()
app = FastAPI(title="AI Trading Assistant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(market.router, prefix="/api/v1/market", tags=["market"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(news.router, prefix="/api/v1/news", tags=["news"])
app.include_router(broker.router, prefix="/api/v1/broker", tags=["broker"])
app.include_router(user.router, prefix="/api/v1/user", tags=["user"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
```

### Configuration — `backend/app/config.py`

```python
from pydantic_settings import BaseSettings
from typing import list

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # External APIs
    OPENAI_API_KEY: str
    TWELVEDATA_API_KEY: str
    NEWSAPI_KEY: str

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### AI Chat Agent — `backend/app/services/ai/chat_agent.py`

```python
import json
from openai import AsyncOpenAI
from app.services.ai.context_memory import ContextMemory
from app.services.ai.prompts import TRADING_SYSTEM_PROMPT
from app.schemas.ai import ChatMessage, ChartContext

client = AsyncOpenAI()

async def run_chat(
    user_message: str,
    chart_context: ChartContext,
    user_id: int,
    memory: ContextMemory
) -> str:
    """
    Send a user message to the AI with full chart context injected.
    Chart context includes: symbol, timeframe, current price, indicators,
    last 50 candles, any visible drawings.
    """
    history = await memory.get_history(user_id, limit=10)

    # Build context-rich system message
    context_block = f"""
CURRENT CHART STATE:
- Symbol: {chart_context.symbol}
- Timeframe: {chart_context.timeframe}
- Current Price: {chart_context.current_price}
- RSI(14): {chart_context.rsi}
- MACD: {chart_context.macd_value} | Signal: {chart_context.macd_signal}
- Trend (EMA 20/50): {chart_context.trend}
- Last 10 candles (OHLCV): {json.dumps(chart_context.last_candles[-10:])}
- Active drawings: {chart_context.drawings}
"""

    messages = [
        {"role": "system", "content": TRADING_SYSTEM_PROMPT + context_block},
        *history,
        {"role": "user", "content": user_message}
    ]

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.4,
        max_tokens=800
    )

    reply = response.choices[0].message.content
    await memory.add_message(user_id, "user", user_message)
    await memory.add_message(user_id, "assistant", reply)
    return reply
```

### Trade Ideas Engine — `backend/app/services/ai/trade_ideas.py`

```python
from openai import AsyncOpenAI
from pydantic import BaseModel
from app.schemas.ai import TradeIdea

client = AsyncOpenAI()

class TradeIdeaOutput(BaseModel):
    direction: str            # "LONG" | "SHORT" | "NEUTRAL"
    confidence: float         # 0.0 - 1.0
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    reasoning: str            # Plain English explanation
    indicators_used: list[str]
    disclaimer: str           # Always present

async def generate_trade_idea(chart_context: dict) -> TradeIdeaOutput:
    """
    Uses structured output (JSON mode) to generate a trade idea.
    NEVER frames this as financial advice — always educational.
    """
    prompt = f"""
You are an educational trading analysis tool. Analyze the following chart data
and generate a structured trade setup for educational purposes only.

Chart Data: {chart_context}

Return a JSON object matching this schema:
- direction: LONG or SHORT or NEUTRAL
- confidence: float 0-1 (how clear the setup is technically)
- entry_price: suggested entry level
- stop_loss: suggested stop loss level
- take_profit: suggested take profit level  
- risk_reward: ratio (e.g. 2.5 means 2.5:1)
- reasoning: 2-3 sentences explaining the technical rationale
- indicators_used: list of indicators that support this setup
- disclaimer: always include "This is not financial advice. Always do your own research."
"""
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2
    )

    return TradeIdeaOutput(**json.loads(response.choices[0].message.content))
```

### WebSocket Gateway — `backend/app/api/websocket.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.market_data.provider import get_realtime_stream
import asyncio, json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}  # symbol -> [ws]

    async def connect(self, ws: WebSocket, symbol: str):
        await ws.accept()
        self.active.setdefault(symbol, []).append(ws)

    def disconnect(self, ws: WebSocket, symbol: str):
        self.active.get(symbol, []).remove(ws)

    async def broadcast(self, symbol: str, data: dict):
        for ws in self.active.get(symbol, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/prices/{symbol}")
async def price_stream(websocket: WebSocket, symbol: str):
    await manager.connect(websocket, symbol)
    try:
        async for tick in get_realtime_stream(symbol):
            await manager.broadcast(symbol, tick)
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol)
```

---

## 6. FRONTEND DESIGN

### Zustand Chart Store — `frontend/src/store/chartStore.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W'
export type Market = 'crypto' | 'forex' | 'stocks'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Drawing {
  id: string
  type: 'trendline' | 'horizontal' | 'rectangle' | 'fibonacci'
  points: { price: number; time: number }[]
  color: string
}

interface ChartState {
  symbol: string
  timeframe: Timeframe
  market: Market
  candles: Candle[]
  drawings: Drawing[]
  indicators: string[]
  isLoading: boolean
  // Computed for AI context
  currentPrice: number | null

  setSymbol: (symbol: string, market: Market) => void
  setTimeframe: (tf: Timeframe) => void
  setCandles: (candles: Candle[]) => void
  addDrawing: (drawing: Drawing) => void
  removeDrawing: (id: string) => void
  toggleIndicator: (key: string) => void
}

export const useChartStore = create<ChartState>()(
  devtools((set, get) => ({
    symbol: 'BTCUSD',
    timeframe: '1h',
    market: 'crypto',
    candles: [],
    drawings: [],
    indicators: ['ema20', 'ema50'],
    isLoading: false,
    currentPrice: null,

    setSymbol: (symbol, market) => set({ symbol, market, candles: [], isLoading: true }),
    setTimeframe: (timeframe) => set({ timeframe, candles: [], isLoading: true }),
    setCandles: (candles) => set({
      candles,
      isLoading: false,
      currentPrice: candles.at(-1)?.close ?? null
    }),
    addDrawing: (drawing) => set(s => ({ drawings: [...s.drawings, drawing] })),
    removeDrawing: (id) => set(s => ({ drawings: s.drawings.filter(d => d.id !== id) })),
    toggleIndicator: (key) => set(s => ({
      indicators: s.indicators.includes(key)
        ? s.indicators.filter(i => i !== key)
        : [...s.indicators, key]
    })),
  }))
)
```

### TradingView Lightweight Charts Wrapper — `frontend/src/components/chart/TradingChart.tsx`

```typescript
import { useEffect, useRef } from 'react'
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickData, ColorType
} from 'lightweight-charts'
import { useChartStore } from '@/store/chartStore'
import { useWebSocket } from '@/hooks/useWebSocket'

export function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApi = useRef<IChartApi | null>(null)
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null)

  const { candles, symbol } = useChartStore()

  // Init chart once
  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1f2937' },
      timeScale: { borderColor: '#1f2937', timeVisible: true },
    })

    candleSeries.current = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartApi.current = chart

    const observer = new ResizeObserver(() => {
      chart.resize(chartRef.current!.clientWidth, chartRef.current!.clientHeight)
    })
    observer.observe(chartRef.current)

    return () => { chart.remove(); observer.disconnect() }
  }, [])

  // Update candles when data changes
  useEffect(() => {
    if (!candleSeries.current || !candles.length) return
    candleSeries.current.setData(candles as CandlestickData[])
    chartApi.current?.timeScale().fitContent()
  }, [candles])

  // Real-time tick subscription
  useWebSocket(symbol, (tick) => {
    candleSeries.current?.update(tick)
  })

  return <div ref={chartRef} className="w-full h-full" />
}
```

### AI Chat Hook — `frontend/src/hooks/useAIChat.ts`

```typescript
import { useState, useCallback } from 'react'
import { useChartStore } from '@/store/chartStore'
import { aiService } from '@/services/aiService'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { symbol, timeframe, candles, drawings, indicators } = useChartStore()

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      // Build chart context snapshot for AI
      const chartContext = {
        symbol,
        timeframe,
        current_price: candles.at(-1)?.close,
        last_candles: candles.slice(-50),
        drawings,
        active_indicators: indicators,
      }

      const reply = await aiService.chat(text, chartContext)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }, [symbol, timeframe, candles, drawings, indicators])

  return { messages, sendMessage, isLoading }
}
```

---

## 7. AI SYSTEM DESIGN

### Architecture Overview

```
User Message
     │
     ▼
┌─────────────────────────────────┐
│      Intent Router              │
│  (What type of question is it?) │
└──────┬──────────┬───────────────┘
       │          │
       ▼          ▼
  Chart Analysis  General Trading
  Agent           Education Agent
       │          │
       └────┬─────┘
            ▼
    Context Injector
    (Candles + Indicators + Drawings)
            │
            ▼
    OpenAI GPT-4o
    (with function calling)
            │
            ▼
    ┌───────────────────┐
    │ Function calls:   │
    │ - add_drawing()   │
    │ - highlight_zone()│
    │ - add_indicator() │
    └───────────────────┘
            │
            ▼
    Response + Actions
```

### System Prompt — `backend/app/services/ai/prompts.py`

```python
TRADING_SYSTEM_PROMPT = """
You are an AI trading assistant embedded in a professional trading platform.
Your role is EDUCATIONAL — you help users understand markets, not give financial advice.

CAPABILITIES:
- Analyze chart data (candles, indicators, price action) provided in context
- Explain trading concepts clearly (support/resistance, trend, patterns)
- Suggest possible setups based on technical analysis
- Add drawings on the chart via function calls
- Answer questions about market structure

IMPORTANT RULES:
1. NEVER give direct financial advice ("you should buy/sell X")
2. Always frame suggestions as educational ("this pattern TYPICALLY leads to...")
3. Always mention risk management
4. Use plain language for beginners, more technical for advanced questions
5. When analyzing charts, reference specific price levels and indicators from context

COMMUNICATION STYLE:
- Concise and clear
- Use bullet points for structured analysis
- Highlight key levels with specific numbers
- Always explain WHY not just WHAT
"""

TRADE_IDEA_SYSTEM_PROMPT = """
You generate educational trade setup examples based on technical analysis.
These are NOT financial advice. Frame everything as "this setup suggests..."
Always include a stop loss and risk/reward ratio.
Always add the disclaimer: "This is educational content, not financial advice."
"""
```

### Function Calling — AI Drawing on Chart

```python
CHART_FUNCTIONS = [
    {
        "name": "add_horizontal_line",
        "description": "Draw a horizontal line on the chart at a specific price level",
        "parameters": {
            "type": "object",
            "properties": {
                "price": {"type": "number", "description": "Price level for the line"},
                "label": {"type": "string", "description": "Label for the line (e.g. 'Support', 'Resistance')"},
                "color": {"type": "string", "description": "Hex color (e.g. #ff0000)"},
                "style": {"type": "string", "enum": ["solid", "dashed", "dotted"]}
            },
            "required": ["price", "label"]
        }
    },
    {
        "name": "add_trendline",
        "description": "Draw a trendline between two points on the chart",
        "parameters": {
            "type": "object",
            "properties": {
                "point1": {"type": "object", "properties": {"time": {"type": "number"}, "price": {"type": "number"}}},
                "point2": {"type": "object", "properties": {"time": {"type": "number"}, "price": {"type": "number"}}},
                "label": {"type": "string"},
                "color": {"type": "string"}
            },
            "required": ["point1", "point2"]
        }
    },
    {
        "name": "highlight_zone",
        "description": "Highlight a price zone (e.g. support/resistance area)",
        "parameters": {
            "type": "object",
            "properties": {
                "price_low": {"type": "number"},
                "price_high": {"type": "number"},
                "label": {"type": "string"},
                "color": {"type": "string"}
            },
            "required": ["price_low", "price_high"]
        }
    }
]
```

---

## 8. DATABASE SCHEMA

Migrate from MySQL to **PostgreSQL**. Use Alembic for migrations.

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'premium', 'admin')),
    preferences JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Chart Configurations (saved layouts per user)
CREATE TABLE chart_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    symbol      VARCHAR(32) NOT NULL,
    timeframe   VARCHAR(10) NOT NULL,
    indicators  JSONB DEFAULT '[]',
    drawings    JSONB DEFAULT '[]',
    layout      JSONB DEFAULT '{}',
    is_default  BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- AI Trade Ideas (generated, requires user confirmation)
CREATE TABLE trade_ideas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    symbol          VARCHAR(32) NOT NULL,
    timeframe       VARCHAR(10),
    direction       VARCHAR(10) NOT NULL CHECK (direction IN ('LONG', 'SHORT', 'NEUTRAL')),
    confidence      DECIMAL(3,2),
    entry_price     DECIMAL(20,8),
    stop_loss       DECIMAL(20,8),
    take_profit     DECIMAL(20,8),
    risk_reward     DECIMAL(5,2),
    reasoning       TEXT,
    status          VARCHAR(20) DEFAULT 'pending'  -- pending, confirmed, rejected, expired
                    CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Trade History (user-confirmed executed trades)
CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    idea_id         UUID REFERENCES trade_ideas(id) ON DELETE SET NULL,
    symbol          VARCHAR(32) NOT NULL,
    direction       VARCHAR(10) NOT NULL,
    entry_price     DECIMAL(20,8) NOT NULL,
    exit_price      DECIMAL(20,8),
    quantity        DECIMAL(20,8) NOT NULL,
    pnl             DECIMAL(20,8),
    broker          VARCHAR(50),                    -- 'binance', 'alpaca', 'paper'
    broker_order_id VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'open',
    opened_at       TIMESTAMPTZ DEFAULT now(),
    closed_at       TIMESTAMPTZ
);

-- AI Chat History
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id  UUID NOT NULL,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    chart_snapshot JSONB,                          -- Chart state at time of message
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- News Cache
CREATE TABLE news_articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    summary     TEXT,
    url         TEXT UNIQUE,
    source      VARCHAR(100),
    markets     TEXT[],                            -- ['crypto', 'forex']
    symbols     TEXT[],                            -- ['BTC', 'ETH']
    sentiment   VARCHAR(10),                       -- 'bullish', 'bearish', 'neutral'
    published_at TIMESTAMPTZ,
    fetched_at   TIMESTAMPTZ DEFAULT now()
);

-- Broker Connections (encrypted credentials)
CREATE TABLE broker_connections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    broker      VARCHAR(50) NOT NULL,
    api_key_enc TEXT,                              -- AES encrypted
    is_paper    BOOLEAN DEFAULT true,
    is_active   BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Widget Layouts
CREATE TABLE dashboard_layouts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    layout      JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_news_markets ON news_articles USING GIN(markets);
CREATE INDEX idx_news_symbols ON news_articles USING GIN(symbols);
CREATE INDEX idx_chart_configs_user ON chart_configs(user_id);
```

---

## 9. REAL-TIME ARCHITECTURE

### WebSocket Flow

```
Browser
  │
  │ ws://backend/ws/prices/BTCUSD
  ▼
FastAPI WebSocket Endpoint
  │
  ├── ConnectionManager (in-memory map: symbol → [WebSocket])
  │
  └── Background task per symbol
        │
        ├── If crypto: Binance WebSocket stream
        │     wss://stream.binance.com:9443/ws/btcusdt@kline_1m
        │
        ├── If forex/stocks: TwelveData WebSocket
        │     wss://ws.twelvedata.com/v1/quotes/price
        │
        └── On each tick → broadcast to all subscribers
```

### Redis Pub/Sub for Scaling

When scaling to multiple backend instances:

```
Binance WS → Worker A → Redis PUBLISH "price:BTCUSD" → Worker B subscribes → broadcasts to its clients
                                                      → Worker C subscribes → broadcasts to its clients
```

### Real-time Events (WebSocket message types)

```typescript
// Frontend receives these message types:
type WSMessage =
  | { type: 'tick'; symbol: string; price: number; time: number }
  | { type: 'candle_update'; symbol: string; candle: Candle }
  | { type: 'trade_idea'; idea: TradeIdea }
  | { type: 'news_alert'; article: NewsArticle }
  | { type: 'connection_status'; status: 'connected' | 'reconnecting' }
```

---

## 10. DEVELOPMENT ROADMAP

### Phase 0 — Security (Day 1, Non-Negotiable)
- [ ] **REVOKE** the exposed OpenAI and TwelveData API keys
- [ ] Add `.gitignore` with `.env`, `key.txt`, `*.key`, `*.pem`
- [ ] Move all credentials to environment variables
- [ ] Never commit secrets again

### Phase 1 — MVP Foundation (Weeks 1–3)
- [ ] Initialize Next.js + FastAPI + Docker Compose project
- [ ] PostgreSQL + Alembic migrations (schema above)
- [ ] JWT auth (login, register, refresh token)
- [ ] Market data API: fetch OHLCV from TwelveData
- [ ] TradingView Lightweight Charts integration (replace custom canvas)
- [ ] Symbol search + timeframe switcher
- [ ] Zustand store setup
- [ ] Basic dashboard layout (chart + chat panel)

### Phase 2 — AI Core (Weeks 4–5)
- [ ] AI Chat wired to backend (FastAPI → OpenAI)
- [ ] Chart context injection (candles + indicators → AI)
- [ ] Redis conversation memory
- [ ] Trade Ideas generator (structured JSON output)
- [ ] AI drawing on chart via function calling
- [ ] Indicators: EMA, SMA, RSI, MACD (using technicalindicators or custom)

### Phase 3 — Real-Time (Week 6)
- [ ] WebSocket backend (FastAPI)
- [ ] Binance WebSocket integration (crypto real-time)
- [ ] TwelveData WebSocket (forex/stocks)
- [ ] Frontend useWebSocket hook
- [ ] Live price updates on chart

### Phase 4 — News + Extended Features (Weeks 7–8)
- [ ] NewsAPI integration + Celery periodic task
- [ ] News panel UI with market filters
- [ ] AI news impact analysis
- [ ] Drawing tools (horizontal lines, trendlines, rectangles)
- [ ] Saved chart configurations

### Phase 5 — Broker Integration (Weeks 9–11)
- [ ] Paper trading engine (backend)
- [ ] Alpaca API integration (stocks)
- [ ] Binance API integration (crypto)
- [ ] Order panel (entry, SL, TP input)
- [ ] User ALWAYS confirms before any order is placed
- [ ] Trade history table

### Phase 6 — Production (Weeks 12–14)
- [ ] Docker Compose production config
- [ ] GitHub Actions CI/CD
- [ ] Rate limiting (FastAPI + Redis)
- [ ] Input validation hardening
- [ ] Error monitoring (Sentry)
- [ ] Logging (structlog)
- [ ] SSL/TLS setup

---

## 11. MVP IMPLEMENTATION PLAN

The absolute minimum to have a working demo:

| Priority | Feature | Effort |
|---|---|---|
| P0 | Security fix (revoke keys) | 30 min |
| P0 | Project scaffold (Next.js + FastAPI + Docker) | 4h |
| P1 | Auth (JWT login/register) | 1 day |
| P1 | OHLCV endpoint + TradingView chart | 1 day |
| P1 | Symbol search + timeframe | 4h |
| P2 | AI chat (wired, with chart context) | 1 day |
| P2 | Trade ideas (structured output) | 1 day |
| P3 | RSI + MACD indicators | 1 day |
| P3 | Basic dashboard layout | 4h |

**Total MVP: ~8–10 working days**

---

## 12. RECOMMENDED NEXT CODING STEPS

### Step 1 (Now)
```bash
# Create project structure
npx create-next-app@latest frontend --typescript --tailwind --app
cd ..
mkdir backend && cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn sqlalchemy asyncpg alembic pydantic-settings python-jose passlib openai redis celery
```

### Step 2
Create `docker-compose.yml` with services: `frontend`, `backend`, `postgres`, `redis`.

### Step 3
Implement auth first (login/register/JWT) — everything depends on this.

### Step 4
Build the market data endpoint and wire up TradingView Lightweight Charts.

### Step 5
Wire the AI chat with chart context — this is the core differentiator.

---

## 13. RECOMMENDED DATA PROVIDERS

| Use Case | Provider | Notes |
|---|---|---|
| OHLCV (all markets) | **TwelveData** | Already integrated. 800 req/day free. |
| Crypto real-time | **Binance WebSocket** | Free, reliable, sub-100ms |
| Forex real-time | **TwelveData WS** or **OANDA** | TwelveData WS on paid plan |
| News | **NewsAPI.org** | Free tier: 100 req/day |
| Alternative news | **Finnhub** | Better for stocks/crypto |
| Crypto data (deep) | **CoinGecko** | Good for market cap, screener |

---

## 14. SECURITY BEST PRACTICES

1. **JWT tokens**: short expiry (15min access + 7d refresh), stored in httpOnly cookies (not localStorage)
2. **Passwords**: bcrypt with cost factor 12
3. **Broker API keys**: AES-256 encrypted at rest in DB
4. **Rate limiting**: 100 req/min per user on AI endpoints (Redis token bucket)
5. **Input validation**: Pydantic on every endpoint, never trust client data
6. **CORS**: Whitelist only your frontend domain
7. **SQL injection**: SQLAlchemy ORM only, no raw string queries
8. **Secrets management**: `.env` files, never in code, never in git
9. **HTTPS only**: enforce in production via reverse proxy (Nginx/Caddy)
10. **Security headers**: X-Frame-Options, CSP, HSTS via middleware
11. **API key rotation**: Document a process to rotate provider keys
12. **Audit logging**: Log all auth events, trade actions, AI calls

---

*Document generated by Lead Engineer Review — AI Trading Assistant Project*  
*Version 1.0 · May 2026*
