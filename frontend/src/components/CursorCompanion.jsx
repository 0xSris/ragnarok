import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function CursorCompanion() {
  const [visible, setVisible] = useState(false)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const x = useMotionValue(-120)
  const y = useMotionValue(-120)
  const smoothX = useSpring(x, { stiffness: 120, damping: 18, mass: 0.35 })
  const smoothY = useSpring(y, { stiffness: 120, damping: 18, mass: 0.35 })

  useEffect(() => {
    const update = (event) => {
      setVisible(true)
      x.set(event.clientX + 18)
      y.set(event.clientY + 20)
      setLook({
        x: Math.max(-2, Math.min(2, (event.clientX - window.innerWidth / 2) / 280)),
        y: Math.max(-1.5, Math.min(1.5, (event.clientY - window.innerHeight / 2) / 260)),
      })
    }
    const hide = () => setVisible(false)
    window.addEventListener('pointermove', update)
    window.addEventListener('pointerleave', hide)
    return () => {
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerleave', hide)
    }
  }, [x, y])

  return (
    <motion.div
      className="cursor-companion"
      style={{ x: smoothX, y: smoothY }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.82 }}
      transition={{ duration: 0.2 }}
      aria-hidden="true"
    >
      <motion.div
        className="companion-shadow"
        animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.34, 0.2] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="companion-body"
        animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="companion-antenna"
          animate={{ opacity: [0.45, 1, 0.45], scale: [0.9, 1.16, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="companion-face">
          <motion.span
            className="companion-eye"
            style={{ x: look.x, y: look.y }}
            animate={{ scaleY: [1, 1, 0.12, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.3 }}
          />
          <motion.span
            className="companion-eye"
            style={{ x: look.x, y: look.y }}
            animate={{ scaleY: [1, 1, 0.12, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.3, delay: 0.08 }}
          />
        </div>
        <motion.div
          className="companion-smile"
          animate={{ width: [11, 15, 11] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  )
}
