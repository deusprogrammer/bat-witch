import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

const WIDTH = 540;
const HEIGHT = 941;

function NodeCanvas({ nodes, selectedNumber, onAdd, onSelect }) {
  const host = useRef(null);
  const sceneRef = useRef(null);
  const latest = useRef({ nodes, selectedNumber, onAdd, onSelect });

  useEffect(() => {
    latest.current = { nodes, selectedNumber, onAdd, onSelect };
    sceneRef.current?.drawNodes();
  }, [nodes, selectedNumber, onAdd, onSelect]);

  useEffect(() => {
    class NodeScene extends Phaser.Scene {
      create() {
        this.markers = this.add.container();
        sceneRef.current = this;
        this.drawNodes();
        this.input.on('pointerdown', (pointer, currentlyOver) => {
          if (currentlyOver.length > 0) return;
          latest.current.onAdd(
            Phaser.Math.Clamp(Math.round(pointer.x), 0, WIDTH),
            Phaser.Math.Clamp(Math.round(pointer.y), 0, HEIGHT)
          );
        });
      }

      drawNodes() {
        this.markers.removeAll(true);
        const { nodes: currentNodes, selectedNumber: selected } = latest.current;
        for (const node of currentNodes) {
          const circle = this.add.circle(node.x, node.y, 10,
            node.number === selected ? 0xffcc66 : 0x66ccff)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive({ useHandCursor: true });
          circle.on('pointerdown', () => latest.current.onSelect(node.number));
          const text = this.add.text(node.x, node.y, String(node.number), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#000000'
          }).setOrigin(0.5);
          this.markers.add([circle, text]);
        }
      }
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#0a0a1a',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: NodeScene
    });
    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, []);

  return <div className="node-canvas" ref={host} aria-label="Node placement canvas, 540 by 941 pixels" />;
}

export default function EncounterEditor({ encounter, onChange, onBack }) {
  const nodes = encounter.nodes;
  const setNodes = update => onChange(update(nodes));
  const [selectedNumber, setSelectedNumber] = useState(null);
  const nextNumber = useRef(Math.max(0, ...nodes.map(node => node.number)) + 1);
  const selectedRow = useRef(null);

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedNumber]);

  function addNode(x, y) {
    const number = nextNumber.current++;
    setNodes(current => [...current, { number, label: `node${number}`, x, y }]);
    setSelectedNumber(number);
  }

  function deleteNode(number) {
    setNodes(current => current.filter(node => node.number !== number));
    if (selectedNumber === number) setSelectedNumber(null);
  }

  function downloadNodes() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(nodes, null, 2)], {
      type: 'application/json'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nodes.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="level-editor">
      <header>
        <h1>Encounter Editor: {encounter.label}</h1>
        <button type="button" onClick={onBack}>Back to Level Editor</button>
      </header>
      <section className="editor-workspace">
        <div className="canvas-panel">
          <p>Click to add a node. Click a numbered circle to select it.</p>
          <NodeCanvas nodes={nodes} selectedNumber={selectedNumber}
            onAdd={addNode} onSelect={setSelectedNumber} />
        </div>
        <aside aria-label="Nodes">
          <div className="node-toolbar">
            <h2>Nodes ({nodes.length})</h2>
            <button type="button" onClick={downloadNodes}>Download JSON</button>
          </div>
          {nodes.length === 0 && <p>No nodes yet. Click inside the play window to add one.</p>}
          <ol className="node-list">
            {nodes.map(node => (
              <li key={node.number} className={selectedNumber === node.number ? 'selected' : ''}
                ref={selectedNumber === node.number ? selectedRow : null}>
                <button className="node-number" type="button"
                  aria-label={`Select node ${node.number}`}
                  aria-pressed={selectedNumber === node.number}
                  onClick={() => setSelectedNumber(node.number)}>{node.number}</button>
                <label>
                  <span>Label for node {node.number}</span>
                  <input value={node.label} onFocus={() => setSelectedNumber(node.number)}
                    onChange={event => {
                      const label = event.target.value;
                      setNodes(current => current.map(item =>
                        item.number === node.number ? { ...item, label } : item));
                    }} />
                  <small>x: {node.x}, y: {node.y}</small>
                </label>
                <button type="button" aria-label={`Delete node ${node.number}`}
                  onClick={() => deleteNode(node.number)}>Delete</button>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}
