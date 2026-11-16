import { Suspense, lazy } from 'react'

// A solid English willow cricket bat as a rigid body: pick it up and it hangs
// from your hand, swing it through the ball, let go and it lands on an edge
// and rocks to rest over its curved back. Click it to knock it over or stand
// it back up. Drag the background to orbit.
// (Thin wrapper: the scene lives in bat/BatScene.jsx.)
const Scene = lazy(() => import('../bat/BatScene.jsx'))

export default function CricketBatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
