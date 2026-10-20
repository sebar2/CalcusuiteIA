import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

interface CanvasLabelSpriteProps {
  text: string;
  position: [number, number, number];
  /** Altura del cartel en metros de escena. */
  height?: number;
  color?: string;
  background?: string;
  border?: string;
}

const FONT_PX = 48;
const PAD_X = 22;
const PAD_Y = 12;
const FONT = `bold ${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/**
 * Etiqueta 3D renderizada como textura de canvas sobre un sprite.
 *
 * Reemplaza a `<Html>` de drei: aquel crea un root de React-DOM por etiqueta y lo
 * desmonta sincrónicamente dentro del commit de R3F, lo que en React 19 produce
 * "Attempted to synchronously unmount a root while React was already rendering"
 * y encarece cada render. Este sprite vive 100 % dentro de la escena Three.js:
 * sin roots adicionales, sin Web Workers, sin fuentes remotas y sin raycasting.
 */
export const CanvasLabelSprite: React.FC<CanvasLabelSpriteProps> = React.memo(
  ({
    text,
    position,
    height = 0.42,
    color = '#cbd5e1',
    background = 'rgba(15, 23, 42, 0.88)',
    border = '#334155',
  }) => {
    const { texture, aspect } = useMemo(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return { texture: new THREE.Texture(), aspect: 1 };

      ctx.font = FONT;
      const width = Math.ceil(ctx.measureText(text).width) + PAD_X * 2;
      const h = FONT_PX + PAD_Y * 2;
      canvas.width = width;
      canvas.height = h;

      // Cambiar el tamaño del canvas resetea el contexto
      ctx.fillStyle = background;
      ctx.strokeStyle = border;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(2, 2, width - 4, h - 4, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = FONT;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, h / 2 + 2);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      return { texture: tex, aspect: width / h };
    }, [text, color, background, border]);

    useEffect(() => () => texture.dispose(), [texture]);

    return (
      <sprite position={position} scale={[height * aspect, height, 1]} raycast={() => undefined}>
        <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    );
  }
);
