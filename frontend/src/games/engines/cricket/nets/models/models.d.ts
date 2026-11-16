// Types for the plain-JSX model viewers (the bat, the pitch and the bowling machine), so the TypeScript screens can
// show them.
import type { CSSProperties, ComponentType } from 'react'

type ModelProps = { height?: number | string; style?: CSSProperties; [prop: string]: unknown }

declare const Model: ComponentType<ModelProps>
export default Model
