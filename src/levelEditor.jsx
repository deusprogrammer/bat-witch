import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EncounterEditor from './EncounterEditor.jsx';
import LevelCanvas from './LevelCanvas.jsx';
import './levelEditor.css';

const WIDTH = 540;
const HEIGHT = 941;
const DEFAULT_BACKGROUND = 'assets/background.png';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function LevelEditor() {
  const [background, setBackground] = useState(null);
  const [error, setError] = useState('');
  const [scrollRate, setScrollRate] = useState('15');
  const [scrollTop, setScrollTop] = useState(0);
  const [encounters, setEncounters] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [editingNumber, setEditingNumber] = useState(null);
  const nextNumber = useRef(1);
  const imageRequest = useRef(0);
  const uploadedUrl = useRef(null);
  const selectedRow = useRef(null);
  const rate = Number(scrollRate);
  const validRate = Number.isFinite(rate) && rate > 0;
  const worldHeight = background ? Math.max(HEIGHT, background.height * WIDTH / background.width) : HEIGHT;
  const imageTop = background ? worldHeight - background.height * WIDTH / background.width : 0;
  const maxScroll = worldHeight - HEIGHT;
  const editing = encounters.find(encounter => encounter.number === editingNumber);

  function loadBackground(url, path, ownedUrl = false) {
    const request = ++imageRequest.current;
    const image = new Image();
    image.onload = () => {
      if (request !== imageRequest.current) {
        if (ownedUrl) URL.revokeObjectURL(url);
        return;
      }
      if (uploadedUrl.current) URL.revokeObjectURL(uploadedUrl.current);
      uploadedUrl.current = ownedUrl ? url : null;
      const height = Math.max(HEIGHT, image.height * WIDTH / image.width);
      setBackground({ url, path, width: image.width, height: image.height, request });
      setScrollTop(height - HEIGHT);
      setEncounters([]);
      setSelectedNumber(null);
      nextNumber.current = 1;
      setError('');
    };
    image.onerror = () => {
      if (ownedUrl) URL.revokeObjectURL(url);
      if (request === imageRequest.current) setError(`Could not load background image: ${path}`);
    };
    image.src = url;
  }

  useEffect(() => {
    loadBackground(DEFAULT_BACKGROUND, DEFAULT_BACKGROUND);
    return () => {
      imageRequest.current++;
      if (uploadedUrl.current) URL.revokeObjectURL(uploadedUrl.current);
    };
  }, []);

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedNumber]);

  function addEncounter(y) {
    const number = nextNumber.current++;
    const height = Math.min(20, worldHeight - imageTop);
    const top = clamp(y - height / 2, imageTop, worldHeight - height);
    setEncounters(current => [...current, {
      number, label: `encounter${number}`, top, bottom: top + height, nodes: []
    }]);
    setSelectedNumber(number);
  }

  function changeEncounter(number, changes) {
    setEncounters(current => current.map(encounter =>
      encounter.number === number ? { ...encounter, ...changes } : encounter));
  }

  function downloadLevel() {
    const level = {
      scrollRate: rate,
      background: background.path,
      encounters: encounters.map(({ number, label, top, bottom, nodes }) => ({
        number, label,
        startTime: (worldHeight - bottom) / rate,
        endTime: (worldHeight - top) / rate,
        nodes
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(level, null, 2)], {
      type: 'application/json'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'level.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (editing) {
    return <EncounterEditor key={editing.number} encounter={editing}
      onChange={nodes => changeEncounter(editing.number, { nodes })}
      onBack={() => setEditingNumber(null)} />;
  }

  return (
    <main className="level-editor">
      <header>
        <h1>Level Editor</h1>
        <a href="./index.html">Return to Title Screen</a>
      </header>
      <section className="editor-workspace">
        <div className="canvas-panel">
          <p>Scroll within the image. Click to add an encounter; drag its middle to move it,
            or its top/bottom edge to resize it.</p>
          <div className="viewport-times" aria-live="polite">
            {validRate && background
              ? `View top: ${((worldHeight - scrollTop) / rate).toFixed(2)}s | bottom: ${((worldHeight - scrollTop - HEIGHT) / rate).toFixed(2)}s`
              : 'Enter a positive scroll rate to show timestamps.'}
          </div>
          {background && <LevelCanvas background={background} encounters={encounters}
            selectedNumber={selectedNumber} scrollTop={scrollTop}
            onScroll={value => setScrollTop(clamp(value, 0, maxScroll))}
            onAdd={addEncounter} onSelect={setSelectedNumber} onChange={changeEncounter}
            onError={setError} />}
          <label className="scroll-control">
            View position (top to bottom)
            <input type="range" min="0" max={maxScroll} step="any"
              value={scrollTop} onChange={event => setScrollTop(Number(event.target.value))}
              disabled={!background || maxScroll === 0} />
          </label>
        </div>
        <aside aria-label="Encounters">
          <label className="editor-control">
            Level image
            <input type="file" accept="image/*" onChange={event => {
              const file = event.target.files[0];
              if (!file) return;
              if (encounters.length && !window.confirm('Replace the background and clear all encounters?')) {
                event.target.value = '';
                return;
              }
              loadBackground(URL.createObjectURL(file), file.name, true);
              event.target.value = '';
            }} />
          </label>
          {background && <small className="background-name">{background.path}</small>}
          <label className="editor-control">
            Scroll rate (px/sec)
            <input type="number" min="0" step="any" value={scrollRate}
              onChange={event => setScrollRate(event.target.value)} aria-invalid={!validRate} />
          </label>
          {!validRate && <p role="alert">Scroll rate must be a positive number.</p>}
          {error && <p role="alert">{error}</p>}
          <div className="node-toolbar">
            <h2>Encounters ({encounters.length})</h2>
            <button type="button" disabled={!background || !validRate}
              onClick={downloadLevel}>Download Level JSON</button>
          </div>
          <ol className="node-list encounter-list">
            {encounters.map(encounter => (
              <li key={encounter.number}
                ref={selectedNumber === encounter.number ? selectedRow : null}
                className={selectedNumber === encounter.number ? 'selected' : ''}>
                <button className="node-number" type="button"
                  aria-label={`Select encounter ${encounter.number}`}
                  aria-pressed={selectedNumber === encounter.number}
                  onClick={() => {
                    setSelectedNumber(encounter.number);
                    setScrollTop(clamp((encounter.top + encounter.bottom - HEIGHT) / 2, 0, maxScroll));
                  }}>{encounter.number}</button>
                <div className="encounter-details">
                  <label>
                    <span>Label for encounter {encounter.number}</span>
                    <input value={encounter.label}
                      onFocus={() => setSelectedNumber(encounter.number)}
                      onChange={event => changeEncounter(encounter.number, { label: event.target.value })} />
                  </label>
                  <small>{validRate
                    ? `${((worldHeight - encounter.bottom) / rate).toFixed(2)}s - ${((worldHeight - encounter.top) / rate).toFixed(2)}s`
                    : 'Invalid scroll rate'} | {encounter.nodes.length} nodes</small>
                  <div className="encounter-actions">
                    <button type="button" aria-label={`Edit encounter ${encounter.number}`}
                      onClick={() => setEditingNumber(encounter.number)}>Edit Encounter</button>
                    <button type="button" aria-label={`Delete encounter ${encounter.number}`}
                      onClick={() => {
                        setEncounters(current => current.filter(item => item.number !== encounter.number));
                        if (selectedNumber === encounter.number) setSelectedNumber(null);
                      }}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<LevelEditor />);
