import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Mock Canvas and OrbitControls for jsdom tests where WebGL is unavailable
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-canvas' }, children),
  useFrame: vi.fn(),
  useThree: () => ({
    camera: {},
    scene: {},
    gl: {},
  }),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => React.createElement('div', { 'data-testid': 'mock-orbit-controls' }),
}))
