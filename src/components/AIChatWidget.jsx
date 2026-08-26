import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications.jsx';

const MAX_TOOL_ROUNDS = 5;

const TOOLS = [
  {
    name: 'toggle_device',
    description: 'Turn a device from the "All Devices" list on or off by its exact name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact device name, e.g. "Living Light"' },
        state: { type: 'string', enum: ['on', 'off'] }
      },
      required: ['name', 'state']
    }
  },
  {
    name: 'toggle_room_device',
    description: 'Turn a device inside a specific room on or off.',
    input_schema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room name, e.g. "Living Room"' },
        device: { type: 'string', description: 'Device label within that room, e.g. "Lights"' },
        state: { type: 'string', enum: ['on', 'off'] }
      },
      required: ['room', 'device', 'state']
    }
  },
  {
    name: 'set_security_status',
    description: 'Change the home security system status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['disarmed', 'armed-home', 'armed-away'] }
      },
      required: ['status']
    }
  }
];

export default function AIChatWidget({ devices, toggleDevice, rooms, toggleRoomDevice, securityState, setStatus }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { addNotification } = useNotifications();

  function buildSystemPrompt() {
    const deviceList = devices.map((d) => `${d.name}: ${d.state}`).join(', ');
    const roomList = rooms
      .map((r) => `${r.name} (${r.devices.map((d) => `${d.label}: ${d.on ? 'on' : 'off'}`).join(', ')})`)
      .join('; ');
    return `You are the AI assistant for Ferdowsi, a smart home dashboard. You can see and control the home via tools.
Current devices: ${deviceList || 'none'}.
Rooms: ${roomList || 'none'}.
Security status: ${securityState.status}.
Be concise. When the user asks you to change something, call the matching tool rather than just describing what you would do.`;
  }

  function runTool(block) {
    const { name, input: toolInput } = block;
    let result = 'ok';

    if (name === 'toggle_device') {
      const idx = devices.findIndex((d) => d.name.toLowerCase() === toolInput.name.toLowerCase());
      if (idx === -1) {
        result = `No device named "${toolInput.name}" found.`;
      } else {
        const d = devices[idx];
        if ((d.state === 'on') !== (toolInput.state === 'on')) toggleDevice(idx);
        addNotification('AI Assistant', `${d.name} turned ${toolInput.state}`);
        result = `${d.name} is now ${toolInput.state}.`;
      }
    } else if (name === 'toggle_room_device') {
      const room = rooms.find((r) => r.name.toLowerCase() === toolInput.room.toLowerCase());
      const device = room?.devices.find((d) => d.label.toLowerCase() === toolInput.device.toLowerCase());
      if (!room || !device) {
        result = `Could not find "${toolInput.device}" in "${toolInput.room}".`;
      } else {
        if (device.on !== (toolInput.state === 'on')) toggleRoomDevice(room.name, device.label);
        addNotification('AI Assistant', `${room.name}: ${device.label} turned ${toolInput.state}`);
        result = `${room.name} ${device.label} is now ${toolInput.state}.`;
      }
    } else if (name === 'set_security_status') {
      const labels = { disarmed: 'Disarmed', 'armed-home': 'Armed Home', 'armed-away': 'Armed Away' };
      setStatus(toolInput.status, labels[toolInput.status]);
      addNotification('AI Assistant', `Security set to ${labels[toolInput.status]}`);
      result = `Security is now ${labels[toolInput.status]}.`;
    } else {
      result = `Unknown tool: ${name}`;
    }

    return { type: 'tool_result', tool_use_id: block.id, content: result };
  }

  async function callApi(history) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, tools: TOOLS, system: buildSystemPrompt() })
    });

    let data;
    try {
      data = await res.json();
    } catch {
      // Most likely cause: /api isn't being served at all (e.g. plain `vite
      // dev` instead of `vercel dev`, or the app isn't deployed to Vercel
      // yet) — the request hit the SPA fallback and got HTML back, not JSON.
      throw new Error('The AI backend isn\'t reachable. This needs to run on Vercel (with `vercel dev` locally, or once deployed) for /api/chat to exist.');
    }

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError(null);

    const userMessage = { role: 'user', content: text };
    let history = [...messages, userMessage];
    setMessages(history);
    setBusy(true);

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await callApi(history);
        const assistantMessage = { role: 'assistant', content: response.content };
        history = [...history, assistantMessage];

        if (response.stop_reason !== 'tool_use') {
          setMessages(history);
          break;
        }

        const toolResults = response.content
          .filter((b) => b.type === 'tool_use')
          .map(runTool);
        history = [...history, { role: 'user', content: toolResults }];
        setMessages(history);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function renderText(content) {
    if (typeof content === 'string') return content;
    return content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }

  return (
    <>
      <button type="button" className="ai-chat-fab" onClick={() => setOpen((v) => !v)} aria-label="Open AI Assistant">
        🤖
      </button>

      {open && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <span><span className="ai-badge">🤖 AI</span> Assistant</span>
            <button type="button" className="ai-chat-close" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
          </div>

          <div className="ai-chat-body">
            {messages.length === 0 && (
              <p className="ai-chat-empty">Ask me to check or change anything in your home — e.g. "turn off the living room lights" or "arm the security system".</p>
            )}
            {messages
              .filter((m) => m.role === 'user' || (m.role === 'assistant' && renderText(m.content).trim()))
              .map((m, i) => (
                <div className={`ai-chat-msg ai-chat-msg--${m.role}`} key={i}>
                  {renderText(m.content)}
                </div>
              ))}
            {busy && <div className="ai-chat-msg ai-chat-msg--assistant ai-chat-msg--pending">…</div>}
            {error && <div className="ai-chat-error">⚠️ {error}</div>}
          </div>

          <div className="ai-chat-input-row">
            <input
              type="text"
              value={input}
              placeholder="Ask your home assistant…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              disabled={busy}
            />
            <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !input.trim()}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
