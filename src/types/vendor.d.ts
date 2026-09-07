// Deliberately describes only the inspected and exercised embind surface, not all upstream Box3D.

declare module 'box3d-wasm/standard' {
    export interface V {
        x: number;
        y: number;
        z: number;
    }
    export interface Q extends V {
        w: number;
    }
    export interface Body {
        createBox(options: {
            halfExtents: V;
            density: number;
            friction: number;
            enableContactEvents: boolean;
        }): { delete(): void };
        getPosition(): V;
        getRotation(): Q;
        delete(): void;
    }
    export interface World {
        createBody(options: {
            type: 'static' | 'dynamic';
            position: V;
            rotation: Q;
        }): Body;
        step(dt: number, substeps: number): void;
        getContactEvents(): { begin: unknown[]; end: unknown[]; hit: unknown[] };
        destroy(): void;
        delete(): void;
    }
    export default function Box3D(): Promise<{
        threaded: boolean;
        World: new (options: { gravity: V }) => World;
    }>;
}
declare module 'gltf-validator' {
    export function validateBytes(
        bytes: Uint8Array,
        options?: { uri?: string },
    ): Promise<{
        issues: { numErrors: number; numWarnings: number; messages: unknown[] };
        [key: string]: unknown;
    }>;
}
