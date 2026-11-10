import { Canvas, type CanvasProps } from '@react-three/fiber'

// Shared 3D canvas for every game board: consistent camera, colour handling and pixel ratio.
// Game engines render their scene as children of this component.
export function GameCanvas({ children, ...props }: CanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [0, 4.5, 6], fov: 35 }}
      gl={{ antialias: true, alpha: true }}
      {...props}
    >
      {children}
    </Canvas>
  )
}
