import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const WIDTH = 540;
const HEIGHT = 941;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function LevelCanvas(props) {
  const host = useRef(null);
  const sceneRef = useRef(null);
  const latest = useRef(props);
  const { background } = props;

  useEffect(() => {
    latest.current = props;
    sceneRef.current?.redraw();
  }, [props]);

  useEffect(() => {
    const worldHeight = Math.max(HEIGHT, background.height * WIDTH / background.width);
    const imageTop = worldHeight - background.height * WIDTH / background.width;
    class LevelScene extends Phaser.Scene {
      preload() {
        this.load.image('level-background', background.url);
        this.load.on('loaderror', file => {
          latest.current.onError(`Could not render background: ${file.src}`);
        });
      }

      create() {
        this.add.image(0, imageTop, 'level-background').setOrigin(0)
          .setDisplaySize(WIDTH, worldHeight - imageTop);
        this.outlines = this.add.graphics();
        this.labels = this.add.container();
        sceneRef.current = this;
        this.redraw();
        this.input.on('pointerdown', pointer => {
          const y = pointer.y + this.cameras.main.scrollY;
          const { encounters, selectedNumber, onSelect, onAdd } = latest.current;
          const ordered = [...encounters.filter(item => item.number !== selectedNumber),
            ...encounters.filter(item => item.number === selectedNumber)];
          const encounter = ordered.reverse().find(item => y >= item.top - 5 && y <= item.bottom + 5);
          if (!encounter) {
            if (y >= imageTop && y <= worldHeight) onAdd(y);
            return;
          }
          onSelect(encounter.number);
          const mode = Math.abs(y - encounter.top) <= 5 ? 'top'
            : Math.abs(y - encounter.bottom) <= 5 ? 'bottom' : 'move';
          this.drag = { ...encounter, mode, startY: y };
        });
        this.input.on('pointermove', pointer => {
          if (!this.drag || !pointer.isDown) return;
          const { number, top, bottom, startY, mode } = this.drag;
          const dy = pointer.y + this.cameras.main.scrollY - startY;
          if (mode === 'top') {
            latest.current.onChange(number, { top: clamp(top + dy, imageTop, bottom - 1) });
          } else if (mode === 'bottom') {
            latest.current.onChange(number, { bottom: clamp(bottom + dy, top + 1, worldHeight) });
          } else {
            const nextTop = clamp(top + dy, imageTop, worldHeight - (bottom - top));
            latest.current.onChange(number, { top: nextTop, bottom: nextTop + bottom - top });
          }
        });
        this.input.on('pointerup', () => { this.drag = null; });
        this.input.on('pointerupoutside', () => { this.drag = null; });
      }

      redraw() {
        this.cameras.main.setScroll(0, latest.current.scrollTop);
        this.outlines.clear();
        this.labels.removeAll(true);
        for (const encounter of latest.current.encounters) {
          const selected = encounter.number === latest.current.selectedNumber;
          const height = encounter.bottom - encounter.top;
          this.outlines.lineStyle(6, 0x000000).strokeRect(2, encounter.top, WIDTH - 4, height);
          this.outlines.lineStyle(2, selected ? 0xffdd00 : 0x00ffff)
            .strokeRect(2, encounter.top, WIDTH - 4, height);
          if (selected) {
            this.outlines.fillStyle(0xffffff)
              .fillRect(WIDTH / 2 - 18, encounter.top - 3, 36, 6)
              .fillRect(WIDTH / 2 - 18, encounter.bottom - 3, 36, 6);
          }
          this.labels.add(this.add.text(10, encounter.top + 2, String(encounter.number), {
            fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
          }));
        }
      }
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: WIDTH,
      height: HEIGHT,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: LevelScene
    });
    const element = host.current;
    const wheel = event => {
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? HEIGHT : 1;
      latest.current.onScroll(latest.current.scrollTop + event.deltaY * units);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheel);
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [background]);

  return <div className="node-canvas level-canvas" ref={host}
    aria-label="Scrollable level canvas, 540 by 941 pixels" />;
}
