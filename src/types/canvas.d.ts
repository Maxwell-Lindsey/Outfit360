// src/types/canvas.d.ts
declare module 'canvas' {
    export function createCanvas(width: number, height: number): Canvas;
    export interface Canvas {
        getContext(contextId: '2d'): CanvasRenderingContext2D;
        toBuffer(format: string): Buffer;
    }
} 