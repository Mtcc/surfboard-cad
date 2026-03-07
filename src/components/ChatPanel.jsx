/**
 * ChatPanel — LLM-powered conversational surfboard design interface
 * Connects to Anthropic API via a local proxy or direct API calls.
 * Claude understands surfboard terminology and updates parameters via JSON.
 */

import { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are an expert surfboard shaper and designer with 30+ years of experience. You help users design custom surfboards through conversation using real-world shaping principles.

## PARAMETERS (valid values only)
- lengthFt (integer 4-11), lengthIn_extra (integer 0-11)
- widthIn (float 14-26), thicknessIn (float 1.5-4.5)
- noseWidthIn (float 8-22, measured at 12" from nose tip)
- widePointIn (float 8 to length-14, inches from nose to widest point)
- widePointWidthIn (float 16-26, actual maximum board width)
- tailWidthIn (float 10-22, measured at 12" from tail tip)
- noseRockerIn (float 0.5-8), tailRockerIn (float 0.5-5)
- entryRocker ("flat"|"moderate"|"aggressive")
- exitRocker ("flat"|"moderate"|"aggressive")
- noseThicknessIn (float 0.5-2.5), centerThicknessIn (float 1.5-4.5), tailThicknessIn (float 0.5-3)
- deckDome ("flat"|"low"|"medium"|"high")
- bottomContour ("flat"|"singleConcave"|"doubleConcave"|"vee"|"channels")
- railType ("soft"|"50/50"|"down"|"pinched"|"tucked")
- tailShape ("squash"|"round"|"pin"|"swallow"|"fish"|"square"|"diamond")
- swallowDepthIn (float 0.5-4, only for swallow/fish tails)
- finConfig ("single"|"twin"|"thruster"|"quad"|"2+1"|"5fin")

## SHAPING KNOWLEDGE

### Volume & Guild Factor
Target volume (liters) = Surfer weight (kg) × Guild Factor:
- Beginner: GF 0.60-0.70 (e.g. 70kg × 0.65 = 45.5L)
- Intermediate: GF 0.44-0.52 (70kg × 0.48 = 33.6L)
- Advanced: GF 0.38-0.44 (70kg × 0.41 = 28.7L)
- Pro/Expert: GF 0.34-0.38 (70kg × 0.36 = 25.2L)
1 lb ≈ 0.454 kg. Always ask weight/skill if designing from scratch.

### Wide Point Position (% from nose)
- Far forward (40-48%): drive, paddle power, early wave entry — grovelers, mid-lengths
- Near center (48-52%): balanced — modern shortboards, modern fish
- Behind center (52-65%): maneuverability, pivot turns — performance shortboards, guns
FISH NOTE: Modern fish place the wide point 0-2" forward of center (≈47-50%). Classic Steve Lis retro fish push it to 4"+ forward. Fish wide point is NOT at 12" from nose.

### Rocker
- Flat rocker (nose <3.5", tail <1.5"): speed, paddle, small surf — fish, longboards, grovelers
- Moderate (nose 4-5", tail 2-2.5"): versatile — shortboards, mid-lengths
- Aggressive (nose 5.5"+, tail 2.5"+): steep drops, powerful surf — guns, step-ups
Entry curve: how early nose lift starts. Exit curve: tail flip. Flat exit = drive. Aggressive exit = pivot.

### Rail Types
- Soft: forgiving, floaty — longboards, beginners
- 50/50: balanced — fish, mid-lengths, grovelers
- Down rail: better hold in powerful surf
- Pinched: big wave control — guns
- Tucked under: sharp release edge, speed — performance shortboards

### Board Types by Condition
- Small/weak (0-3ft, mushy): fish, groveler. Flat rocker, wide, more volume.
- Medium (3-6ft, average): shortboard, mid-length. Moderate rocker.
- Large/powerful (6ft+): gun/step-up. Aggressive nose rocker, narrow, pin tail.
- All-conditions: mid-length.

### Sizing Formulas (starting points)
For shortboards: Length ≈ surfer height + 2-4" (advanced) to +6-8" (beginner)
For fish: Length ≈ height - 6" to -8"
Width scales with volume — wider = more volume per inch of thickness.

## RESPONSE FORMAT
When making design changes:
1. Explain shaping decisions in expert but accessible language (2-4 sentences)
2. At the END include a JSON block with ONLY changed parameters:

\`\`\`json
{
  "changes": {
    "widthIn": 20.5,
    "tailShape": "swallow"
  },
  "summary": "Updated width to 20.5\" and switched to swallow tail for small-wave drive"
}
\`\`\`

If just answering a question, skip the JSON. Be concise — this is a design tool.`;

function parseChanges(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[1]);
    return obj.changes ? obj : null;
  } catch {
    return null;
  }
}

function stripJsonBlock(text) {
  return text.replace(/```json[\s\S]*?```/g, '').trim();
}

function MessageBubble({ msg, onApply }) {
  const isUser = msg.role === 'user';
  const hasChanges = msg.changes && Object.keys(msg.changes).length > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '90%',
        padding: '9px 12px',
        borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isUser
          ? 'linear-gradient(135deg, #2255aa, #4488cc)'
          : 'rgba(255,255,255,0.07)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
        fontSize: 12.5,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.role === 'assistant' ? stripJsonBlock(msg.content) : msg.content}
      </div>

      {hasChanges && (
        <div style={{
          marginTop: 6,
          padding: '7px 10px',
          borderRadius: 8,
          background: 'rgba(74,219,162,0.1)',
          border: '1px solid rgba(74,219,162,0.3)',
          fontSize: 11.5,
          color: '#4adba2',
          maxWidth: '90%',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Design update ready:
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontSize: 11 }}>
            {msg.summary}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onApply(msg.changes)}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                border: 'none',
                background: '#4adba2',
                color: '#0a1018',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Apply Changes
            </button>
            <button
              onClick={() => {}}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {msg.role === 'assistant' && msg.loading && (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }}>
          thinking...
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Design a fish for a 180lb intermediate surfer in small beach break",
  "Make the tail 1.5\" wider",
  "What rocker should I use for steep reef breaks?",
  "I want more volume for paddling — keep length the same",
  "Show me a gun for 10-foot surf",
  "Explain the difference between tucked and 50/50 rails",
];

export default function ChatPanel({ params, onParamChange, apiKey }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! I'm your AI shaper. Tell me what you're riding, your weight and skill level, and the kind of waves you're surfing — I'll design your board.",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentParamsSummary = () => {
    const L = params.lengthFt * 12 + (params.lengthIn_extra || 0);
    return `Current board: ${params.lengthFt}'${params.lengthIn_extra || 0}" × ${params.widthIn}" × ${params.thicknessIn}". ` +
      `Wide point at ${params.widePointIn}" from nose (${params.widePointWidthIn}" wide). ` +
      `Nose width ${params.noseWidthIn}", tail ${params.tailWidthIn}". ` +
      `Rocker: nose ${params.noseRockerIn}", tail ${params.tailRockerIn}". ` +
      `Rails: ${params.railType}. Tail: ${params.tailShape}. Fins: ${params.finConfig}.`;
  };

  async function send(text) {
    if (!text.trim() || loading) return;
    const key = localApiKey.trim();
    if (!key) {
      setShowKeyInput(true);
      return;
    }

    const userMsg = { role: 'user', content: text };
    const pendingMsg = { role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    history.push(userMsg);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT + '\n\nCurrent board state:\n' + currentParamsSummary(),
          messages: history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text || '';
      const parsed = parseChanges(content);

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content,
          loading: false,
          changes: parsed?.changes || null,
          summary: parsed?.summary || null,
        };
        return next;
      });
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Error: ${err.message}. Check your API key and try again.`,
          loading: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function applyChanges(changes) {
    const newParams = { ...params, ...changes };
    newParams.lengthIn = newParams.lengthFt * 12 + (newParams.lengthIn_extra || 0);
    onParamChange(newParams);

    // Confirm in chat
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '✓ Applied to your board design.',
    }]);
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(0,0,0,0)',
    }}>
      {/* API key setup */}
      {showKeyInput && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,180,0,0.08)',
          borderBottom: '1px solid rgba(255,180,0,0.2)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,200,0,0.8)', marginBottom: 6, fontWeight: 600 }}>
            Anthropic API Key required
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={localApiKey}
              onChange={e => setLocalApiKey(e.target.value)}
              style={{
                flex: 1, padding: '5px 8px', borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.07)',
                color: '#fff', fontSize: 12, fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => localApiKey.trim() && setShowKeyInput(false)}
              style={{
                padding: '5px 12px', borderRadius: 5, border: 'none',
                background: '#4488cc', color: '#fff', fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Key stored in browser only — never sent to any server except Anthropic.
          </div>
        </div>
      )}

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 12px 4px',
      }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onApply={applyChanges} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{
                padding: '4px 9px',
                borderRadius: 12,
                border: '1px solid rgba(68,136,204,0.35)',
                background: 'rgba(68,136,204,0.08)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 10.5,
                cursor: 'pointer',
                lineHeight: 1.4,
                textAlign: 'left',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '8px 12px 12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: '6px 8px 6px 12px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me to design or modify your board..."
            rows={1}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 12.5,
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              maxHeight: 80,
              overflowY: 'auto',
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 32, height: 32,
              borderRadius: 7,
              border: 'none',
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #2255aa, #4488cc)'
                : 'rgba(255,255,255,0.08)',
              color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {loading ? '⋯' : '↑'}
          </button>
        </div>
        {!showKeyInput && (
          <div
            onClick={() => setShowKeyInput(true)}
            style={{
              marginTop: 5, fontSize: 9.5,
              color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer', textAlign: 'right',
            }}
          >
            API key set · change
          </div>
        )}
      </div>
    </div>
  );
}
