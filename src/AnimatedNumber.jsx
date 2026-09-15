import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

export function AnimatedNumber({ value, decimals = 2, suffix = '', prefix = '' }) {
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`)
  const prevValue = useRef(0)

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1,
      ease: 'easeOut',
    })
    prevValue.current = value
    return () => controls.stop()
  }, [value])

  return <motion.span>{rounded}</motion.span>
}